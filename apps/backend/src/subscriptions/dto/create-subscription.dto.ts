import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentMethod } from '@stopbet/shared-types';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'UUID del paciente' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: ['card', 'webpay', 'transfer'] })
  @IsEnum(['card', 'webpay', 'transfer'])
  paymentMethod: PaymentMethod;

  // Token del procesador de pagos (Transbank, etc.) — implementar en sprint de pagos
  @ApiPropertyOptional({ description: 'Token del procesador de pagos' })
  @IsOptional() @IsString()
  paymentToken?: string;
}
