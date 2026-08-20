import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PanicController } from './panic.controller';
import { PanicStreamController } from './panic-stream.controller';
import { PanicService } from './panic.service';
import { SponsorAssignment } from './entities/sponsor-assignment.entity';
import { PanicAlert } from './entities/panic-alert.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { CommunityModule } from '../community/community.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SponsorAssignment,
      PanicAlert,
      User,
      Notification,
    ]),
    CommunityModule,
  ],
  controllers: [PanicController, PanicStreamController],
  providers: [PanicService],
})
export class PanicModule {}
