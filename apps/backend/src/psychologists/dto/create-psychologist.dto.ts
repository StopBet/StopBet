import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';
import { IsRut } from '../../registration/dto/is-rut.validator';

export class CreatePsychologistDto {
  @ApiProperty({ description: 'Nombre(s) del psicólogo' })
  @IsString() @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Apellido(s) del psicólogo' })
  @IsString() @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'Correo electrónico' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'RUT chileno (ej. 12.345.678-9)' })
  @IsString() @IsNotEmpty()
  @IsRut()
  rut: string;

  @ApiProperty({ description: 'UUIDs de las sedes asignadas (mínimo 1)', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  sedeIds: string[];
}
