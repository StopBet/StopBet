import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistrationRequest } from './entities/registration-request.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

@Module({
  imports: [TypeOrmModule.forFeature([RegistrationRequest, User, Notification])],
  controllers: [RegistrationController],
  providers: [RegistrationService],
})
export class RegistrationModule {}
