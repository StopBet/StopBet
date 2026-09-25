import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, Repository } from 'typeorm';
import { PanicAlert } from '../panic/entities/panic-alert.entity';
import { SponsorAssignment } from '../panic/entities/sponsor-assignment.entity';
import { CheckIn } from '../check-ins/entities/check-in.entity';
import { CommunityMute } from '../notifications/entities/community-mute.entity';
import { PostReport } from '../community/entities/post-report.entity';
import { CommunityPost } from '../community/entities/community-post.entity';
import { AbstinencePeriod } from '../achievements/entities/abstinence-period.entity';
import { EarnedBadge } from '../achievements/entities/earned-badge.entity';
import { User } from '../users/entities/user.entity';
import { todayInChile } from '../common/chile-date';
import { cloneDemoPatient, EXTRA_DEMO_PATIENTS } from './demo-patients';
import { ensureFamilyDemoSessions } from '../family/family-demo-sessions';

// IDs de src/seed.ts: la demo gira en torno a Carlos (paciente) y Daniela (su compañera de viaje).
export const DEMO_PATIENT_ID = '11111111-1111-1111-1111-111111111111';
export const DEMO_SPONSOR_ID = '22222222-2222-2222-2222-222222222222';
export const DEMO_PATIENT_IDS = [DEMO_PATIENT_ID, ...EXTRA_DEMO_PATIENTS.map((p) => p.id)];

// El backend escala la alerta a la IA a los 120 s (ESCALATION_MS en panic.service.ts) y este
// cron corre cada 10 s: con más de 110 s la respuesta llegaría después de la escalada.
const MAX_SPONSOR_DELAY_S = 110;

/**
 * Herramientas para grabar la demo sin un computador de por medio ni un APK nuevo. Las tres
 * vienen apagadas y se encienden con variables en Railway:
 *
 * - `DEMO_PACIENTES_EXTRA=true`: al arrancar, crea tres copias de Carlos (demo2, demo3 y
 *   demo4@stopbet.cl) si no existen, para que varias personas prueben a la vez.
 * - `DEMO_RESET_ON_LOGIN=true`: entrar como Carlos o una de sus copias deja esa cuenta como
 *   después de `seed:demo --reset`. Desde el teléfono basta con cerrar sesión y volver a entrar.
 * - `DEMO_PADRINO_SEGUNDOS=45`: Daniela responde sola las alertas que le lleguen, a los N s.
 *   La respuesta es automática, no de una persona; solo corre por la cuenta de Daniela.
 *
 * Una cuarta viene **encendida** y se apaga con `DEMO_SESIONES_FAMILIARES=false`:
 *
 * - Al arrancar y cada madrugada, deja sesiones familiares próximas en la sede de Carlos
 *   (family-demo-sessions.ts). La base de Railway se sembró una sola vez y las sesiones del
 *   seed caducaban, así que el portal del familiar quedaba vacío. Sin Carlos Demo en la base
 *   no hace nada, por eso no necesita interruptor para encenderse.
 */
