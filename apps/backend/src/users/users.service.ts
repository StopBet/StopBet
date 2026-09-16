import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { AuthUser, PatientProgress } from '@stopbet/shared-types';
import { CheckIn } from '../check-ins/entities/check-in.entity';
import { AbstinencePeriod } from '../achievements/entities/abstinence-period.entity';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';
import { todayInChile } from '../common/chile-date';

const MILESTONES = [30, 60, 90, 180, 365];

function daysBetween(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

function today(): string {
  return todayInChile();
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
    @InjectRepository(PatientAssignment)
    private readonly assignmentRepo: Repository<PatientAssignment>,
  ) {}

  // Un psicólogo solo ve a sus pacientes asignados. Antes devolvía la lista completa a
  // cualquiera de los dos roles: en el panel, «Mis pacientes» mostraba también los de los
  // demás psicólogos, con su correo y su historial. El coordinador sí ve todos, porque es
  // administrativo — y si filtrara, una sede sin psicólogos no tendría quién la mire.
  async listPatients(viewer?: AuthUser): Promise<PatientListItem[]> {
    let assignedIds: string[] | null = null;
    if (viewer?.role === 'psychologist') {
      const assignments = await this.assignmentRepo.find({
        where: { psychologistId: viewer.id, active: true },
        select: { patientId: true },
      });
      assignedIds = assignments.map(a => a.patientId);
      if (assignedIds.length === 0) return [];
    }

    // Quien postuló y todavía no fue aprobado no es paciente: `registration.submit` crea el
    // usuario con rol `patient` antes de la revisión. Sin este filtro, las solicitudes de
    // ingreso aparecían en la lista de pacientes del coordinador como «registro sin
    // completar», duplicando lo que ya muestra Solicitudes. `onboardingStatus` es nullable
    // en las cuentas antiguas, y `Not()` en SQL descarta los NULL: por eso las dos ramas.
    const base = assignedIds ? { role: 'patient' as const, id: In(assignedIds) } : { role: 'patient' as const };
    const patients = await this.userRepo.find({
      where: [
        { ...base, onboardingStatus: Not('approval_pending') },
        { ...base, onboardingStatus: IsNull() },
      ],
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
