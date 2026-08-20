import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class CreateFamilyLinkDto {
  @ApiProperty({ description: 'Correo del paciente a vincular' })
  @IsEmail()
  patientEmail: string;
}
