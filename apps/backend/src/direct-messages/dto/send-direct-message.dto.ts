import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsDbUuid } from '../../registration/dto/is-db-uuid.validator';

export class SendDirectMessageDto {
  @ApiProperty({ example: '¿Cómo te fue ayer después de la sesión?' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  body: string;

  @ApiPropertyOptional({ description: 'UUID del mensaje que se responde, de esta misma conversación.' })
  @IsOptional()
  @IsDbUuid()
  replyToId?: string;

  @ApiPropertyOptional({
    description:
      'Id que genera el cliente por acción y conserva al reintentar. Si llega repetido, ' +
      'se devuelve el mensaje ya creado en vez de crear otro.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientRequestId?: string;
}
