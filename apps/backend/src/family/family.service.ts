import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { FamilyLink } from './entities/family-link.entity';
import { FamilySession } from './entities/family-session.entity';
import { SessionAttendance } from './entities/session-attendance.entity';
import { User } from '../users/entities/user.entity';
import { CreateFamilyLinkDto } from './dto/create-family-link.dto';
import { CreateFamilySessionDto } from './dto/create-family-session.dto';
import { ConfirmAttendanceDto } from './dto/confirm-attendance.dto';

const UPCOMING_WEEKS = 4;

export type FamilyLinkState = 'active' | 'pending' | 'unlinked';

export type FamilySessionView = FamilySession & { userAttends: boolean | null };

export interface FamilySessionsView {
  linkStatus: FamilyLinkState;
  sessions: FamilySessionView[];
  hasUpcoming: boolean;
}

// Sólo lo que el psicólogo necesita para pasar lista: nada del resto del User.
export interface SessionAttendanceView {
  id: string;
  sessionId: string;
  familyUserId: string;
  familyUserName: string;
  confirmed: boolean;
  confirmedAt: Date;
}

// CA 11.4 — lo que ve el psicólogo: la sesión más quién respondió y qué.
export interface SedeSessionView {
  id: string;
  title: string;
  sessionDate: Date;
  location: string;
  isOnline: boolean;
  confirmedCount: number;
  declinedCount: number;
  attendances: SessionAttendanceView[];
}

const EMPTY_VIEW = (linkStatus: FamilyLinkState): FamilySessionsView => ({
  linkStatus,
  sessions: [],
  hasUpcoming: false,
});

@Injectable()
export class FamilyService {
  constructor(
    @InjectRepository(FamilyLink)
    private readonly linkRepo: Repository<FamilyLink>,
    @InjectRepository(FamilySession)
    private readonly sessionRepo: Repository<FamilySession>,
    @InjectRepository(SessionAttendance)
    private readonly attendanceRepo: Repository<SessionAttendance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ── Vínculo familiar ↔ paciente ───────────────────────────────────────────

  async requestLink(familyUserId: string, dto: CreateFamilyLinkDto): Promise<FamilyLink> {
    const patient = await this.userRepo.findOne({
      where: { email: dto.patientEmail, role: 'patient' },
    });
    if (!patient) throw new NotFoundException('No existe un paciente con ese correo');

    const existing = await this.linkRepo.findOne({
      where: { familyUserId, patientUserId: patient.id },
    });
    if (existing) throw new ConflictException('Ya existe un vínculo con ese paciente');

    const link = this.linkRepo.create({
      familyUserId,
      patientUserId: patient.id,
      status: 'pending',
    });
    return this.linkRepo.save(link);
  }

  // CA 11.6 — estado del vínculo del familiar
  async getLinkStatus(familyUserId: string): Promise<{ status: FamilyLinkState }> {
    const link = await this.linkRepo.findOne({ where: { familyUserId } });
    if (!link) return { status: 'unlinked' };
    return { status: link.status };
  }

  // ── Sesiones ──────────────────────────────────────────────────────────────

  async createSession(dto: CreateFamilySessionDto): Promise<FamilySession> {
    const session = this.sessionRepo.create({
      ...dto,
      sessionDate: new Date(dto.sessionDate),
      isOnline: dto.isOnline ?? false,
    });
    return this.sessionRepo.save(session);
  }

  // CA 11.1 + 11.5 + 11.6 — sesiones de la sede del paciente vinculado, ordenadas por proximidad.
  // Sin vínculo no es un error: es el estado que la vista de familiar tiene que pintar (11.6).
  async getSessionsForFamily(familyUserId: string): Promise<FamilySessionsView> {
    const link = await this.linkRepo.findOne({
      where: { familyUserId },
      relations: ['patientUser'],
    });

    if (!link) return EMPTY_VIEW('unlinked');
    if (link.status !== 'active') return EMPTY_VIEW(link.status);

    const { sedeId } = link.patientUser;
    if (!sedeId) return EMPTY_VIEW('active');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);

    const sessions = await this.sessionRepo.find({
      where: { sedeId, sessionDate: MoreThanOrEqual(cutoff) },
      order: { sessionDate: 'ASC' },
    });

    const windowLimit = new Date();
    windowLimit.setDate(windowLimit.getDate() + UPCOMING_WEEKS * 7);
    const hasUpcoming = sessions.some((s) => s.sessionDate <= windowLimit);

    const attendances = await this.attendanceRepo.find({
      where: { familyUserId },
    });
    const attendanceMap = new Map(attendances.map((a) => [a.sessionId, a.confirmed]));

    const enriched = sessions.map((s) => ({
      ...s,
      userAttends: attendanceMap.has(s.id) ? attendanceMap.get(s.id)! : null,
    }));

    return { linkStatus: 'active', sessions: enriched, hasUpcoming };
  }

