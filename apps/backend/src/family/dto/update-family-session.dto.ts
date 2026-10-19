import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateFamilySessionDto } from './create-family-session.dto';

// HdU14 CA2 — se edita todo menos la sede y el tipo: cambiarlos movería la sesión a otro
// grupo de invitados, y las respuestas ya registradas dejarían de corresponder.
export class UpdateFamilySessionDto extends PartialType(
  OmitType(CreateFamilySessionDto, ['sedeId', 'audience'] as const),
) {}
