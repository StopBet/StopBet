import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';
import { CheckIn } from '../check-ins/entities/check-in.entity';
import { PanicAlert } from '../panic/entities/panic-alert.entity';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([CheckIn, PanicAlert, PatientAssignment])],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}