  // CA 11.4 — confirmar o rechazar asistencia
  async confirmAttendance(
    familyUserId: string,
    sessionId: string,
    dto: ConfirmAttendanceDto,
  ): Promise<SessionAttendance> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    const existing = await this.attendanceRepo.findOne({ where: { sessionId, familyUserId } });
    if (existing) {
      existing.confirmed = dto.confirmed;
      return this.attendanceRepo.save(existing);
    }

    const attendance = this.attendanceRepo.create({ sessionId, familyUserId, confirmed: dto.confirmed });
    return this.attendanceRepo.save(attendance);
  }

  // Para que el psicólogo vea asistencias en su dashboard (CA 11.4 segunda mitad).
  // Se arma la respuesta a mano: devolver la relación `familyUser` completa expone
  // passwordHash y el RUT ya descifrado por el transformer.
  async getAttendancesForSession(sessionId: string): Promise<SessionAttendanceView[]> {
    const attendances = await this.attendanceRepo.find({
      where: { sessionId },
      relations: ['familyUser'],
      order: { confirmedAt: 'DESC' },
    });

    return attendances.map((a) => ({
      id: a.id,
      sessionId: a.sessionId,
      familyUserId: a.familyUserId,
      familyUserName: `${a.familyUser.firstName} ${a.familyUser.lastName}`.trim(),
      confirmed: a.confirmed,
      confirmedAt: a.confirmedAt,
    }));
  }

  // CA 11.4 — el psicólogo necesita partir de la lista de sesiones de su sede.
  // `getSessionsForFamily` no le sirve: deriva del vínculo del familiar.
  async getSedeSessions(sedeId: string): Promise<SedeSessionView[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);

    const sessions = await this.sessionRepo.find({
      where: { sedeId, sessionDate: MoreThanOrEqual(cutoff) },
      order: { sessionDate: 'ASC' },
    });
    if (sessions.length === 0) return [];

    const attendances = await this.attendanceRepo.find({
      where: { sessionId: In(sessions.map((s) => s.id)) },
      relations: ['familyUser'],
      order: { confirmedAt: 'DESC' },
    });

    const bySession = new Map<string, SessionAttendanceView[]>();
    for (const a of attendances) {
      const list = bySession.get(a.sessionId) ?? [];
      list.push({
        id: a.id,
        sessionId: a.sessionId,
        familyUserId: a.familyUserId,
        familyUserName: `${a.familyUser.firstName} ${a.familyUser.lastName}`.trim(),
        confirmed: a.confirmed,
        confirmedAt: a.confirmedAt,
      });
      bySession.set(a.sessionId, list);
    }

    return sessions.map((s) => {
      const list = bySession.get(s.id) ?? [];
      return {
        id: s.id,
        title: s.title,
        sessionDate: s.sessionDate,
        location: s.location,
        isOnline: s.isOnline,
        confirmedCount: list.filter((a) => a.confirmed).length,
        declinedCount: list.filter((a) => !a.confirmed).length,
        attendances: list,
      };
    });
  }
}
