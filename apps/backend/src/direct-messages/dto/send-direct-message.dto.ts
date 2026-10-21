import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsDbUuid } from '../../registration/dto/is-db-uuid.validator';

export class SendDirectMessageDto {
  @ApiPropertyOptional({
    example: '¿Cómo te fue ayer después de la sesión?',
    description: 'Puede ir vacío si el mensaje lleva un GIF; si no, es obligatorio.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;

  @ApiPropertyOptional({
    example: 'xT9IgG50Fb7Mi0prBC',
    description: 'Id de GIPHY, tal como lo devuelve GET /gifs. El backend lo vuelve a revisar.',
  })
  @IsOptional()
  @Matches(/^[A-Za-z0-9]{1,40}$/)
  gifId?: string;

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
