import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class AnswerFamilyRequestDto {
  @ApiProperty({ description: 'true: es mi familiar · false: no lo es' })
  @IsBoolean()
  accept: boolean;
}
