import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsRut } from './is-rut.validator';
import { IsIsoDate } from './is-iso-date.validator';

// Cuestionario de ingreso (HdU13). Todo opcional: es alguien pidiendo ayuda, no un trámite.
// Los textos libres se recortan y se topan para que un «Otro» no entre como un ensayo.
class IntakeAnswersDto {
  @ApiPropertyOptional({ description: 'Qué lo trae al programa' })
  @IsOptional() @IsString() @MaxLength(200)
  motive?: string;

  @ApiPropertyOptional({ description: 'Detalle cuando responde «Otro»' })
  @IsOptional() @IsString() @MaxLength(500)
  motiveOther?: string;

  @ApiPropertyOptional({ description: 'A qué juega o apuesta', type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true })
  gamblingTypes?: string[];

  @ApiPropertyOptional({ description: 'Detalle cuando marca «Otro»' })
  @IsOptional() @IsString() @MaxLength(500)
  gamblingTypesOther?: string;

  @ApiPropertyOptional({ description: 'Hace cuánto juega' })
  @IsOptional() @IsString() @MaxLength(200)
  duration?: string;

  @ApiPropertyOptional({ description: 'Momentos en que aparecen las ganas', type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(200, { each: true })
  triggers?: string[];

  @ApiPropertyOptional({ description: 'Detalle cuando marca «Otro»' })
  @IsOptional() @IsString() @MaxLength(500)
  triggersOther?: string;
}

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

  @ApiPropertyOptional({ description: 'Cuestionario de ingreso (HdU13); todo opcional' })
  @IsOptional()
  @ValidateNested()
  @Type(() => IntakeAnswersDto)
  intake?: IntakeAnswersDto;
}
