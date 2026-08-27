import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsDbUuid } from './is-db-uuid.validator';

export class ApproveRegistrationDto {
  // Opcional para no romper a los clientes que hoy aprueban sin cuerpo: si no llega, queda
  // asignado quien revisa. Que el psicólogo exista, sea psicólogo y esté activo lo comprueba
  // el servicio contra la base; acá solo se descarta un valor con forma inválida.
  @ApiPropertyOptional({
    description: 'Psicólogo que queda asignado al paciente. Por defecto, quien revisa.',
  })
  @IsOptional()
  @IsDbUuid()
  assignedPsychologistId?: string;
}
