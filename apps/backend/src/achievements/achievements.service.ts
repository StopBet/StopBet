import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import {
  AbstinencePeriod as AbstinencePeriodType,
  AchievementsData,
  BadgeMilestone,
  EarnedBadge as EarnedBadgeType,
} from '@stopbet/shared-types';
import { AbstinencePeriod } from './entities/abstinence-period.entity';
import { EarnedBadge } from './entities/earned-badge.entity';
import { User } from '../users/entities/user.entity';

const MILESTONES: BadgeMilestone[] = [1, 3, 7, 14, 21, 30, 45, 60, 75, 90];

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(AbstinencePeriod)
    private readonly periodRepo: Repository<AbstinencePeriod>,
    @InjectRepository(EarnedBadge)
    private readonly badgeRepo: Repository<EarnedBadge>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

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

  async reportRelapse(userId: string): Promise<AbstinencePeriodType> {
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

    return this.mapPeriod({ ...newPeriod, earnedBadges: [] }, 0);
  }

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
