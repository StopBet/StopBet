import { Repository } from 'typeorm';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from './entities/psychologist-sede.entity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// `User.sedeId` guarda el NOMBRE de la sede en las cuentas anteriores a `psychologist_sedes`
// y en las del seed compartido ('Santiago'), no su UUID. Consultar `sedes.id` con ese valor
// aborta la query entera —la columna es uuid y Postgres rechaza el texto antes de comparar—,
// así que hay que traducirlo por nombre antes de usarlo.
export async function resolveSedeId(
  sedeRepo: Repository<Sede>,
  raw: string | null | undefined,
): Promise<string | null> {
  if (!raw) return null;
  if (UUID_RE.test(raw)) return raw;
  const byName = await sedeRepo.findOne({ where: { name: raw } });
  return byName?.id ?? null;
}

// Sedes que cubre un psicólogo: las de `psychologist_sedes` y, si no tiene ninguna, la sede
// legada de su ficha. Compartido por PsychologistsService y RegistrationService para que el
// respaldo legado no tenga dos implementaciones que puedan divergir.
export async function sedeIdsOfPsychologist(
  psychSedeRepo: Repository<PsychologistSede>,
  sedeRepo: Repository<Sede>,
  psychologistId: string,
  legacySedeId: string | null | undefined,
): Promise<string[]> {
  const links = await psychSedeRepo.find({ where: { psychologistId } });
  if (links.length > 0) return links.map((l) => l.sedeId);

  const resolved = await resolveSedeId(sedeRepo, legacySedeId);
  return resolved ? [resolved] : [];
}
