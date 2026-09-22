import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSession } from './entities/ai-session.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiSessionSummary } from './entities/ai-session-summary.entity';
import { User } from '../users/entities/user.entity';
import { FamilyLink } from '../family/entities/family-link.entity';
import { SponsorAssignment } from '../panic/entities/sponsor-assignment.entity';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { ClinicalRecordsModule } from '../clinical-records/clinical-records.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiSession,
      AiMessage,
      AiSessionSummary,
      User,
      // HdU13 CA6: para omitir tambien los nombres de quienes rodean al paciente.
      FamilyLink,
      SponsorAssignment,
    ]),
    ClinicalRecordsModule,
  ],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}
