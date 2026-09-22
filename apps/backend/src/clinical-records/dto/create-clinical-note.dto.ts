import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateClinicalNoteDto {
  @ApiProperty({
    description: 'Texto de la anotación',
    example: 'Llegó al grupo por primera vez. Habló de la deuda frente a los demás.',
  })
  @IsString({ message: 'La anotación debe ser texto' })
  // Igual que en la ficha: recortar antes de validar evita que un campo con solo espacios
  // entre como si tuviera contenido.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'La anotación no puede estar vacía' })
  // Tope alto: una anotación de seguimiento no es un informe, pero tampoco hay razón para
  // cortar a media frase a quien escribe con detalle.
  @MaxLength(5000, { message: 'La anotación no puede superar los 5000 caracteres' })
  content: string;
}
