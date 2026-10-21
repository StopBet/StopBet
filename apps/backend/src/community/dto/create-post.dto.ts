import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsDbUuid } from '../../registration/dto/is-db-uuid.validator';

export class CreatePostDto {
  @ApiPropertyOptional({
    example: 'Hoy fue difícil pero lo logré. Quería compartirlo con ustedes.',
    description: 'Puede ir vacío si el mensaje lleva un GIF; si no, es obligatorio.',
  })
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

  /**
   * @deprecated Se ignora: la sede sale de la cuenta que publica. Se sigue aceptando porque
   * el `ValidationPipe` va con `forbidNonWhitelisted` y las apps instaladas todavía lo mandan.
   */
  @ApiPropertyOptional({
    example: 'Santiago',
    description: 'Ignorado. La sede se toma de la cuenta autenticada.',
  })
  @IsOptional()
  @IsString()
  sede?: string;

  @ApiPropertyOptional({
    description: 'UUID del mensaje que se responde. Tiene que ser de la misma sede.',
  })
  @IsOptional()
  // `@IsUUID()` mira los bits de versión de la RFC y rechaza los ids escritos a mano del
  // seed, que son la mayoría en desarrollo. Acá basta con la forma que Postgres acepta.
  @IsDbUuid()
  replyToId?: string;

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
