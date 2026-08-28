import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsObject, IsOptional, IsUUID } from 'class-validator';

export class UpdateSedesDto {
  @ApiProperty({
    description: 'Set completo de UUIDs de sedes que debe tener el psicólogo (mínimo 1)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  sedeIds: string[];

  @ApiPropertyOptional({
    description:
      'Mapa sedeId (de las que se están quitando) → psychologistId de destino, ' +
      'para reasignar a sus pacientes activos en esa sede antes del cambio',
  })
  @IsOptional()
  @IsObject()
  reassignments?: Record<string, string>;
}
