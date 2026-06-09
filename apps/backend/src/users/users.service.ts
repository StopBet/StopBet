import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PatientProgress } from '@stopbet/shared-types';
import { CheckIn } from '../check-ins/entities/check-in.entity';

const MILESTONES = [30, 60, 90, 180, 365];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CheckIn)
    private readonly checkInRepo: Repository<CheckIn>,
  ) {}

  async getProgress(userId: string): Promise<PatientProgress> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const lastCheckIn = await this.checkInRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const nextMilestone =
      MILESTONES.find((m) => m > user.daysStreak) ??
      MILESTONES[MILESTONES.length - 1];

    return {
      userId,
      daysStreak: user.daysStreak,
      nextMilestone,
      lastCheckIn: lastCheckIn
        ? {
            id: lastCheckIn.id,
            userId: lastCheckIn.userId,
            emotion: lastCheckIn.emotion,
            date: lastCheckIn.date,
            createdAt: lastCheckIn.createdAt.toISOString(),
          }
        : null,
    };
  }
}
