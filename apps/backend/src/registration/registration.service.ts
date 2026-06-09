import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistrationRequest } from './entities/registration-request.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { SubmitRegistrationDto } from './dto/submit-registration.dto';
import { SubmitRegistrationResponse } from '@stopbet/shared-types';

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

  async submit(dto: SubmitRegistrationDto): Promise<SubmitRegistrationResponse> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con este correo electrónico');
    }

    const user = await this.userRepo.save(
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
