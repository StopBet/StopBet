import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignSponsorDto {
  @ApiProperty({ description: 'UUID del paciente' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ description: 'UUID del padrino (rol sponsor)' })
  @IsUUID()
  sponsorId: string;
}
