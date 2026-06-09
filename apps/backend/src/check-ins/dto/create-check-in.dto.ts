import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EmotionType } from '@stopbet/shared-types';

export class CreateCheckInDto {
  @ApiProperty({
    enum: ['tired', 'anxious', 'angry', 'lonely', 'good'],
    description: 'Estado emocional del paciente',
  })
  @IsEnum(['tired', 'anxious', 'angry', 'lonely', 'good'])
  emotion: EmotionType;
}
