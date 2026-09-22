import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { IsRut } from '../../registration/dto/is-rut.validator';

export class RegisterFamilyDto {
  @ApiProperty({ description: 'Nombre(s) del familiar' })
  @IsString() @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Apellido(s) del familiar' })
  @IsString() @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'RUT chileno del familiar (ej. 12.345.678-9)' })
  @IsString() @IsNotEmpty()
  @IsRut()
  rut: string;

  @ApiProperty({ description: 'Correo electrónico del familiar' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Contraseña de la cuenta' })
  @IsString() @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Teléfono (sin prefijo +56)' })
  @IsOptional() @IsString()
  phone?: string;

  @ApiProperty({ description: 'RUT chileno del paciente al que el familiar dice estar vinculado' })
  @IsString() @IsNotEmpty()
  @IsRut()
  patientRut: string;
}
