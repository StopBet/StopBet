import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { PatientFeedback } from '@stopbet/shared-types';

export class SessionFeedbackDto {
  @ApiProperty({ enum: ['yes', 'somewhat', 'no'] })
  @IsIn(['yes', 'somewhat', 'no'])
  feedback: PatientFeedback;
}
