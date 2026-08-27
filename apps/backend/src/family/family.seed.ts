import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import {
  DataSource,
  DeepPartial,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Sede } from '../sedes/entities/sede.entity';
import { FamilyLink } from './entities/family-link.entity';
import { FamilySession } from './entities/family-session.entity';
import { SessionAttendance } from './entities/session-attendance.entity';

// Seed propio de HU-11. Va aparte de src/seed.ts para no tocar un archivo compartido:
// se ejecuta después de `pnpm run seed` y sólo agrega lo del portal familiar.
//
//   cd apps/backend
//   node --env-file=.env --require ts-node/register src/family/family.seed.ts

const DEV_PASSWORD = 'Stopbet2026!';

// Paciente creado por src/seed.ts (Carlos Demo, sede Santiago).
const DEMO_PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const PATIENT2_ID     = '44444444-4444-4444-4444-444444444444';

const FAMILY_ACTIVE_ID  = 'f1000000-0000-0000-0000-000000000001';
const FAMILY_PENDING_ID = 'f1000000-0000-0000-0000-000000000002';
const FAMILY_EMPTY_ID   = 'f1000000-0000-0000-0000-000000000003';

// Paciente propio de este seed, en otra sede, para poder demostrar CA 11.5
// sin alterar los pacientes que crea src/seed.ts.
const REMOTE_PATIENT_ID = 'f1000000-0000-0000-0000-000000000004';

const SESSION_PAST_ID   = 'f2000000-0000-0000-0000-000000000001';
const SESSION_SOON_ID   = 'f2000000-0000-0000-0000-000000000002';
const SESSION_ONLINE_ID = 'f2000000-0000-0000-0000-000000000003';
const SESSION_LATER_ID  = 'f2000000-0000-0000-0000-000000000004';
const SESSION_FAR_ID    = 'f2000000-0000-0000-0000-000000000005';

