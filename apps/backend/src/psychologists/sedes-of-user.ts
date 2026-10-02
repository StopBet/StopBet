import { In, Repository } from 'typeorm';
import { Sede } from '../sedes/entities/sede.entity';
import { PsychologistSede } from './entities/psychologist-sede.entity';
import { DB_UUID_RE } from '../registration/dto/is-db-uuid.validator';

// `User.sedeId` guarda el NOMBRE de la sede en las cuentas anteriores a `psychologist_sedes`
// y en las del seed compartido ('Santiago'), no su UUID. Consultar `sedes.id` con ese valor
// aborta la query entera —la columna es uuid y Postgres rechaza el texto antes de comparar—,
// así que hay que traducirlo por nombre antes de usarlo.
export async function resolveSedeId(
  sedeRepo: Repository<Sede>,
  raw: string | null | undefined,
): Promise<string | null> {
  if (!raw) return null;
  if (DB_UUID_RE.test(raw)) return raw;
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

// `users.sedeId` guarda el nombre de la sede o su UUID según de dónde venga la cuenta (seed →
// 'Santiago'; registro → UUID). Comparar por un solo lado parte una sede en dos mitades que no
// se ven entre sí, y el síntoma es una lista vacía, no un error. Mientras no exista la migración
// que normalice la columna, se comparan las dos formas.
export async function formasDeSede(sedeRepo: Repository<Sede>, sede: string): Promise<string[]> {
  const fila = DB_UUID_RE.test(sede)
    ? await sedeRepo.findOne({ where: { id: sede } })
    : await sedeRepo.findOne({ where: { name: sede } });
  return fila ? [fila.id, fila.name] : [sede];
}

// Todas las formas (id y nombre) de las sedes que cubre una cuenta: la suya si es paciente o
// compañero de viaje, todas las de `psychologist_sedes` si es del equipo clínico.
export async function formasDeSedesDeUsuario(
  sedeRepo: Repository<Sede>,
  psychSedeRepo: Repository<PsychologistSede>,
  user: { id: string; role: string; sedeId: string | null },
): Promise<Set<string>> {
  const ids =
    user.role === 'psychologist' || user.role === 'coordinator'
      ? await sedeIdsOfPsychologist(psychSedeRepo, sedeRepo, user.id, user.sedeId)
      : ([await resolveSedeId(sedeRepo, user.sedeId)].filter(Boolean) as string[]);

  const filas = ids.length ? await sedeRepo.find({ where: { id: In(ids) } }) : [];
  const formas = new Set<string>();
  // El valor crudo también entra: una sede que no esté en la tabla no debe dejar al usuario
  // fuera de su propia sede.
  if (user.sedeId) formas.add(user.sedeId);
  for (const s of filas) {
    formas.add(s.id);
    formas.add(s.name);
  }
  return formas;
}
