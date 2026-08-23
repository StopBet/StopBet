import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class DeactivatePsychologistDto {
  @ApiPropertyOptional({
    description:
      'UUID de otro psicólogo activo al que se reasignan los pacientes activos, si los hay',
  })
  @IsOptional()
  @IsUUID()
  reassignTo?: string;
}
