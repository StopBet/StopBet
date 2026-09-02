import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from './entities/psychologist-sede.entity';
import { PatientAssignment } from './entities/patient-assignment.entity';
import { PsychologistsController } from './psychologists.controller';
import { PsychologistsService } from './psychologists.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Sede, PsychologistSede, PatientAssignment]),
    MailModule,
  ],
  controllers: [PsychologistsController],
  providers: [PsychologistsService],
})
export class PsychologistsModule {}
