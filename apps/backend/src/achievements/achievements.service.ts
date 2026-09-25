import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import {
  AbstinencePeriod as AbstinencePeriodType,
  AchievementsData,
  BadgeMilestone,
  EarnedBadge as EarnedBadgeType,
  RelapseResponse,
} from '@stopbet/shared-types';
import { AbstinencePeriod } from './entities/abstinence-period.entity';
import { EarnedBadge } from './entities/earned-badge.entity';
import { ValidatedMessage } from './entities/validated-message.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { CommunityService } from '../community/community.service';
import { PushService } from '../push/push.service';
import { daysAgoInChile, todayInChile } from '../common/chile-date';

const MILESTONES: BadgeMilestone[] = [1, 3, 7, 14, 21, 30, 45, 60, 75, 90];

// Mensajes de contención validados por AJUTER (no modificar sin revisión clínica)
const SEED_VALIDATED_MESSAGES = [
  'Tu esfuerzo anterior no se borra. Estamos aquí para retomar el camino contigo.',
  'Una recaída no anula tu progreso. Cada intento te enseña algo valioso.',
  'Lo importante es volver a levantarse. Sigues siendo más fuerte que ayer.',
  'Esto es parte del proceso. No estás solo, seguimos acompañándote.',
  'Reconocer la recaída ya es un acto de valentía. Sigamos adelante, paso a paso.',
];

