import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { RegistrationRequest } from './entities/registration-request.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
import { SubmitRegistrationResponse } from '@stopbet/shared-types';

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
  ) {}

  async listPending(): Promise<{
    id: string; userId: string; sedeId: string;
    firstName: string; lastName: string; email: string;
    createdAt: string;
  }[]> {
    const requests = await this.requestRepo.find({
      where: { status: 'pending' },
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

  async approve(requestId: string, psychologistId: string): Promise<void> {
    const req = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Solicitud no encontrada');

    await this.requestRepo.update(requestId, {
      status: 'approved',
      reviewedBy: psychologistId,
      reviewedAt: new Date(),
    });

    await this.userRepo.update(req.userId, { onboardingStatus: 'payment_pending' });

    await this.notifRepo.save(
      this.notifRepo.create({
        userId: req.userId,
        type: 'success',
        title: '¡Solicitud aprobada!',
        body: 'Tu registro fue aprobado. Ya puedes activar tu cuenta realizando el pago mensual.',
      }),
    );
  }

  async reject(requestId: string, psychologistId: string): Promise<void> {
    const req = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Solicitud no encontrada');

    await this.requestRepo.update(requestId, {
      status: 'rejected',
      reviewedBy: psychologistId,
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