@Injectable()
export class DemoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(PanicAlert)
    private readonly alertRepo: Repository<PanicAlert>,
    @InjectRepository(SponsorAssignment)
    private readonly sponsorRepo: Repository<SponsorAssignment>,
    @InjectRepository(CheckIn)
    private readonly checkInRepo: Repository<CheckIn>,
    @InjectRepository(CommunityMute)
    private readonly muteRepo: Repository<CommunityMute>,
    @InjectRepository(PostReport)
    private readonly reportRepo: Repository<PostReport>,
    @InjectRepository(CommunityPost)
    private readonly postRepo: Repository<CommunityPost>,
    @InjectRepository(AbstinencePeriod)
    private readonly periodRepo: Repository<AbstinencePeriod>,
    @InjectRepository(EarnedBadge)
    private readonly badgeRepo: Repository<EarnedBadge>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.refreshFamilyDemoSessions();
    if (this.config.get<string>('DEMO_PACIENTES_EXTRA') !== 'true') return;
    try {
      await this.ensureExtraDemoPatients();
    } catch (err) {
      this.logger.error(`No se pudieron crear las copias de Carlos: ${(err as Error).message}`);
    }
  }

  // Una sesión de las 19:00 pasa a vencida esa misma noche: sin la vuelta diaria, entre dos
  // despliegues el portal iría perdiendo sesiones una por una.
  @Cron('0 5 * * *', { timeZone: 'America/Santiago' })
  async refreshFamilyDemoSessions(): Promise<void> {
    if (this.config.get<string>('DEMO_SESIONES_FAMILIARES') === 'false') return;
    try {
      const r = await ensureFamilyDemoSessions(this.dataSource.manager, { resetDates: false });
      if (r.skipped) {
        this.logger.warn(`Sesiones familiares de demo: no se hizo nada, ${r.skipped}`);
        return;
      }
      if (r.created.length || r.moved.length || r.answers) {
        this.logger.log(
          `Sesiones familiares de demo: ${r.created.length} creadas, ${r.moved.length} movidas, ` +
            `${r.answers} respuestas nuevas`,
        );
      }
    } catch (err) {
      this.logger.error(`No se pudieron preparar las sesiones familiares de demo: ${(err as Error).message}`);
    }
  }

  // Idempotente: solo crea las copias que falten. Para rehacer una, se borra el usuario.
  async ensureExtraDemoPatients(): Promise<void> {
    const users = this.dataSource.getRepository(User);
    if (!(await users.exist({ where: { id: DEMO_PATIENT_ID } }))) {
      this.logger.warn('Falta Carlos Demo: corre el seed antes de DEMO_PACIENTES_EXTRA');
      return;
    }
    for (const profile of EXTRA_DEMO_PATIENTS) {
      if (await users.exist({ where: { id: profile.id } })) continue;
      await this.dataSource.transaction((em) => cloneDemoPatient(em, DEMO_PATIENT_ID, profile));
      this.logger.log(`Copia de Carlos creada: ${profile.firstName} ${profile.lastName} (${profile.email})`);
    }
  }

  sponsorDelaySeconds(): number | null {
    const raw = this.config.get<string>('DEMO_PADRINO_SEGUNDOS');
    if (raw === undefined || raw.trim() === '') return null;
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_SPONSOR_DELAY_S) return null;
    return seconds;
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async answerAsDemoSponsor(): Promise<void> {
    const seconds = this.sponsorDelaySeconds();
    if (seconds === null) return;

    const due = await this.alertRepo.find({
      where: {
        sponsorId: DEMO_SPONSOR_ID,
        status: 'pending',
        createdAt: LessThan(new Date(Date.now() - seconds * 1000)),
      },
    });
    if (due.length === 0) return;

    const respondedAt = new Date();
    for (const alert of due) {
      alert.status = 'responded';
      alert.respondedAt = respondedAt;
    }
    await this.alertRepo.save(due);
    this.logger.log(`Daniela respondió sola ${due.length} alerta(s) (DEMO_PADRINO_SEGUNDOS=${seconds})`);
  }

  // Nunca bloquea el login: si algo falla, la persona entra igual y queda en el log.
  async onLogin(userId: string): Promise<void> {
    if (!DEMO_PATIENT_IDS.includes(userId)) return;
    if (this.config.get<string>('DEMO_RESET_ON_LOGIN') !== 'true') return;
    try {
      await this.resetDemoPatient(userId);
      this.logger.log(`Cuenta demo ${userId.slice(-3)} reiniciada al iniciar sesión (DEMO_RESET_ON_LOGIN)`);
    } catch (err) {
      this.logger.error(`No se pudo reiniciar la cuenta demo ${userId}: ${(err as Error).message}`);
    }
  }

  // Lo mismo que `seed:demo --reset` (src/demo.seed.ts), más las alertas ya respondidas.
  async resetDemoPatient(patientId: string): Promise<void> {
    await this.sponsorRepo.update(
      { patientId, sponsorId: DEMO_SPONSOR_ID },
      { isActive: true },
    );

    await this.alertRepo.update(
      { patientId, status: In(['pending', 'responded', 'escalated']) },
      { status: 'cancelled', cancelledAt: new Date() },
    );

    await this.checkInRepo.delete({ userId: patientId, date: todayInChile() });

    await this.muteRepo.delete({ userId: patientId });

    const reports = await this.reportRepo.find({ where: { reporterId: patientId } });
    for (const r of reports) {
      await this.reportRepo.delete(r.id);
      await this.postRepo.decrement({ id: r.postId }, 'reportCount', 1);
    }

    const period = await this.periodRepo.findOne({
      where: { userId: patientId, endDate: IsNull() },
    });
    if (period) {
      await this.badgeRepo.update(
        { periodId: period.id, milestone: 45 },
        { sharedToCommunity: false },
      );
    }
  }
}
