import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
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
  constructor(
    @InjectRepository(AbstinencePeriod)
    private readonly periodRepo: Repository<AbstinencePeriod>,
    @InjectRepository(EarnedBadge)
    private readonly badgeRepo: Repository<EarnedBadge>,
    @InjectRepository(ValidatedMessage)
    private readonly messageRepo: Repository<ValidatedMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
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

    // Otorga insignias nuevas
    const earnedSet = new Set(currentPeriod.earnedBadges.map((b) => b.milestone));
    const newBadges: EarnedBadge[] = [];
    for (const milestone of MILESTONES) {
      if (daysAchieved >= milestone && !earnedSet.has(milestone)) {
        const badge = await this.badgeRepo.save(
          this.badgeRepo.create({
            userId,
            periodId: currentPeriod.id,
            milestone,
            earnedAt: this.today(),
            sharedToCommunity: false,
          }),
        );
        currentPeriod.earnedBadges.push(badge);
        newBadges.push(badge);
      }
    }

    const newestMilestone =
      newBadges.length > 0
        ? (newBadges[newBadges.length - 1].milestone as BadgeMilestone)
        : null;

    const historicalPeriods = await this.periodRepo.find({
      where: { userId, endDate: Not(IsNull()) },
      relations: ['earnedBadges'],
      order: { attemptNumber: 'DESC' },
    });

    return {
      currentPeriod: this.mapPeriod(currentPeriod, daysAchieved),
      historicalPeriods: historicalPeriods.map((p) => {
        const days = this.daysBetween(p.startDate, p.endDate!);
        return this.mapPeriod(p, days);
      }),
      newestMilestone,
    };
  }

  async reportRelapse(userId: string, devStartDate?: string): Promise<RelapseResponse> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const today = this.today();
    const currentPeriod = await this.periodRepo.findOne({
      where: { userId, endDate: IsNull() },
    });

    if (currentPeriod) {
      if (devStartDate) {
        const daysAchieved = this.daysBetween(devStartDate, today);
        const existing = await this.badgeRepo.find({ where: { periodId: currentPeriod.id } });
        const earnedSet = new Set(existing.map((b) => b.milestone));
        for (const milestone of MILESTONES) {
          if (daysAchieved >= milestone && !earnedSet.has(milestone)) {
            await this.badgeRepo.save(
              this.badgeRepo.create({
                userId,
                periodId: currentPeriod.id,
                milestone,
                earnedAt: today,
                sharedToCommunity: false,
              }),
            );
          }
        }
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
    const startDate = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];

    let period = await this.periodRepo.findOne({ where: { userId, endDate: IsNull() } });
    if (!period) {
      const count = await this.periodRepo.count({ where: { userId } });
      period = await this.periodRepo.save(
        this.periodRepo.create({ userId, startDate, endDate: null, attemptNumber: count + 1 }),
      );
    } else {
      await this.periodRepo.update(period.id, { startDate });
    }

    // Crear insignias que correspondan según los días
    const existing = await this.badgeRepo.find({ where: { periodId: period.id } });
    const earnedSet = new Set(existing.map((b) => b.milestone));
    for (const milestone of MILESTONES) {
      if (days >= milestone && !earnedSet.has(milestone)) {
        await this.badgeRepo.save(
          this.badgeRepo.create({ userId, periodId: period.id, milestone, earnedAt: today, sharedToCommunity: false }),
        );
      }
    }

    await this.userRepo.update(userId, { daysStreak: days });

    return { startDate, daysAchieved: days };
  }

  // CA1: compartir insignia publica un anuncio de felicitación en el foro de la sede
  async shareBadge(userId: string, milestone: number): Promise<void> {
    await this.badgeRepo.update({ userId, milestone }, { sharedToCommunity: true });
  }

  private today(): string {
    return new Date().toISOString().split('T')[0];
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
        }),
      ),
    };
  }
}
