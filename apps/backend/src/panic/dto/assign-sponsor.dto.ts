import { ApiProperty } from '@nestjs/swagger';
import { IsDbUuid } from '../../registration/dto/is-db-uuid.validator';

export class AssignSponsorDto {
  @ApiProperty({ description: 'UUID del paciente' })
  @IsDbUuid()
  patientId: string;

  @ApiProperty({ description: 'UUID del padrino (rol sponsor)' })
  @IsDbUuid()
  sponsorId: string;
}
