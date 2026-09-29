import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamilyService } from './family.service';
import { FamilyController } from './family.controller';
import { FamilyLink } from './entities/family-link.entity';
import { FamilyLinkReview } from './entities/family-link-review.entity';
import { FamilySession } from './entities/family-session.entity';
import { SessionAttendance } from './entities/session-attendance.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from '../psychologists/entities/psychologist-sede.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FamilyLink,
      FamilyLinkReview,
      FamilySession,
      SessionAttendance,
      User,
      Notification,
      Sede,
      PsychologistSede,
      Invoice,
    ]),
    PushModule,
  ],
  controllers: [FamilyController],
  providers: [FamilyService],
  exports: [FamilyService],
})
export class FamilyModule {}
