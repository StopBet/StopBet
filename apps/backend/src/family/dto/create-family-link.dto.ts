import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { IsRut } from '../../registration/dto/is-rut.validator';

// Cómo el familiar identifica al paciente: por RUT, por correo o por ambos (al menos uno).
// Con los dos, tienen que apuntar al mismo paciente: es más difícil acertar a ciegas.
export class CreateFamilyLinkDto {
  @ApiPropertyOptional({ description: 'RUT chileno del paciente (obligatorio si no va el correo)' })
  @ValidateIf((o: CreateFamilyLinkDto) => !o.patientEmail || o.patientRut !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Indica el RUT o el correo del paciente' })
  @IsRut()
  patientRut?: string;

  @ApiPropertyOptional({ description: 'Correo del paciente (obligatorio si no va el RUT)' })
  @ValidateIf((o: CreateFamilyLinkDto) => !o.patientRut || o.patientEmail !== undefined)
  @IsEmail({}, { message: 'Indica el RUT o el correo del paciente' })
  patientEmail?: string;
}
