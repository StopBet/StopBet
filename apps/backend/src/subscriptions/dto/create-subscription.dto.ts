import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentMethod } from '@stopbet/shared-types';

export class CreateSubscriptionDto {
  // Ya no se usa: el paciente sale del token. Antes venía de acá, y cualquiera podía activar
  // la suscripción de otro con solo escribir su id. Se acepta y se ignora porque las versiones
  // de la app ya instaladas lo siguen mandando; quitarlo del DTO les daría 400.
  @ApiPropertyOptional({ deprecated: true, description: 'Ignorado: el paciente sale del token' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ enum: ['card', 'webpay', 'transfer'] })
  @IsEnum(['card', 'webpay', 'transfer'])
  paymentMethod: PaymentMethod;

  // Token del procesador de pagos (Transbank, etc.) — implementar en sprint de pagos
  @ApiPropertyOptional({ description: 'Token del procesador de pagos' })
  @IsOptional() @IsString()
  paymentToken?: string;
}
