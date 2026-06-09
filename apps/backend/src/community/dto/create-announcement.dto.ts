import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Sesión grupal virtual', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ example: 'Recordatorio: sesión grupal virtual este viernes 6 jun · 18:00.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  body: string;

  @ApiProperty({ example: 'Santiago', description: 'Santiago | Viña del Mar | Concepción' })
  @IsNotEmpty()
  @IsString()
  sede: string;

  @ApiProperty({ example: '2024-06-06T18:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  eventDate?: string;
}
