import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { CheckInsModule } from './check-ins/check-ins.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SedesModule } from './sedes/sedes.module';
import { RegistrationModule } from './registration/registration.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AchievementsModule } from './achievements/achievements.module';
import { CommunityModule } from './community/community.module';
import { BillingModule } from './billing/billing.module';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { PanicModule } from './panic/panic.module';
import { Invoice } from './billing/entities/invoice.entity';
import { User } from './users/entities/user.entity';
import { CheckIn } from './check-ins/entities/check-in.entity';
import { Notification } from './notifications/entities/notification.entity';
import { Sede } from './sedes/entities/sede.entity';
import { RegistrationRequest } from './registration/entities/registration-request.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { AbstinencePeriod } from './achievements/entities/abstinence-period.entity';
import { EarnedBadge } from './achievements/entities/earned-badge.entity';
import { ValidatedMessage } from './achievements/entities/validated-message.entity';
import { CommunityPost } from './community/entities/community-post.entity';
import { PostReply } from './community/entities/post-reply.entity';
import { PostReaction } from './community/entities/post-reaction.entity';
import { PostReport } from './community/entities/post-report.entity';
import { AttendanceConfirmation } from './community/entities/attendance-confirmation.entity';
import { AiSession } from './ai-assistant/entities/ai-session.entity';
import { AiMessage } from './ai-assistant/entities/ai-message.entity';
import { AiSessionSummary } from './ai-assistant/entities/ai-session-summary.entity';
import { SponsorAssignment } from './panic/entities/sponsor-assignment.entity';
import { PanicAlert } from './panic/entities/panic-alert.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          User, CheckIn, Notification, Sede,
          RegistrationRequest, Subscription,
          AbstinencePeriod, EarnedBadge, ValidatedMessage,
          CommunityPost, PostReply, PostReaction, PostReport, AttendanceConfirmation,
          Invoice,
          AiSession, AiMessage, AiSessionSummary,
          SponsorAssignment, PanicAlert,
        ],
        // synchronize solo en desarrollo; en producción usar migraciones explícitas
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        ssl:
          config.get<string>('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),

    UsersModule,
    CheckInsModule,
    NotificationsModule,
    SedesModule,
    RegistrationModule,
    SubscriptionsModule,
    AchievementsModule,
    CommunityModule,
    BillingModule,
    AiAssistantModule,
    PanicModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
