import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class RunDueChargesDto {
  @ApiPropertyOptional({
    description: 'Se cobran las cuotas que vencen hasta este día (YYYY-MM-DD). Por omisión, hoy en Chile',
    example: '2026-11-30',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener el formato YYYY-MM-DD' })
  asOf?: string;
}