@Injectable()
export class AchievementsService implements OnModuleInit {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    @InjectRepository(AbstinencePeriod)
    private readonly periodRepo: Repository<AbstinencePeriod>,
    @InjectRepository(EarnedBadge)
    private readonly badgeRepo: Repository<EarnedBadge>,
    @InjectRepository(ValidatedMessage)
    private readonly messageRepo: Repository<ValidatedMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly communityService: CommunityService,
    private readonly pushService: PushService,
  ) {}

  async onModuleInit() {
    const count = await this.messageRepo.count();
    if (count === 0) {
      await this.messageRepo.save(
        SEED_VALIDATED_MESSAGES.map((body) => this.messageRepo.create({ body })),
      );
    }
  }

  async getAchievements(userId: string): Promise<AchievementsData> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    let currentPeriod = await this.periodRepo.findOne({
      where: { userId, endDate: IsNull() },
      relations: ['earnedBadges'],
    });

    if (!currentPeriod) {
      const count = await this.periodRepo.count({ where: { userId } });
      currentPeriod = await this.periodRepo.save(
        this.periodRepo.create({
          userId,
          startDate: this.today(),
          endDate: null,
          attemptNumber: count + 1,
        }),
      );
      currentPeriod.earnedBadges = [];
    }

    const daysAchieved = this.daysBetween(currentPeriod.startDate, this.today());

    const newBadges = await this.otorgarInsigniasPendientes(
      userId,
      currentPeriod.id,
      daysAchieved,
      currentPeriod.earnedBadges.map((b) => b.milestone),
    );
    currentPeriod.earnedBadges.push(...newBadges);

    const newestMilestone =
      newBadges.length > 0
        ? (newBadges[newBadges.length - 1].milestone as BadgeMilestone)
        : null;

    const historicalPeriods = await this.periodRepo.find({
      where: { userId, endDate: Not(IsNull()) },
      relations: ['earnedBadges'],
      order: { endDate: 'DESC', startDate: 'DESC' },
    });

    return {
      currentPeriod: this.mapPeriod(currentPeriod, daysAchieved),
      historicalPeriods: historicalPeriods
        .map((p) => {
          const days = this.daysBetween(p.startDate, p.endDate!);
          return this.mapPeriod(p, days);
        })
        .filter((p) => p.daysAchieved > 0),
      newestMilestone,
    };
  }

  /**
   * HDU3 CA1: otorga los hitos que `daysAchieved` ya cumple y avisa al paciente.
   *
   * Es el **único** lugar donde nacen insignias — lo llaman la pantalla de Logros, la
   * pasada diaria del cron y el endpoint de dev. Esa exclusividad es lo que hace que el
   * aviso salga una sola vez: la fila de `earned_badges` es el punto de deduplicación,
   * así que gana quien la cree primero y el resto ya no ve el hito como nuevo.
   */
  private async otorgarInsigniasPendientes(
    userId: string,
    periodId: string,
    daysAchieved: number,
    yaOtorgadas: number[],
    opciones: { avisar?: boolean } = {},
  ): Promise<EarnedBadge[]> {
    const earnedSet = new Set(yaOtorgadas);
    const nuevas: EarnedBadge[] = [];

    for (const milestone of MILESTONES) {
      if (daysAchieved >= milestone && !earnedSet.has(milestone)) {
        nuevas.push(
          await this.badgeRepo.save(
            this.badgeRepo.create({
              userId,
              periodId,
              milestone,
              earnedAt: this.today(),
              sharedToCommunity: false,
            }),
          ),
        );
      }
    }

    // Un solo aviso, por el hito más alto. Con el cron diario nunca se cruza más de
    // uno, pero al recuperar días atrasados salen varios de golpe y encadenar cinco
    // notificaciones seguidas convierte la felicitación en ruido.
    const mayor = nuevas[nuevas.length - 1];
    if (mayor && opciones.avisar !== false) {
      await this.avisarInsignia(userId, mayor.milestone);
    }

    return nuevas;
  }

  /** Otorga y avisa los hitos que el período abierto ya cumple (pasada diaria). */
  async otorgarInsigniasDelPeriodo(period: AbstinencePeriod): Promise<EarnedBadge[]> {
    const yaOtorgadas =
      period.earnedBadges ??
      (await this.badgeRepo.find({ where: { periodId: period.id } }));

    return this.otorgarInsigniasPendientes(
      period.userId,
      period.id,
      this.daysBetween(period.startDate, this.today()),
      yaOtorgadas.map((b) => b.milestone),
    );
  }

  private async avisarInsignia(userId: string, milestone: number): Promise<void> {
    const title = '¡Nueva insignia!';
    const body = `Llevas ${milestone} ${milestone === 1 ? 'día' : 'días'} sin apostar. Tu constancia se nota.`;

    // La fila va primero: es lo que el paciente ve al abrir la app, y tiene que quedar
    // registrada aunque el push no salga. Mismo criterio que el recordatorio de check-in.
    await this.notificationRepo.save(
      // `target` es lo que hace que tocar la notificación abra Logros en vez de solo
      // marcarse leída (ver NotificationsScreen).
      this.notificationRepo.create({
        userId,
        type: 'success',
        title,
        body,
        target: 'achievements',
      }),
    );

    // CA1: el push es lo que llega con la app cerrada. Si Firebase falla no se propaga:
    // la insignia ya está otorgada y no puede perderse por un problema de entrega.
    try {
      await this.pushService.enviarAUsuarios([userId], title, body);
    } catch (err) {
      this.logger.error(`No se pudo enviar el push de la insignia: ${(err as Error).message}`);
    }
  }

  async reportRelapse(userId: string, devStartDate?: string): Promise<RelapseResponse> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const today = this.today();
    const currentPeriod = await this.periodRepo.findOne({
      where: { userId, endDate: IsNull() },
    });

    if (currentPeriod) {
      const effectiveStart = devStartDate ?? currentPeriod.startDate;
      const daysAchieved = this.daysBetween(effectiveStart, today);
      const existing = await this.badgeRepo.find({ where: { periodId: currentPeriod.id } });
      // Sin aviso: acá se cierran los hitos que el paciente alcanzó antes de la
      // recaída, y felicitarlo por ellos justo cuando acaba de reportarla es lo
      // último que corresponde en una plataforma clínica.
      await this.otorgarInsigniasPendientes(
        userId,
        currentPeriod.id,
        daysAchieved,
        existing.map((b) => b.milestone),
        { avisar: false },
      );
      if (devStartDate) {
        await this.periodRepo.update(currentPeriod.id, { startDate: devStartDate });
      }
      await this.periodRepo.update(currentPeriod.id, { endDate: today });
    }

    await this.userRepo.update(userId, { daysStreak: 0, lastGambleDate: today });

    const count = await this.periodRepo.count({ where: { userId } });
    const newPeriod = await this.periodRepo.save(
      this.periodRepo.create({
        userId,
        startDate: today,
        endDate: null,
        attemptNumber: count + 1,
      }),
    );

    return {
      period: this.mapPeriod({ ...newPeriod, earnedBadges: [] }, 0),
      message: await this.randomValidatedMessage(),
    };
  }

  // CA3: mensaje de contención elegido al azar de la tabla validada
  private async randomValidatedMessage(): Promise<string> {
    const messages = await this.messageRepo.find();
    if (!messages.length) return SEED_VALIDATED_MESSAGES[0];
    return messages[Math.floor(Math.random() * messages.length)].body;
  }

  async devSetDays(userId: string, days: number): Promise<{ startDate: string; daysAchieved: number }> {
    const today = this.today();
    const startDate = daysAgoInChile(days);

    let period = await this.periodRepo.findOne({ where: { userId, endDate: IsNull() } });
    if (!period) {
      const count = await this.periodRepo.count({ where: { userId } });
      period = await this.periodRepo.save(
        this.periodRepo.create({ userId, startDate, endDate: null, attemptNumber: count + 1 }),
      );
    } else {
      await this.periodRepo.update(period.id, { startDate });
    }

    // Pasa por el mismo camino que el cron y que la pantalla de Logros —incluido el
    // aviso—, así que sirve para probar el CA1 sin esperar a que cambie el día.
    const existing = await this.badgeRepo.find({ where: { periodId: period.id } });
    await this.otorgarInsigniasPendientes(
      userId,
      period.id,
      days,
      existing.map((b) => b.milestone),
    );

    await this.userRepo.update(userId, { daysStreak: days });

    return { startDate, daysAchieved: days };
  }

  // CA5.2: compartir insignia publica un anuncio de felicitación en el foro de la sede
  async shareBadge(userId: string, milestone: number): Promise<void> {
    const period = await this.periodRepo.findOne({ where: { userId, endDate: IsNull() } });
    if (!period) return;

    // Acotado al período actual: tras una recaída el mismo hito se vuelve a ganar, y
    // buscando solo por (userId, milestone) el hito viejo —ya compartido— tapaba al
    // nuevo y el anuncio no se publicaba nunca.
    const badge = await this.badgeRepo.findOne({
      where: { userId, milestone, periodId: period.id },
    });
    // La insignia sigue siendo pulsable después de compartirla: sin esta guarda cada
    // toque publicaba otro anuncio idéntico en el foro.
    if (!badge || badge.sharedToCommunity) return;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.sedeId) return;

    // El post es lo que la comunidad ve, así que se crea primero: marcar el flag antes
    // dejaría la insignia como compartida aunque la publicación hubiera fallado, y la
    // guarda de arriba impediría reintentarlo.
    await this.communityService.createBadgeAnnouncementPost(userId, milestone, user.sedeId);
    await this.badgeRepo.update({ id: badge.id }, { sharedToCommunity: true });
  }

  private today(): string {
    return todayInChile();
  }

  private daysBetween(startDate: string, endDate: string): number {
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const start = Date.UTC(sy, sm - 1, sd);
    const end = Date.UTC(ey, em - 1, ed);
    return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
  }

  private mapPeriod(
    period: AbstinencePeriod & { earnedBadges: EarnedBadge[] },
    daysAchieved: number,
  ): AbstinencePeriodType {
    return {
      id: period.id,
      userId: period.userId,
      startDate: period.startDate,
      endDate: period.endDate,
      daysAchieved,
      attemptNumber: period.attemptNumber,
      earnedBadges: period.earnedBadges.map(
        (b): EarnedBadgeType => ({
          id: b.id,
          milestone: b.milestone as BadgeMilestone,
          earnedAt: b.earnedAt,
          sharedToCommunity: b.sharedToCommunity,
          periodId: b.periodId,
          createdAt: b.createdAt.toISOString(),
        }),
      ),
    };
  }
}
