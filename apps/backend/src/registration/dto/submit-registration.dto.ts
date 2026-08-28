import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { IsRut } from './is-rut.validator';
import { IsIsoDate } from './is-iso-date.validator';

export class SubmitRegistrationDto {
  @ApiProperty({ description: 'Nombre(s) del paciente' })
  @IsString() @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Apellido(s) del paciente' })
  @IsString() @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'RUT chileno (ej. 12.345.678-9)' })
  @IsString() @IsNotEmpty()
  @IsRut()
  rut: string;

  @ApiProperty({ description: 'Correo electrónico' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Teléfono (sin prefijo +56)' })
  @IsOptional() @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Fecha de nacimiento (ISO 8601: YYYY-MM-DD)' })
  @IsOptional() @IsIsoDate()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Dirección' })
  @IsOptional() @IsString()
  address?: string;

  @ApiPropertyOptional({ description: '¿Cómo conoció AJUTER?' })
  @IsOptional() @IsString()
  referralSource?: string;

  @ApiProperty({ description: 'UUID de la sede AJUTER seleccionada' })
  @IsUUID()
  sedeId: string;

  @ApiProperty({ description: 'ID de la institución', default: 'AJUTER' })
  @IsString() @IsNotEmpty()
  institutionId: string;
}
