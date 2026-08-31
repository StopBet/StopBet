import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReportPostDto {
  @ApiProperty({ example: 'Contiene lenguaje que promueve volver a apostar' })
  // Sin recortar, un motivo de solo espacios pasaba @IsNotEmpty y se guardaba en blanco
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason: string;
}
