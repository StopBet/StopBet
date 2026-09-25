import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import {
  DataSource,
  DeepPartial,
  FindOptionsWhere,
  IsNull,
  ObjectLiteral,
  Repository,
} from 'typeorm';

import { User } from './users/entities/user.entity';
import { CheckIn } from './check-ins/entities/check-in.entity';
import { CommunityMute } from './notifications/entities/community-mute.entity';
import { AbstinencePeriod } from './achievements/entities/abstinence-period.entity';
import { EarnedBadge } from './achievements/entities/earned-badge.entity';
import { CommunityPost } from './community/entities/community-post.entity';
import { PostReport } from './community/entities/post-report.entity';
import { SponsorAssignment } from './panic/entities/sponsor-assignment.entity';
import { PanicAlert } from './panic/entities/panic-alert.entity';
import { todayInChile, daysAgoInChile } from './common/chile-date';

// Cuentas de prueba para el video de usuario ([E4], Sprint 1, video-usuario-sprint1.pdf).
// Va aparte de demo.seed.ts porque esa cuenta (Carlos) está pensada para UNA persona: la
// primera de 3 participantes seguidos dejaría el check-in de hoy hecho, su post borrado,
// posts reportados y una alerta de pánico, y el segundo ya no arrancaría del mismo punto de
// partida que el primero.
//
//   pnpm run seed
//   pnpm run seed:usuarios -- --reset
//
// Requiere que ya exista Daniela Soto (compañera de viaje, id de seed.ts) — si falta, corre
// primero `pnpm run seed`.
//
// --reset deja repetibles los criterios que la propia sesión de grabación ensucia: borra el
// check-in de hoy, cancela alertas colgadas, y borra los posts/reportes que cada participante
// dejó en las tareas 2 y 4. Sin esta bandera esos datos no se tocan. Caduca cada 24 h, igual
// que --reset de seed:demo: hay que correrlo la mañana de la grabación.

const SPONSOR_ID = '22222222-2222-2222-2222-222222222222'; // Daniela Soto (seed.ts)
const SANTIAGO_SEDE = 'Santiago';
const DEV_PASSWORD = 'Stopbet2026!';
const DAYS_STREAK = 20;
const CHECKIN_DAYS_BACK = 7; // días previos con check-in; nunca el de hoy (Tarea 1 CA1-3)

const PARTICIPANTS = [
  { id: 'e0000000-0000-0000-0000-000000000001', email: 'prueba1@stopbet.cl', firstName: 'Martín', lastName: 'Aravena' },
  { id: 'e0000000-0000-0000-0000-000000000002', email: 'prueba2@stopbet.cl', firstName: 'Constanza', lastName: 'Figueroa' },
  { id: 'e0000000-0000-0000-0000-000000000003', email: 'prueba3@stopbet.cl', firstName: 'Ignacio', lastName: 'Salinas' },
];

async function upsert<T extends ObjectLiteral>(
  repo: Repository<T>,
  data: DeepPartial<T> & { id: string },
  label: string,
): Promise<void> {
  const existing = await repo.findOne({ where: { id: data.id } as unknown as FindOptionsWhere<T> });
  if (existing) {
    await repo.save(repo.merge(existing, data));
    console.log(`  → ${label} (actualizado)`);
  } else {
    await repo.save(repo.create(data));
    console.log(`  ✓ ${label}`);
  }
}

