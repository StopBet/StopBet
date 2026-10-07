import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

const TBK_VALUE = /^[\w-]{1,128}$/;

// Lo que Transbank le dejó al navegador del paciente en la URL de retorno. La página (o la app)
// se lo reenvía al backend con la sesión del paciente.
export class FinishInscriptionDto {
  @ApiProperty({ description: 'TBK_TOKEN del retorno de Transbank' })
  @IsString()
  @Matches(TBK_VALUE)
  token!: string;

  @ApiPropertyOptional({ description: 'TBK_ORDEN_COMPRA: solo llega si el paciente anuló en el formulario' })
  @IsOptional()
  @IsString()
  @Matches(TBK_VALUE)
  abortedBuyOrder?: string;

  @ApiPropertyOptional({ description: 'TBK_ID_SESION: solo llega si el paciente anuló en el formulario' })
  @IsOptional()
  @IsString()
  @Matches(TBK_VALUE)
  abortedSessionId?: string;
}
