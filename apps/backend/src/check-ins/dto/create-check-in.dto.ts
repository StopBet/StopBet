import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EmotionType } from '@stopbet/shared-types';

const EMOTION_VALUES: EmotionType[] = ['tired', 'anxious', 'angry', 'lonely', 'good'];

export class CreateCheckInDto {
  @ApiProperty({ enum: EMOTION_VALUES, description: 'Estado emocional del paciente' })
  @IsEnum(EMOTION_VALUES)
  emotion: EmotionType;
}
