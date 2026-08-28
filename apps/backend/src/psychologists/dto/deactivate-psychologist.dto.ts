import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsDbUuid } from '../../registration/dto/is-db-uuid.validator';

export class DeactivatePsychologistDto {
  @ApiPropertyOptional({
    description:
      'UUID de otro psicólogo activo al que se reasignan los pacientes activos, si los hay',
  })
  @IsOptional()
  @IsDbUuid()
  reassignTo?: string;
}
