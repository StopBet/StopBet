import { EntityManager } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { FamilySession } from './entities/family-session.entity';
import { SessionAttendance } from './entities/session-attendance.entity';

// Sesiones de demo del portal del familiar (HdU11). Las usan dos caminos:
//  - `pnpm run seed:family`, que las deja con fechas relativas al día en que se corre.
//  - `DemoService` al arrancar el backend y cada madrugada, que crea las que falten y mueve
//    hacia adelante las que ya pasaron. Sin esto la base de Railway, sembrada una sola vez,
//    se quedaba sin sesiones próximas a las pocas semanas y el portal se veía vacío.

export const DEMO_PATIENT_ID = '11111111-1111-1111-1111-111111111111';

export const FAMILY_ACTIVE_ID = 'f1000000-0000-0000-0000-000000000001';
export const FAMILY_EXTRA_IDS = [
  'f1000000-0000-0000-0000-000000000011',
  'f1000000-0000-0000-0000-000000000012',
  'f1000000-0000-0000-0000-000000000013',
  'f1000000-0000-0000-0000-000000000014',
  'f1000000-0000-0000-0000-000000000015',
] as const;

export const SESSION_PAST_ID      = 'f2000000-0000-0000-0000-000000000001';
export const SESSION_SOON_ID      = 'f2000000-0000-0000-0000-000000000002';
export const SESSION_ONLINE_ID    = 'f2000000-0000-0000-0000-000000000003';
export const SESSION_LATER_ID     = 'f2000000-0000-0000-0000-000000000004';
export const SESSION_FAR_ID       = 'f2000000-0000-0000-0000-000000000005';
export const SESSION_MANDATORY_ID = 'f2000000-0000-0000-0000-000000000006';
export const SESSION_FINANCES_ID  = 'f2000000-0000-0000-0000-000000000007';
export const SESSION_SUPPORT2_ID  = 'f2000000-0000-0000-0000-000000000008';
export const SESSION_TALK_ID      = 'f2000000-0000-0000-0000-000000000009';

interface DemoSessionDef {
  id: string;
  title: string;
  /** Días desde hoy, en Chile. Negativo es una sesión ya pasada. */
  days: number;
  /** Hora de inicio en Chile. */
  hour: number;
  online?: boolean;
  mandatory?: boolean;
  /** En la otra sede: la de Elena, que no debe ver sesiones próximas (CA 11.5). */
  remote?: boolean;
  label: string;
}

const ONLINE_PLACE = 'Videollamada (el enlace llega por correo)';

export const FAMILY_DEMO_SESSIONS: DemoSessionDef[] = [
  // Comprueba que getSessionsForFamily filtra las pasadas (CA 11.1).
  { id: SESSION_PAST_ID, title: 'Grupo de apoyo para familias', days: -6, hour: 19, label: 'Sesión pasada (no debe aparecer)' },
  { id: SESSION_SOON_ID, title: 'Grupo de apoyo para familias', days: 2, hour: 19, label: 'En 2 días, presencial' },
  // Obligatoria: parte del tratamiento del paciente, para ver la diferencia con las opcionales.
  { id: SESSION_MANDATORY_ID, title: 'Sesión familiar del proceso terapéutico', days: 5, hour: 18, mandatory: true, label: 'En 5 días, obligatoria' },
  { id: SESSION_ONLINE_ID, title: 'Taller: cómo acompañar sin controlar', days: 9, hour: 20, online: true, label: 'En 9 días, online' },
  { id: SESSION_FINANCES_ID, title: 'Charla: ordenar las finanzas de la familia', days: 12, hour: 19, online: true, label: 'En 12 días, online' },
  { id: SESSION_SUPPORT2_ID, title: 'Grupo de apoyo para familias', days: 16, hour: 19, label: 'En 16 días, presencial' },
  { id: SESSION_LATER_ID, title: 'Círculo de familiares', days: 21, hour: 18, label: 'En 21 días, presencial' },
  { id: SESSION_TALK_ID, title: 'Taller: conversar sin reproches', days: 26, hour: 18, label: 'En 26 días, presencial' },
  // Fuera de la ventana de 4 semanas y en otra sede: Elena debe ver el mensaje de CA 11.5.
  { id: SESSION_FAR_ID, title: 'Jornada de familias', days: 45, hour: 17, remote: true, label: 'En 45 días, fuera de la ventana de 4 semanas' },
];

// Reparto de respuestas: cada sesión con una mezcla distinta de confirmados y rechazos, para
// que los contadores de la vista del psicólogo no se vean todos iguales.
const DEMO_ANSWERS: Array<[string, string, boolean]> = [
  [SESSION_SOON_ID, FAMILY_ACTIVE_ID, true],
  [SESSION_SOON_ID, FAMILY_EXTRA_IDS[0], true],
  [SESSION_SOON_ID, FAMILY_EXTRA_IDS[1], true],
  [SESSION_SOON_ID, FAMILY_EXTRA_IDS[2], false],
  [SESSION_SOON_ID, FAMILY_EXTRA_IDS[3], true],

  [SESSION_ONLINE_ID, FAMILY_EXTRA_IDS[0], true],
  [SESSION_ONLINE_ID, FAMILY_EXTRA_IDS[2], true],
  [SESSION_ONLINE_ID, FAMILY_EXTRA_IDS[4], false],

  [SESSION_FINANCES_ID, FAMILY_EXTRA_IDS[1], true],
  [SESSION_FINANCES_ID, FAMILY_EXTRA_IDS[3], true],

  [SESSION_SUPPORT2_ID, FAMILY_EXTRA_IDS[0], false],
  [SESSION_SUPPORT2_ID, FAMILY_EXTRA_IDS[4], true],

  [SESSION_LATER_ID, FAMILY_EXTRA_IDS[1], false],
  [SESSION_LATER_ID, FAMILY_EXTRA_IDS[3], true],
  [SESSION_LATER_ID, FAMILY_EXTRA_IDS[4], true],
];

