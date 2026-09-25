import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { AbstinencePeriod } from './entities/abstinence-period.entity';
import { EarnedBadge } from './entities/earned-badge.entity';
import { ValidatedMessage } from './entities/validated-message.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { BadgeNotifierService } from './badge-notifier.service';
import { CommunityModule } from '../community/community.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AbstinencePeriod,
      EarnedBadge,
      ValidatedMessage,
      User,
      Notification,
    ]),
    CommunityModule,
    PushModule,
  ],
  controllers: [AchievementsController],
  providers: [AchievementsService, BadgeNotifierService],
})
export class AchievementsModule {}
