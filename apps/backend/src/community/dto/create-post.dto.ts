import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'Hoy fue difícil pero lo logré. Quería compartirlo con ustedes.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  body: string;

  @ApiProperty({ example: 'Santiago', description: 'Santiago | Viña del Mar | Concepción' })
  @IsNotEmpty()
  @IsString()
  sede: string;

  @ApiPropertyOptional({
    description:
      'Id que genera el cliente por acción y conserva al reintentar. Si llega repetido, ' +
      'se devuelve el post ya creado en vez de crear otro.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientRequestId?: string;
}
