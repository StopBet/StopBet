import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { RegistrationRequest } from './entities/registration-request.entity';
import { RegistrationReview, RegistrationVerdict } from './entities/registration-review.entity';
import { User } from '../users/entities/user.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';
import { PsychologistSede } from '../psychologists/entities/psychologist-sede.entity';
import { sedeIdsOfPsychologist } from '../psychologists/sedes-of-user';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { AuthUser, SubmitRegistrationResponse,
  IntakeAnswers,
  RegistrationStatus,
} from '@stopbet/shared-types';

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

export interface ReviewableRequest {
  id: string; userId: string; sedeId: string;
  firstName: string; lastName: string; email: string;
  rut: string | null;
  createdAt: string;
}

export interface RejectedRequest extends ReviewableRequest {
  reviewedAt: string | null;
  reviewedByName: string | null;
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

  // Con la HdU19 v2 solo el coordinador llega aquí, pero el filtro por sede se mantiene para
  // revertir sin reescribir si el cliente desmiente la v2 (docs/hdu19-solicitudes-ingreso-v2.md).
  private async assertCoversSede(reviewer: AuthUser, sedeId: string): Promise<void> {
    const sedeIds = await this.reviewableSedeIds(reviewer);
    if (sedeIds === null) return;
    if (!sedeIds.includes(sedeId)) {
      throw new ForbiddenException(
        'No puedes revisar solicitudes de una sede que no atiendes',
      );
    }
  }

  // Con la HdU19 v2 solo el coordinador llega aquí, pero el filtro por sede se mantiene para
  // revertir sin reescribir si el cliente desmiente la v2 (docs/hdu19-solicitudes-ingreso-v2.md).
  // `null` = el revisor no atiende ninguna sede: no hay nada que consultar.
  private async reviewableWhere(
    reviewer: AuthUser,
    status: RegistrationStatus,
  ): Promise<FindOptionsWhere<RegistrationRequest> | null> {
    const where: FindOptionsWhere<RegistrationRequest> = { status };

    const sedeIds = await this.reviewableSedeIds(reviewer);
    if (sedeIds !== null) {
      if (sedeIds.length === 0) return null;
      where.sedeId = In(sedeIds);
    }
    return where;
  }

  private async recordReview(
    manager: EntityManager,
    requestId: string,
    verdict: RegistrationVerdict,
    reviewer: AuthUser,
  ): Promise<void> {
    const reviewRepo = manager.getRepository(RegistrationReview);
    await reviewRepo.save(
      reviewRepo.create({
        requestId,
        verdict,
        reviewedBy: reviewer.id,
        reviewerRole: reviewer.role,
      }),
    );
  }

