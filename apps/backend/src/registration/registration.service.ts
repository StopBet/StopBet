import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, QueryFailedError, Repository } from 'typeorm';
import { RegistrationRequest } from './entities/registration-request.entity';
import { User } from '../users/entities/user.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';
import { PsychologistSede } from '../psychologists/entities/psychologist-sede.entity';
import { sedeIdsOfPsychologist } from '../psychologists/sedes-of-user';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { AuthUser, SubmitRegistrationResponse } from '@stopbet/shared-types';

const PG_UNIQUE_VIOLATION = '23505';

// El findOne previo mejora el mensaje en el caso normal, pero no es atómico: dos registros
// simultáneos con el mismo correo lo pasan los dos. La restricción única de la BD es lo único
// que puede garantizarlo, y sin esto el perdedor recibe un 500 en vez del mensaje de CA6.2.
function isDuplicateEmail(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
  );
}

@Injectable()
export class RegistrationService {
  constructor(
    @InjectRepository(RegistrationRequest)
    private readonly requestRepo: Repository<RegistrationRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
    @InjectRepository(PsychologistSede)
    private readonly psychSedeRepo: Repository<PsychologistSede>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // El coordinador es un rol administrativo y revisa cualquier sede: si solo viera las suyas,
  // una sede que se queda sin psicólogos no tendría a nadie que pueda aprobar sus solicitudes.
  private async reviewableSedeIds(reviewer: AuthUser): Promise<string[] | null> {
    if (reviewer.role === 'coordinator') return null;
    return sedeIdsOfPsychologist(
      this.psychSedeRepo,
      this.sedeRepo,
      reviewer.id,
      reviewer.sedeId,
    );
  }

  private async assertCoversSede(reviewer: AuthUser, sedeId: string): Promise<void> {
    const sedeIds = await this.reviewableSedeIds(reviewer);
    if (sedeIds === null) return;
    if (!sedeIds.includes(sedeId)) {
      throw new ForbiddenException(
        'No puedes revisar solicitudes de una sede que no atiendes',
      );
    }
  }

  async listPending(reviewer: AuthUser): Promise<{
    id: string; userId: string; sedeId: string;
    firstName: string; lastName: string; email: string;
    createdAt: string;
  }[]> {
    const where: FindOptionsWhere<RegistrationRequest> = { status: 'pending' };

    const sedeIds = await this.reviewableSedeIds(reviewer);
    if (sedeIds !== null) {
      if (sedeIds.length === 0) return [];
      where.sedeId = In(sedeIds);
    }

    const requests = await this.requestRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
    const result = [];
    for (const r of requests) {
      const user = await this.userRepo.findOne({ where: { id: r.userId } });
      if (!user) continue;
      result.push({
        id: r.id,
        userId: r.userId,
        sedeId: r.sedeId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        createdAt: r.createdAt.toISOString(),
      });
    }
    return result;
  }

  async submit(dto: SubmitRegistrationDto): Promise<SubmitRegistrationResponse> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este correo electrónico');
    }

    let user: User;
    try {
      user = await this.userRepo.save(
        this.userRepo.create({
          email: dto.email,
          passwordHash: null,
          role: 'patient',
          firstName: dto.firstName,
          lastName: dto.lastName,
          rut: dto.rut,
          phone: dto.phone ?? null,
          birthDate: dto.birthDate ?? null,
          address: dto.address ?? null,
          referralSource: dto.referralSource ?? null,
          sedeId: dto.sedeId,
          onboardingStatus: 'approval_pending',
        }),
      );
    } catch (err) {
      if (isDuplicateEmail(err)) {
        throw new ConflictException('Ya existe una cuenta con este correo electrónico');
      }
      throw err;
    }

    const request = await this.requestRepo.save(
      this.requestRepo.create({
        userId: user.id,
        sedeId: dto.sedeId,
        institutionId: dto.institutionId,
        status: 'pending',
      }),
    );

    return { userId: user.id, requestId: request.id, status: 'pending' };
  }

  async getStatus(requestId: string): Promise<{ id: string; status: string; userId: string; sedeId: string }> {
    const req = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Solicitud no encontrada');
    return { id: req.id, status: req.status, userId: req.userId, sedeId: req.sedeId };
  }

  async approve(
    requestId: string,
    reviewer: AuthUser,
    dto: ApproveRegistrationDto = {},
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const req = await manager
        .getRepository(RegistrationRequest)
        .findOne({ where: { id: requestId } });
      if (!req) throw new NotFoundException('Solicitud no encontrada');

      await this.assertCoversSede(reviewer, req.sedeId);

      const assignedTo = dto.assignedPsychologistId ?? reviewer.id;
      const assignee = await manager.getRepository(User).findOne({
        where: { id: assignedTo, role: 'psychologist', accountStatus: 'active' },
      });
      if (!assignee) {
        // Quien revisa puede ser coordinador, y un coordinador no atiende pacientes: en ese
        // caso el error no es "no existe", es que falta decir a quién se asigna.
        throw new BadRequestException(
          dto.assignedPsychologistId
            ? 'El psicólogo asignado no existe o no está activo'
            : 'Indica a qué psicólogo se asigna el paciente: quien aprueba no es un psicólogo activo',
        );
      }

      // Update condicional en vez de comprobar el estado y actualizar por separado: dos
      // aprobaciones simultáneas pasarían las dos ese `if` y crearían asignaciones duplicadas.
      // `affected` es opcional en TypeORM, así que se comprueba con `!` y no con `=== 0`.
      const result = await manager.getRepository(RegistrationRequest).update(
        { id: requestId, status: 'pending' },
        { status: 'approved', reviewedBy: reviewer.id, reviewedAt: new Date() },
      );
      if (!result.affected) {
        throw new ConflictException('La solicitud ya fue procesada');
      }

      const assignmentRepo = manager.getRepository(PatientAssignment);
      await assignmentRepo.save(
        assignmentRepo.create({
          patientId: req.userId,
          psychologistId: assignedTo,
          sedeId: req.sedeId,
          active: true,
          endedAt: null,
        }),
      );

      await manager
        .getRepository(User)
        .update(req.userId, { onboardingStatus: 'payment_pending' });

      const notifRepo = manager.getRepository(Notification);
      await notifRepo.save(
        notifRepo.create({
          userId: req.userId,
          type: 'success',
          title: '¡Solicitud aprobada!',
          body: 'Tu registro fue aprobado. Ya puedes activar tu cuenta realizando el pago mensual.',
        }),
      );
    });
  }

  async reject(requestId: string, reviewer: AuthUser): Promise<void> {
    const req = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Solicitud no encontrada');

    await this.assertCoversSede(reviewer, req.sedeId);

    await this.requestRepo.update(requestId, {
      status: 'rejected',
      reviewedBy: reviewer.id,
      reviewedAt: new Date(),
    });

    await this.notifRepo.save(
      this.notifRepo.create({
        userId: req.userId,
        type: 'warning',
        title: 'Solicitud no aprobada',
        body: 'Tu solicitud fue revisada. Comunícate con AJUTER para más información.',
      }),
    );
  }
}