const CHILE_TZ = 'America/Santiago';

/** Minutos que Chile está detrás de UTC en ese instante (180 o 240, según el horario de verano). */
function chileOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHILE_TZ,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((at.getTime() - asUtc) / 60_000);
}

/**
 * El instante en que en Chile son las `hour`:00 de dentro de `days` días.
 *
 * Railway corre en UTC: un `setHours(19)` en el servidor daba una sesión a las 15:00 o 16:00
 * de Chile.
 */
export function chileDateAt(days: number, hour: number, now: Date = new Date()): Date {
  const day = new Date(now.getTime() + days * 86_400_000);
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: CHILE_TZ })
    .format(day)
    .split('-')
    .map(Number);
  const naive = new Date(Date.UTC(y, m - 1, d, hour, 0, 0));
  return new Date(naive.getTime() + chileOffsetMinutes(naive) * 60_000);
}

export interface EnsureSessionsResult {
  /** Por qué no se hizo nada, si no se hizo. */
  skipped?: string;
  created: string[];
  moved: string[];
  answers: number;
}

/**
 * Deja las sesiones de demo en la sede de Carlos Demo.
 *
 * - `resetDates: true` (el seed): todas quedan con fechas relativas a hoy.
 * - `resetDates: false` (al arrancar): solo crea las que falten y mueve hacia adelante las
 *   próximas que ya pasaron. Una sesión vigente no se toca, así no cambia de fecha con cada
 *   despliegue.
 *
 * Idempotente. No crea usuarios: las respuestas de asistencia se agregan solo para los
 * familiares que ya existen.
 */
export async function ensureFamilyDemoSessions(
  em: EntityManager,
  { resetDates, now = new Date() }: { resetDates: boolean; now?: Date },
): Promise<EnsureSessionsResult> {
  const result: EnsureSessionsResult = { created: [], moved: [], answers: 0 };

  const demoPatient = await em.getRepository(User).findOne({ where: { id: DEMO_PATIENT_ID } });
  if (!demoPatient) return { ...result, skipped: 'falta el paciente demo (corre `pnpm run seed`)' };

  // Las sesiones se guardan con el `sedeId` tal como lo tiene el paciente, porque
  // getSessionsForFamily las busca por igualdad con ese valor. `users.sedeId` guarda el
  // nombre o el UUID según de dónde venga la cuenta: la sede se resuelve aceptando ambos.
  const localSedeId = demoPatient.sedeId;
  if (!localSedeId) return { ...result, skipped: 'el paciente demo no tiene sede' };

  const sedes = await em.getRepository(Sede).find();
  const localSede = sedes.find((s) => s.id === localSedeId || s.name === localSedeId);
  if (!localSede) return { ...result, skipped: `la sede "${localSedeId}" no existe en la tabla sedes` };

  const remoteSede =
    sedes.find((s) => s.id !== localSede.id && /vi(ñ|n)a/i.test(s.name)) ??
    sedes.find((s) => s.id !== localSede.id);

  const place = (sede: Sede): string => `${sede.name}, ${sede.address}`;
  const sessionRepo = em.getRepository(FamilySession);

  for (const def of FAMILY_DEMO_SESSIONS) {
    if (def.remote && !remoteSede) continue;
    const sede = def.remote ? remoteSede! : localSede;
    const sedeId = def.remote ? remoteSede!.id : localSedeId;
    const sessionDate = chileDateAt(def.days, def.hour, now);

    const existing = await sessionRepo.findOne({ where: { id: def.id } });
    if (!existing) {
      await sessionRepo.save(sessionRepo.create({
        id: def.id,
        title: def.title,
        sessionDate,
        location: def.online ? ONLINE_PLACE : place(sede),
        isOnline: def.online ?? false,
        isMandatory: def.mandatory ?? false,
        sedeId,
      }));
      result.created.push(def.label);
      continue;
    }

    const vencida = def.days >= 0 && existing.sessionDate.getTime() < now.getTime();
    if (resetDates || vencida) {
      existing.sessionDate = sessionDate;
      await sessionRepo.save(existing);
      result.moved.push(def.label);
    }
  }

  const userRepo = em.getRepository(User);
  const attendanceRepo = em.getRepository(SessionAttendance);
  for (const [sessionId, familyUserId, confirmed] of DEMO_ANSWERS) {
    if (!(await userRepo.exist({ where: { id: familyUserId } }))) continue;
    if (await attendanceRepo.exist({ where: { sessionId, familyUserId } })) continue;
    await attendanceRepo.save(attendanceRepo.create({ sessionId, familyUserId, confirmed }));
    result.answers++;
  }

  return result;
}
