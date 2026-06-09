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
import { CommunityPost } from '../community/entities/community-post.entity';

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
    @InjectRepository(CommunityPost)
    private readonly postRepo: Repository<CommunityPost>,
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

  async reportRelapse(userId: string): Promise<RelapseResponse> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const today = this.today();
    const currentPeriod = await this.periodRepo.findOne({
      where: { userId, endDate: IsNull() },
    });

    if (currentPeriod) {
      currentPeriod.endDate = today;
      await this.periodRepo.save(currentPeriod);
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

  // CA1: compartir insignia publica un anuncio de felicitación en el foro de la sede
  async shareBadge(userId: string, milestone: number): Promise<void> {
    await this.badgeRepo.update({ userId, milestone }, { sharedToCommunity: true });

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.sedeId) return;

    await this.postRepo.save(
      this.postRepo.create({
        authorId: userId,
        type: 'forum_post',
        sede: user.sedeId,
        body: `🎉 ${user.firstName} alcanzó ${milestone} ${
          milestone === 1 ? 'día' : 'días'
        } sin apostar. ¡Un logro que merece celebrarse en comunidad!`,
      }),
    );
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
