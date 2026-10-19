import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { SESSION_AUDIENCES, type SessionAudience } from '../entities/family-session.entity';

export class CreateFamilySessionDto {
  @ApiProperty({ description: 'Nombre de la sesión' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Fecha y hora de la sesión (ISO 8601)' })
  @IsDateString()
  sessionDate: string;

  @ApiProperty({ description: 'Lugar de la sesión o descripción del link online' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiPropertyOptional({ description: 'true si la sesión es online' })
  @IsBoolean()
  @IsOptional()
  isOnline?: boolean;

  @ApiProperty({ description: 'ID de la sede a la que pertenece esta sesión' })
  @IsString()
  @IsNotEmpty()
  sedeId: string;

  @ApiPropertyOptional({
    description:
      'true si la sesión es parte del tratamiento del paciente y el familiar no puede optar por saltarla',
  })
  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;

  @ApiProperty({ description: 'Cupo máximo de asistentes', minimum: 1, maximum: 500 })
  @IsInt({ message: 'El cupo debe ser un número entero' })
  @Min(1, { message: 'El cupo debe ser al menos 1' })
  @Max(500, { message: 'El cupo no puede superar 500' })
  capacity: number;

  @ApiProperty({ enum: SESSION_AUDIENCES, description: 'patients = solo pacientes; family = pacientes y familiares' })
  @IsIn(SESSION_AUDIENCES, { message: 'Indica si la sesión es de pacientes o de familiares' })
  audience: SessionAudience;
}
