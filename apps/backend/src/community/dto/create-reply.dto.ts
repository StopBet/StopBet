import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReplyDto {
  @ApiProperty({ example: '¡Mucho ánimo! Cada día cuenta.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  body: string;

  @ApiPropertyOptional({
    description:
      'Id que genera el cliente por acción y conserva al reintentar. Si llega repetido, ' +
      'se devuelve la respuesta ya creada en vez de crear otra.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientRequestId?: string;
}
