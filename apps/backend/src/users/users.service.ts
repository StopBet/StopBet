import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PatientProgress } from '@stopbet/shared-types';
import { CheckIn } from '../check-ins/entities/check-in.entity';
import { AbstinencePeriod } from '../achievements/entities/abstinence-period.entity';

const MILESTONES = [30, 60, 90, 180, 365];

function daysBetween(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export interface PatientListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  sedeId: string | null;
  daysStreak: number;
  accountStatus: string;
  onboardingStatus: string | null;
  lastCheckIn: { emotion: string; date: string } | null;
  recentCheckIns: { emotion: string; date: string }[];
  createdAt: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(CheckIn)
    private readonly checkInRepo: Repository<CheckIn>,
    @InjectRepository(AbstinencePeriod)
    private readonly periodRepo: Repository<AbstinencePeriod>,
  ) {}

  async login(email: string): Promise<{ id: string; role: string; firstName: string; lastName: string }> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');
    if (user.role !== 'psychologist') throw new ForbiddenException('Acceso restringido a psicólogos');
    return { id: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName };
  }

  async listPatients(): Promise<PatientListItem[]> {
    const patients = await this.userRepo.find({
      where: { role: 'patient' },
      order: { createdAt: 'DESC' },
    });

    const result: PatientListItem[] = [];
    for (const p of patients) {
      const [lastCheckIn, currentPeriod, recentCheckIns] = await Promise.all([
        this.checkInRepo.findOne({ where: { userId: p.id }, order: { date: 'DESC' } }),
        this.periodRepo.findOne({ where: { userId: p.id, endDate: IsNull() } }),
        this.checkInRepo.find({ where: { userId: p.id }, order: { date: 'DESC' }, take: 28 }),
      ]);
      const daysStreak = currentPeriod
        ? daysBetween(currentPeriod.startDate, today())
        : p.daysStreak;
      result.push({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        sedeId: p.sedeId,
        daysStreak,
        accountStatus: p.accountStatus,
        onboardingStatus: p.onboardingStatus,
        lastCheckIn: lastCheckIn
          ? { emotion: lastCheckIn.emotion, date: String(lastCheckIn.date) }
          : null,
        recentCheckIns: recentCheckIns.map(c => ({ emotion: c.emotion, date: String(c.date) })),
        createdAt: p.createdAt.toISOString(),
      });
    }
    return result;
  }

  async getProgress(userId: string): Promise<PatientProgress> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const currentPeriod = await this.periodRepo.findOne({
      where: { userId, endDate: IsNull() },
    });

    const daysStreak = currentPeriod
      ? daysBetween(currentPeriod.startDate, today())
      : user.daysStreak;

    const lastCheckIn = await this.checkInRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const nextMilestone =
      MILESTONES.find((m) => m > daysStreak) ??
      MILESTONES[MILESTONES.length - 1];

    return {
      userId,
      daysStreak,
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