function daysFromNow(days: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function upsert<T extends ObjectLiteral>(
  repo: Repository<T>,
  data: DeepPartial<T> & { id: string },
  label: string,
): Promise<void> {
  // TS no puede probar que `{ id }` encaje en FindOptionsWhere<T> para un T genérico;
  // todas las entidades de este seed tienen `id: string`.
  const existing = await repo.findOne({
    where: { id: data.id } as unknown as FindOptionsWhere<T>,
  });
  if (existing) {
    await repo.save(repo.merge(existing, data));
    console.log(`  → ${label} (actualizado)`);
  } else {
    await repo.save(repo.create(data));
    console.log(`  ✓ ${label}`);
  }
}

async function seedFamily(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User, Sede, FamilyLink, FamilySession, SessionAttendance],
    synchronize: true,
    logging: false,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  await ds.initialize();
  console.log('\nConectado a la base de datos.\n');

  const userRepo       = ds.getRepository(User);
  const linkRepo       = ds.getRepository(FamilyLink);
  const sessionRepo    = ds.getRepository(FamilySession);
  const attendanceRepo = ds.getRepository(SessionAttendance);

  const demoPatient = await userRepo.findOne({ where: { id: DEMO_PATIENT_ID } });
  if (!demoPatient) {
    throw new Error('Falta el paciente demo. Corre primero `pnpm run seed` desde la raíz.');
  }

  // Las sedes se resuelven contra la BD: `sedeId` guarda el UUID de la tabla `sedes`,
  // no el nombre. Hardcodearlo deja al familiar sin sesiones sin ningún error visible.
  const localSedeId = demoPatient.sedeId;
  if (!localSedeId) {
    throw new Error('El paciente demo no tiene sede asignada. Vuelve a correr `pnpm run seed`.');
  }

  // `users.sedeId` no es consistente en el proyecto: src/seed.ts guarda el nombre
  // ("Santiago") y scripts/populate_db.py guardaba el UUID de la tabla sedes. Se
  // aceptan ambos para no depender de con cuál se haya sembrado la base.
  const sedes = await ds.getRepository(Sede).find();
  const localSede = sedes.find((s) => s.id === localSedeId || s.name === localSedeId);
  if (!localSede) {
    throw new Error(
      `El paciente demo apunta a la sede "${localSedeId}", que no existe en la tabla sedes. ` +
        'Revisa src/seed.ts: sin una sede real las sesiones quedan sin lugar.',
    );
  }

  const remoteSede =
    sedes.find((s) => s.id !== localSede.id && /vi(ñ|n)a/i.test(s.name)) ??
    sedes.find((s) => s.id !== localSede.id);
  if (!remoteSede) {
    throw new Error('Se necesitan al menos 2 sedes para poder demostrar la CA 11.5.');
  }
  const remoteSedeId = remoteSede.id;

  const describe = (sede: Sede): string => `${sede.name} — ${sede.address}`;
  const localPlace  = describe(localSede);
  const remotePlace = describe(remoteSede);

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  console.log('── Familiares ────────────────────────────');

  await upsert(userRepo, {
    id: FAMILY_ACTIVE_ID,
    email: 'patricia.gomez@stopbet.cl',
    passwordHash,
    role: 'family',
    firstName: 'Patricia',
    lastName: 'Gómez',
    phone: '+56933445566',
    sedeId: localSedeId,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  }, 'Patricia Gómez — familiar con vínculo activo (CA 11.1, 11.3, 11.4)');

  await upsert(userRepo, {
    id: FAMILY_PENDING_ID,
    email: 'rodrigo.munoz@stopbet.cl',
    passwordHash,
    role: 'family',
    firstName: 'Rodrigo',
    lastName: 'Muñoz',
    phone: '+56944556677',
    sedeId: localSedeId,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  }, 'Rodrigo Muñoz — vínculo pendiente (CA 11.6)');

  await upsert(userRepo, {
    id: FAMILY_EMPTY_ID,
    email: 'elena.vidal@stopbet.cl',
    passwordHash,
    role: 'family',
    firstName: 'Elena',
    lastName: 'Vidal',
    phone: '+56955667799',
    sedeId: remoteSedeId,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  }, 'Elena Vidal — sin sesiones en 4 semanas (CA 11.5)');

  await upsert(userRepo, {
    id: REMOTE_PATIENT_ID,
    email: 'ignacio.vidal@stopbet.cl',
    passwordHash,
    role: 'patient',
    firstName: 'Ignacio',
    lastName: 'Vidal',
    phone: '+56966778899',
    sedeId: remoteSedeId,
    daysStreak: 8,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  }, `Ignacio Vidal — paciente en ${remoteSede.name}`);

  console.log('\n── Vínculos ──────────────────────────────');

  const links: Array<[string, string, 'active' | 'pending', string]> = [
    [FAMILY_ACTIVE_ID, DEMO_PATIENT_ID, 'active', 'Patricia → Carlos Demo (activo)'],
    [FAMILY_PENDING_ID, PATIENT2_ID, 'pending', 'Rodrigo → Pedro Álvarez (pendiente)'],
    [FAMILY_EMPTY_ID, REMOTE_PATIENT_ID, 'active', 'Elena → Ignacio Vidal (activo, otra sede)'],
  ];

  for (const [familyUserId, patientUserId, status, label] of links) {
    const existing = await linkRepo.findOne({ where: { familyUserId, patientUserId } });
    if (existing) {
      existing.status = status;
      await linkRepo.save(existing);
      console.log(`  → ${label} (actualizado)`);
    } else {
      await linkRepo.save(linkRepo.create({ familyUserId, patientUserId, status }));
      console.log(`  ✓ ${label}`);
    }
  }

  console.log('\n── Sesiones grupales ─────────────────────');

  // La sesión pasada comprueba que getSessionsForFamily la filtra (CA 11.1).
  await upsert(sessionRepo, {
    id: SESSION_PAST_ID,
    title: 'Grupo de apoyo para familias',
    sessionDate: daysFromNow(-6, 19),
    location: localPlace,
    isOnline: false,
    sedeId: localSedeId,
  }, 'Sesión pasada (no debe aparecer)');

  await upsert(sessionRepo, {
    id: SESSION_SOON_ID,
    title: 'Grupo de apoyo para familias',
    sessionDate: daysFromNow(2, 19),
    location: localPlace,
    isOnline: false,
    sedeId: localSedeId,
  }, 'En 2 días — presencial');

  await upsert(sessionRepo, {
    id: SESSION_ONLINE_ID,
    title: 'Taller: cómo acompañar sin controlar',
    sessionDate: daysFromNow(9, 20),
    location: 'Videollamada (el enlace llega por correo)',
    isOnline: true,
    sedeId: localSedeId,
  }, 'En 9 días — online');

  await upsert(sessionRepo, {
    id: SESSION_LATER_ID,
    title: 'Círculo de familiares',
    sessionDate: daysFromNow(21, 18),
    location: localPlace,
    isOnline: false,
    sedeId: localSedeId,
  }, 'En 21 días — presencial');

  // Fuera de la ventana de 4 semanas: Elena debe ver el mensaje de CA 11.5.
  await upsert(sessionRepo, {
    id: SESSION_FAR_ID,
    title: 'Jornada de familias',
    sessionDate: daysFromNow(45, 17),
    location: remotePlace,
    isOnline: false,
    sedeId: remoteSedeId,
  }, 'En 45 días — fuera de la ventana de 4 semanas');

  console.log('\n── Asistencias ───────────────────────────');

  const existingAttendance = await attendanceRepo.findOne({
    where: { sessionId: SESSION_SOON_ID, familyUserId: FAMILY_ACTIVE_ID },
  });
  if (!existingAttendance) {
    await attendanceRepo.save(
      attendanceRepo.create({
        sessionId: SESSION_SOON_ID,
        familyUserId: FAMILY_ACTIVE_ID,
        confirmed: true,
      }),
    );
    console.log('  ✓ Patricia confirmó la sesión de en 2 días');
  } else {
    console.log('  → Patricia ya tenía respuesta registrada');
  }

  await ds.destroy();

  console.log(`
Listo. Cuentas de familiar (clave: ${DEV_PASSWORD})

  patricia.gomez@stopbet.cl   vínculo activo   → 3 sesiones, 1 ya confirmada
  rodrigo.munoz@stopbet.cl    vínculo pendiente → CA 11.6
  elena.vidal@stopbet.cl      activo sin sesiones próximas → CA 11.5
`);
}

seedFamily().catch((err) => {
  console.error('\nEl seed de familia falló:', err.message);
  process.exit(1);
});
