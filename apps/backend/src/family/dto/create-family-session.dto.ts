import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
