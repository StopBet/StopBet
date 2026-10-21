import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SearchGifsDto {
  @ApiPropertyOptional({ example: 'abrazo', description: 'Vacío: los GIFs del momento.' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;

  @ApiPropertyOptional({ example: 0, description: 'Cuántos saltar, para la página siguiente.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  // GIPHY no pagina más allá de unos cientos en el plan gratuito, y nadie baja tanto.
  @Max(500)
  offset?: number;
}
