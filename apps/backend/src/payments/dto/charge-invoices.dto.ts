import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray } from 'class-validator';
import { IsDbUuid } from '../../registration/dto/is-db-uuid.validator';

export class ChargeInvoicesDto {
  @ApiProperty({ description: 'Cuotas del paciente vinculado que el familiar quiere pagar' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ArrayUnique()
  @IsDbUuid({ each: true })
  invoiceIds!: string[];
}
