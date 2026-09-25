import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsDbUuid } from '../../registration/dto/is-db-uuid.validator';

export class CreatePostDto {
  @ApiProperty({ example: 'Hoy fue difícil pero lo logré. Quería compartirlo con ustedes.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  body: string;

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
