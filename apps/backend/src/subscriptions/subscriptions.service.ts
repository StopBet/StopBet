import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

const PLAN_DURATION_DAYS = 30;

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly repo: Repository<Subscription>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {}

  async create(dto: CreateSubscriptionDto): Promise<Subscription> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.onboardingStatus !== 'payment_pending') {
      throw new BadRequestException(
        'El usuario no está habilitado para realizar el pago en este momento',
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + PLAN_DURATION_DAYS);

    const subscription = await this.repo.save(
      this.repo.create({
        userId: dto.userId,
        paymentMethod: dto.paymentMethod,
        status: 'active',
        expiresAt,
      }),
    );

    await this.userRepo.update(dto.userId, { onboardingStatus: 'complete' });

    await this.notifRepo.save(
      this.notifRepo.create({
        userId: dto.userId,
        type: 'success',
        title: '¡Cuenta activada!',
        body: 'Tu pago fue procesado correctamente. Bienvenido a StopBet · AJUTER.',
      }),
    );

    return subscription;
  }

  findByUser(userId: string): Promise<Subscription[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
