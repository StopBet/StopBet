import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [AlertsService],
})
export class HealthModule {}