async function seedUsuariosPrueba(): Promise<void> {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');

  const url = process.env.DATABASE_URL ?? '';
  const ds = new DataSource({
    type: 'postgres',
    url,
    entities: [
      User, CheckIn, AbstinencePeriod, EarnedBadge, CommunityPost, PostReport,
      SponsorAssignment, PanicAlert, CommunityMute,
    ],
    // A diferencia de demo.seed.ts: las tablas ya existen en producción, y con
    // synchronize:true cualquier diferencia entre las entidades de esta rama y lo
    // desplegado alteraría el esquema de Railway. Este script solo hace CRUD.
    synchronize: false,
    logging: false,
    // Sirve tanto para el DATABASE_URL público de Railway (que trae `sslmode=require`)
    // como para una base local sin SSL.
    ssl: /sslmode=require/i.test(url) || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  });

  await ds.initialize();
  console.log('\nConectado a la base de datos.\n');

  const userRepo = ds.getRepository(User);
  const checkInRepo = ds.getRepository(CheckIn);
  const periodRepo = ds.getRepository(AbstinencePeriod);
  const postRepo = ds.getRepository(CommunityPost);
  const reportRepo = ds.getRepository(PostReport);
  const sponsorRepo = ds.getRepository(SponsorAssignment);
  const panicRepo = ds.getRepository(PanicAlert);
  const muteRepo = ds.getRepository(CommunityMute);

  const sponsor = await userRepo.findOne({ where: { id: SPONSOR_ID } });
  if (!sponsor) {
    throw new Error(
      'Falta Daniela Soto (compañera de viaje). Corre primero `pnpm run seed` desde la raíz.',
    );
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  console.log('── Cuentas de prueba (video de usuario) ────');
  for (const p of PARTICIPANTS) {
    await upsert(userRepo, {
      id: p.id,
      email: p.email,
      passwordHash,
      role: 'patient',
      firstName: p.firstName,
      lastName: p.lastName,
      sedeId: SANTIAGO_SEDE,
      daysStreak: DAYS_STREAK,
      accountStatus: 'active',
      onboardingStatus: 'complete',
    }, `${p.firstName} ${p.lastName} (${p.email})`);

    // Compañera de viaje activa — Tarea 4 (pedir ayuda urgente) necesita que la alerta
    // nazca 'pending' en vez de escalar directo a la IA.
    const existingSponsor = await sponsorRepo.findOne({
      where: { patientId: p.id, sponsorId: SPONSOR_ID },
    });
    if (existingSponsor) {
      if (!existingSponsor.isActive) {
        await sponsorRepo.update(existingSponsor.id, { isActive: true });
        console.log(`  → Compañera de viaje reactivada: ${p.firstName}`);
      }
    } else {
      await sponsorRepo.save(
        sponsorRepo.create({ patientId: p.id, sponsorId: SPONSOR_ID, isActive: true }),
      );
      console.log(`  ✓ Compañera de viaje asignada: ${p.firstName} → Daniela`);
    }

    // Período de abstinencia abierto, para que la Home muestre una racha real en vez de 0.
    const existingPeriod = await periodRepo.findOne({ where: { userId: p.id, endDate: IsNull() } });
    if (!existingPeriod) {
      await periodRepo.save(periodRepo.create({
        userId: p.id, startDate: daysAgoInChile(DAYS_STREAK), endDate: null, attemptNumber: 1,
      }));
      console.log(`  ✓ Período de abstinencia abierto: ${p.firstName} (${DAYS_STREAK} días)`);
    }

    // Check-ins de días anteriores. Nunca el de hoy: la Tarea 1 tiene que arrancar sin hacer.
    let created = 0;
    for (let i = CHECKIN_DAYS_BACK; i >= 1; i--) {
      const date = daysAgoInChile(i);
      const existing = await checkInRepo.findOne({ where: { userId: p.id, date } });
      if (!existing) {
        await checkInRepo.save(checkInRepo.create({ userId: p.id, date, emotion: 'good' }));
        created++;
      }
    }
    if (created > 0) console.log(`  ✓ ${created} check-in(s) de días anteriores: ${p.firstName}`);
  }

  if (reset) {
    console.log('\n── --reset ───────────────────────────────');
    for (const p of PARTICIPANTS) {
      await sponsorRepo.update({ patientId: p.id, sponsorId: SPONSOR_ID }, { isActive: true });

      const stray = await panicRepo.find({
        where: [
          { patientId: p.id, status: 'pending' },
          { patientId: p.id, status: 'escalated' },
        ],
      });
      for (const alert of stray) {
        await panicRepo.update(alert.id, { status: 'cancelled', cancelledAt: new Date() });
      }
      if (stray.length > 0) {
        console.log(`  ✓ ${stray.length} alerta(s) colgada(s) de ${p.firstName} canceladas`);
      }

      const todayCheckIn = await checkInRepo.findOne({
        where: { userId: p.id, date: todayInChile() },
      });
      if (todayCheckIn) {
        await checkInRepo.delete(todayCheckIn.id);
        console.log(`  ✓ Check-in de hoy de ${p.firstName} eliminado`);
      }

      const mute = await muteRepo.findOne({ where: { userId: p.id } });
      if (mute) {
        await muteRepo.delete({ userId: p.id });
        console.log(`  ✓ Silencio de comunidad de ${p.firstName} removido`);
      }

      const ownReports = await reportRepo.find({ where: { reporterId: p.id } });
      for (const r of ownReports) {
        await reportRepo.delete(r.id);
        await postRepo.decrement({ id: r.postId }, 'reportCount', 1);
      }
      if (ownReports.length > 0) {
        console.log(`  ✓ ${ownReports.length} reporte(s) de ${p.firstName} removidos`);
      }

      const ownPosts = await postRepo.find({ where: { authorId: p.id } });
      for (const post of ownPosts) {
        await postRepo.delete(post.id);
      }
      if (ownPosts.length > 0) {
        console.log(`  ✓ ${ownPosts.length} publicación(es) de ${p.firstName} eliminadas`);
      }
    }
  }

  await ds.destroy();

  console.log('\n════════════════════════════════════════════');
  console.log('  Cuentas de prueba listas (video de usuario, Sprint 1)');
  console.log('');
  console.log(`  Clave de las 3: ${DEV_PASSWORD}`);
  for (const p of PARTICIPANTS) {
    console.log(`    ${p.firstName} ${p.lastName}: ${p.email}`);
  }
  console.log('');
  console.log('  --reset caduca cada 24 h (igual que seed:demo). Corre');
  console.log('  `pnpm run seed:usuarios -- --reset` la mañana de la grabación.');
  console.log('════════════════════════════════════════════\n');
}

seedUsuariosPrueba().catch((err) => {
  console.error('\nError en seed:usuarios:', err.message);
  console.error(err.stack);
  process.exit(1);
});
