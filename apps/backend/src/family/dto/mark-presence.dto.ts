import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { IsDbUuid } from '../../registration/dto/is-db-uuid.validator';

export class PresenceMarkDto {
  @ApiProperty({ description: 'Paciente o familiar invitado a la sesión' })
  @IsDbUuid()
  userId: string;

  @ApiProperty({ description: 'true = asistió, false = no asistió' })
  @IsBoolean()
  attended: boolean;
}

// HdU14 CA4 — se manda la lista completa de una vez, como se pasa lista en papel.
export class MarkPresenceDto {
  @ApiProperty({ type: [PresenceMarkDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Marca al menos a una persona' })
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PresenceMarkDto)
  marks: PresenceMarkDto[];
}
