import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalRecord } from './entities/clinical-record.entity';
import { ClinicalRecordVersion } from './entities/clinical-record-version.entity';
import { ClinicalNote } from './entities/clinical-note.entity';
import { User } from '../users/entities/user.entity';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';
import { RegistrationRequest } from '../registration/entities/registration-request.entity';
import { ClinicalRecordsController } from './clinical-records.controller';
import { ClinicalRecordsService } from './clinical-records.service';

@Module({
  imports: [
    // `PatientAssignment` no lo usa el servicio: lo necesita `PatientAccessGuard`, que se
    // instancia en el contexto de este módulo.
    TypeOrmModule.forFeature([
      ClinicalRecord,
      ClinicalRecordVersion,
      ClinicalNote,
      User,
      PatientAssignment,
      // Solo lectura: la ficha muestra el cuestionario de ingreso, no lo modifica.
      RegistrationRequest,
    ]),
  ],
  controllers: [ClinicalRecordsController],
  providers: [ClinicalRecordsService],
  // Lo exporta para el CA6: el asistente lee los detonantes sin tocar la tabla por su cuenta.
  exports: [ClinicalRecordsService],
})
export class ClinicalRecordsModule {}
