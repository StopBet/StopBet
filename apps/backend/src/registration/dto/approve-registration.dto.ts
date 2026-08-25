import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ApproveRegistrationDto {
  // Opcional para no romper a los clientes que hoy aprueban sin cuerpo: si no llega, queda
  // asignado quien revisa. La web todavía no envía el psicólogo elegido en su desplegable.
  @ApiPropertyOptional({
    description: 'Psicólogo que queda asignado al paciente. Por defecto, quien revisa.',
  })
  @IsOptional()
  @IsUUID()
  assignedPsychologistId?: string;
}
