import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import {
  ActiveAlertResponse,
  PanicAlertDto,
  PanicAlertStatus,
  SponsorInfo,
} from '@stopbet/shared-types';
import { SponsorAssignment } from './entities/sponsor-assignment.entity';
import { PanicAlert } from './entities/panic-alert.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AssignSponsorDto } from './dto/assign-sponsor.dto';
import { CommunityService } from '../community/community.service';

// CA1.3: el padrino tiene 120 s para responder antes de escalar a la IA
const ESCALATION_MS = 120 * 1000;
const ACTIVE_STATUSES: PanicAlertStatus[] = ['pending', 'responded', 'escalated'];

@Injectable()
export class PanicService {
  constructor(
    @InjectRepository(SponsorAssignment)
    private readonly assignmentRepo: Repository<SponsorAssignment>,
    @InjectRepository(PanicAlert)
    private readonly alertRepo: Repository<PanicAlert>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly communityService: CommunityService,
  ) {}

  // ── Dashboard (psicólogo) ──────────────────────────────────────────────

  async listHistory(): Promise<{
    id: string; patientId: string; patientName: string;
    sedeId: string | null; status: PanicAlertStatus;
    communityNotified: boolean; createdAt: string;
    respondedAt: string | null; escalatedAt: string | null; cancelledAt: string | null;
  }[]> {
    const alerts = await this.alertRepo.find({
      relations: ['patient'],
      order: { createdAt: 'DESC' },
    });
    return alerts.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      patientName: `${a.patient.firstName} ${a.patient.lastName}`,
      sedeId: a.patient.sedeId,
      status: a.status,
      communityNotified: a.communityNotified,
      createdAt: a.createdAt.toISOString(),
      respondedAt: a.respondedAt?.toISOString() ?? null,
      escalatedAt: a.escalatedAt?.toISOString() ?? null,
      cancelledAt: a.cancelledAt?.toISOString() ?? null,
    }));
  }

  // ── Sponsor ────────────────────────────────────────────────────────────

  async getSponsorInfo(patientId: string): Promise<SponsorInfo | null> {
    const assignment = await this.assignmentRepo.findOne({
      where: { patientId, isActive: true },
      relations: ['sponsor'],
    });
    return assignment ? this.serializeSponsor(assignment.sponsor) : null;
  }

  async assignSponsor(dto: AssignSponsorDto): Promise<void> {
    await this.assignmentRepo.update(
      { patientId: dto.patientId, isActive: true },
      { isActive: false },
    );
    await this.assignmentRepo.save(
      this.assignmentRepo.create({
        patientId: dto.patientId,
        sponsorId: dto.sponsorId,
        isActive: true,
      }),
    );
  }

  // ── Alertas ────────────────────────────────────────────────────────────

  async createAlert(patientId: string): Promise<PanicAlertDto> {
    const existing = await this.alertRepo.findOne({
      where: { patientId, status: 'pending' },
    });
    if (existing) return this.serializeAlert(existing);

    // Cerrar alertas responded/escalated previas antes de crear una nueva
    await this.alertRepo.update(
      { patientId, status: In(['responded', 'escalated'] as PanicAlertStatus[]) },
      { status: 'cancelled', cancelledAt: new Date() },
    );

    const assignment = await this.assignmentRepo.findOne({
      where: { patientId, isActive: true },
    });
    // CA1.2: sin padrino activo la alerta nace escalada, para que el paciente
    // llegue a la IA de inmediato en vez de esperar una respuesta que no va a llegar.
    // Igual se registra, para que el episodio quede en el historial del psicólogo.
    if (!assignment) {
      return this.serializeAlert(
        await this.alertRepo.save(
          this.alertRepo.create({
            patientId,
            sponsorId: null,
            status: 'escalated',
            escalatedAt: new Date(),
          }),
        ),
      );
    }

    const alert = await this.alertRepo.save(
      this.alertRepo.create({
        patientId,
        sponsorId: assignment.sponsorId,
        status: 'pending',
      }),
    );

    // CA1: avisar al padrino con el mensaje de contención inmediata
    const patient = await this.userRepo.findOne({ where: { id: patientId } });
    const patientName = patient
      ? `${patient.firstName} ${patient.lastName}`
      : 'Un paciente';
    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: assignment.sponsorId,
        type: 'danger',
        title: 'Alerta de pánico',
        body: `Alerta: El paciente ${patientName} requiere contención inmediata por riesgo de recaída`,
      }),
    );

    return this.serializeAlert(alert);
  }

  private hasExpired(alert: PanicAlert): boolean {
    return (
      alert.status === 'pending' &&
      Date.now() - new Date(alert.createdAt).getTime() > ESCALATION_MS
    );
  }

  // CA1.3 exige escalar "automáticamente". No puede depender de que el cliente
  // consulte la alerta: si el paciente cierra la app en plena crisis, nadie la
  // escalaría nunca.
  @Cron(CronExpression.EVERY_10_SECONDS)
  async escalateExpiredAlerts(): Promise<void> {
    const expired = await this.alertRepo.find({
      where: {
        status: 'pending',
        createdAt: LessThan(new Date(Date.now() - ESCALATION_MS)),
      },
    });
    if (expired.length === 0) return;

    const escalatedAt = new Date();
    for (const alert of expired) {
      alert.status = 'escalated';
      alert.escalatedAt = escalatedAt;
    }
    await this.alertRepo.save(expired);
  }

  async getActiveAlert(userId: string): Promise<ActiveAlertResponse> {
    // Buscar como paciente primero
    let alert = await this.alertRepo.findOne({
      where: { patientId: userId, status: In(ACTIVE_STATUSES) },
      order: { createdAt: 'DESC' },
    });

    // Si no tiene como paciente, buscar como padrino
    if (!alert) {
      alert = await this.alertRepo.findOne({
        where: { sponsorId: userId, status: 'pending' },
        order: { createdAt: 'DESC' },
      });
    }

    if (!alert) return { alert: null, sponsor: null };

    // El cron corre cada 10 s, así que una alerta recién vencida puede seguir
    // 'pending' acá: se escala en el acto para no devolver un estado atrasado.
    if (this.hasExpired(alert)) {
      alert.status = 'escalated';
      alert.escalatedAt = new Date();
      await this.alertRepo.save(alert);
    }

    const sponsor = alert.sponsorId
      ? await this.userRepo.findOne({ where: { id: alert.sponsorId } })
      : null;
    return {
      alert: this.serializeAlert(alert),
      sponsor: sponsor ? this.serializeSponsor(sponsor) : null,
    };
  }

  async respond(alertId: string, sponsorId: string): Promise<PanicAlertDto> {
    const alert = await this.alertRepo.findOne({
      where: { id: alertId, sponsorId, status: 'pending' },
    });
    if (!alert) throw new NotFoundException('Alerta no encontrada');

    alert.status = 'responded';
    alert.respondedAt = new Date();
    return this.serializeAlert(await this.alertRepo.save(alert));
  }

  async cancel(alertId: string, patientId: string): Promise<PanicAlertDto> {
    const alert = await this.alertRepo.findOne({
      where: { id: alertId, patientId, status: In(ACTIVE_STATUSES) },
    });
    if (!alert) throw new NotFoundException('Alerta no encontrada o ya cerrada');

    alert.status = 'cancelled';
    alert.cancelledAt = new Date();
    return this.serializeAlert(await this.alertRepo.save(alert));
  }

  async escalate(alertId: string, patientId: string): Promise<PanicAlertDto> {
    const alert = await this.alertRepo.findOne({
      where: { id: alertId, patientId, status: 'pending' },
    });
    if (!alert) throw new NotFoundException('Alerta no encontrada');

    alert.status = 'escalated';
    alert.escalatedAt = new Date();
    return this.serializeAlert(await this.alertRepo.save(alert));
  }

  async notifyCommunity(
    alertId: string,
    patientId: string,
  ): Promise<{ communityNotified: boolean }> {
    const alert = await this.alertRepo.findOne({
      where: { id: alertId, patientId, status: 'pending' },
    });
    if (!alert) throw new NotFoundException('Alerta no encontrada');
    if (alert.communityNotified) return { communityNotified: true };

    // CA5.1: hasta ahora esto solo movía un booleano y la comunidad no veía nada.
    // El post es lo que realmente se publica, así que se crea primero: marcar el
    // flag antes sería decirle al paciente que pidió ayuda cuando nadie la vio.
    const patient = await this.userRepo.findOne({ where: { id: patientId } });
    if (!patient?.sedeId) return { communityNotified: false };

    await this.communityService.createPanicAlertPost(patientId, patient.sedeId);

    alert.communityNotified = true;
    await this.alertRepo.save(alert);
    return { communityNotified: true };
  }

  async cancelActiveAlert(patientId: string): Promise<{ cancelled: boolean }> {
    const alert = await this.alertRepo.findOne({
      where: { patientId, status: In(ACTIVE_STATUSES) },
      order: { createdAt: 'DESC' },
    });
    if (!alert) return { cancelled: false };
    alert.status = 'cancelled';
    alert.cancelledAt = new Date();
    await this.alertRepo.save(alert);
    return { cancelled: true };
  }

  // Padrino: polling de alertas pendientes que le llegaron
  async getPendingAlerts(sponsorId: string): Promise<PanicAlertDto[]> {
    const alerts = await this.alertRepo.find({
      where: { sponsorId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });
    return alerts.map((a) => this.serializeAlert(a));
  }

  // ── Serialización ──────────────────────────────────────────────────────

  private serializeAlert(a: PanicAlert): PanicAlertDto {
    return {
      id: a.id,
      patientId: a.patientId,
      sponsorId: a.sponsorId,
      status: a.status,
      communityNotified: a.communityNotified,
      respondedAt: a.respondedAt?.toISOString() ?? null,
      escalatedAt: a.escalatedAt?.toISOString() ?? null,
      cancelledAt: a.cancelledAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    };
  }

  private serializeSponsor(u: User): SponsorInfo {
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      isOnline: false, // MVP: presencia real pendiente de WebSocket
    };
  }
}
