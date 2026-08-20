import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ConfirmAttendanceDto {
  @ApiProperty({ description: 'true = confirma asistencia, false = rechaza' })
  @IsBoolean()
  confirmed: boolean;
}