  async listPending(reviewer: AuthUser): Promise<ReviewableRequest[]> {
    const where = await this.reviewableWhere(reviewer, 'pending');
    if (!where) return [];

    const requests = await this.requestRepo.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return requests
      .filter((r) => r.user)
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        sedeId: r.sedeId,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        email: r.user.email,
        rut: r.user.rut,
        createdAt: r.createdAt.toISOString(),
      }));
  }

  async listRejected(reviewer: AuthUser): Promise<RejectedRequest[]> {
    const where = await this.reviewableWhere(reviewer, 'rejected');
    if (!where) return [];

    const requests = await this.requestRepo.find({
      where,
      relations: ['user'],
      order: { reviewedAt: 'DESC' },
      take: 50,
    });

    // Una sola consulta para los nombres de quienes revisaron, en vez de una por fila.
    const reviewerIds = [
      ...new Set(requests.map((r) => r.reviewedBy).filter((id): id is string => !!id)),
    ];
    const reviewers = reviewerIds.length
      ? await this.userRepo.find({ where: { id: In(reviewerIds) } })
      : [];
    const names = new Map(reviewers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    return requests
      .filter((r) => r.user)
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        sedeId: r.sedeId,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        email: r.user.email,
        rut: r.user.rut,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        reviewedByName: r.reviewedBy ? (names.get(r.reviewedBy) ?? null) : null,
      }));
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
        intake: normalizeIntake(dto.intake),
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
      await this.recordReview(manager, requestId, 'approved', reviewer);

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
    await this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(RegistrationRequest);
      const req = await requestRepo.findOne({ where: { id: requestId } });
      if (!req) throw new NotFoundException('Solicitud no encontrada');

      await this.assertCoversSede(reviewer, req.sedeId);

      // Update condicional: antes el update no miraba el estado y se podía «rechazar» una
      // solicitud ya aprobada, dejando al paciente con asignación y con el rechazo a la vez.
      const result = await requestRepo.update(
        { id: requestId, status: 'pending' },
        { status: 'rejected', reviewedBy: reviewer.id, reviewedAt: new Date() },
      );
      if (!result.affected) {
        throw new ConflictException('La solicitud ya fue procesada');
      }
      await this.recordReview(manager, requestId, 'rejected', reviewer);

      const notifRepo = manager.getRepository(Notification);
      await notifRepo.save(
        notifRepo.create({
          userId: req.userId,
          type: 'warning',
          title: 'Solicitud no aprobada',
          body: 'Tu solicitud fue revisada. Comunícate con AJUTER para más información.',
        }),
      );
    });
  }

  async reopen(requestId: string, reviewer: AuthUser): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(RegistrationRequest);
      const req = await requestRepo.findOne({ where: { id: requestId } });
      if (!req) throw new NotFoundException('Solicitud no encontrada');

      await this.assertCoversSede(reviewer, req.sedeId);

      // reviewedBy y reviewedAt se limpian porque guardan solo la última decisión; la historia
      // completa vive en registration_reviews.
      const result = await requestRepo.update(
        { id: requestId, status: 'rejected' },
        { status: 'pending', reviewedBy: null, reviewedAt: null },
      );
      if (!result.affected) {
        throw new ConflictException('Solo se puede reabrir una solicitud rechazada');
      }
      await this.recordReview(manager, requestId, 'reopened', reviewer);

      const notifRepo = manager.getRepository(Notification);
      await notifRepo.save(
        notifRepo.create({
          userId: req.userId,
          type: 'info',
          title: 'Tu solicitud volvió a revisión',
          body: 'AJUTER reabrió tu solicitud de ingreso. Te avisaremos cuando haya una respuesta.',
        }),
      );
    });
  }
}

// Normaliza el cuestionario de ingreso (HdU13) a la forma que espera `IntakeAnswers`, con
// `null` explícito en vez de `undefined`: lo que se guarda en `jsonb` se lee después desde la
// ficha, y un campo ausente y uno vacío tienen que verse igual al leerlos.
//
// Devuelve `null` cuando no respondió nada, para distinguir «no contestó» de «contestó vacío».
function normalizeIntake(dto: SubmitRegistrationDto['intake']): IntakeAnswers | null {
  if (!dto) return null;

  const texto = (v: string | undefined) => {
    const t = v?.trim();
    return t ? t : null;
  };
  const lista = (v: string[] | undefined) =>
    (v ?? []).map((x) => x.trim()).filter(Boolean);

  const answers: IntakeAnswers = {
    motive: texto(dto.motive),
    motiveOther: texto(dto.motiveOther),
    gamblingTypes: lista(dto.gamblingTypes),
    gamblingTypesOther: texto(dto.gamblingTypesOther),
    duration: texto(dto.duration),
    triggers: lista(dto.triggers),
    triggersOther: texto(dto.triggersOther),
  };

  const vacio =
    !answers.motive &&
    !answers.motiveOther &&
    answers.gamblingTypes.length === 0 &&
    !answers.gamblingTypesOther &&
    !answers.duration &&
    answers.triggers.length === 0 &&
    !answers.triggersOther;

  return vacio ? null : answers;
}
