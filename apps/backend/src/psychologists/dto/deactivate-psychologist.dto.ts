import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';
import { IsDbUuid } from '../../registration/dto/is-db-uuid.validator';

export class DeactivatePsychologistDto {
  @ApiPropertyOptional({
    description:
      'UUID de otro psicólogo activo al que se reasignan los pacientes activos, si los hay. ' +
      'Atajo para quien atiende una sola sede; con varias usar reassignments',
  })
  @IsOptional()
  @IsDbUuid()
  reassignTo?: string;

  @ApiPropertyOptional({
    description:
      'Mapa sedeId → psychologistId de destino, para repartir a los pacientes activos por ' +
      'sede. Cada destino debe atender esa sede. Tiene prioridad sobre reassignTo',
  })
  @IsOptional()
  @IsObject()
  reassignments?: Record<string, string>;
}
