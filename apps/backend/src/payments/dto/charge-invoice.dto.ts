import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsDbUuid } from '../../registration/dto/is-db-uuid.validator';

export class ChargeInvoiceDto {
  @ApiPropertyOptional({ description: 'Cuota a cobrar. Sin ella se cobra la más antigua que esté sin pagar' })
  @IsOptional()
  @IsDbUuid()
  invoiceId?: string;
}
