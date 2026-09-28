import { ApiProperty } from '@nestjs/swagger';
import { IsDbUuid } from '../../registration/dto/is-db-uuid.validator';

// Quién designa no viaja en el cuerpo: sale del token vía @CurrentUser. Si el cliente
// pudiera mandarlo, la atribución clínica del CA21.1 sería falsificable desde el navegador.
export class DesignateSponsorDto {
  @ApiProperty({ description: 'UUID del paciente a designar como padrino' })
  @IsDbUuid()
  patientId: string;
}
