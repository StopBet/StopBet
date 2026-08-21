import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckIn } from './entities/check-in.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { CheckInReminderService } from './check-in-reminder.service';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [TypeOrmModule.forFeature([CheckIn, User, Notification]), PushModule],
  controllers: [CheckInsController],
  providers: [CheckInsService, CheckInReminderService],
  exports: [CheckInsService],
})
export class CheckInsModule {}
