import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { FamilyLink } from './entities/family-link.entity';
import { FamilySession } from './entities/family-session.entity';
import { SessionAttendance } from './entities/session-attendance.entity';
import { User } from '../users/entities/user.entity';
import { CreateFamilyLinkDto } from './dto/create-family-link.dto';
import { CreateFamilySessionDto } from './dto/create-family-session.dto';
import { ConfirmAttendanceDto } from './dto/confirm-attendance.dto';

const UPCOMING_WEEKS = 4;

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
  async getLinkStatus(familyUserId: string): Promise<{ status: 'active' | 'pending' | 'unlinked' }> {
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

  // CA 11.1 + 11.5 — sesiones de la sede del paciente vinculado, ordenadas por proximidad
  async getSessionsForFamily(familyUserId: string): Promise<{
    sessions: (FamilySession & { userAttends: boolean | null })[];
    hasUpcoming: boolean;
  }> {
    const link = await this.linkRepo.findOne({
      where: { familyUserId, status: 'active' },
      relations: ['patientUser'],
    });
    if (!link) throw new UnprocessableEntityException('No tienes un vínculo activo con ningún paciente');

    const { sedeId } = link.patientUser;
    if (!sedeId) throw new UnprocessableEntityException('El paciente no tiene sede asignada');

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

    return { sessions: enriched, hasUpcoming };
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

  // Para que el psicólogo vea asistencias en su dashboard (CA 11.4 segunda mitad)
  async getAttendancesForSession(sessionId: string): Promise<SessionAttendance[]> {
    return this.attendanceRepo.find({
      where: { sessionId },
      relations: ['familyUser'],
      order: { confirmedAt: 'DESC' },
    });
  }
}
