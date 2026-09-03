import 'reflect-metadata';
import {
  DataSource,
  DeepPartial,
  FindOptionsWhere,
  IsNull,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { EmotionType, isValidRut } from '@stopbet/shared-types';

import { User } from './users/entities/user.entity';
import { CheckIn } from './check-ins/entities/check-in.entity';
import { Notification } from './notifications/entities/notification.entity';
import { CommunityMute } from './notifications/entities/community-mute.entity';
import { Sede } from './sedes/entities/sede.entity';
import { RegistrationRequest } from './registration/entities/registration-request.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { AbstinencePeriod } from './achievements/entities/abstinence-period.entity';
import { EarnedBadge } from './achievements/entities/earned-badge.entity';
import { ValidatedMessage } from './achievements/entities/validated-message.entity';
import { CommunityPost } from './community/entities/community-post.entity';
import { PostReply } from './community/entities/post-reply.entity';
import { PostReaction } from './community/entities/post-reaction.entity';
import { PostReport } from './community/entities/post-report.entity';
import { AttendanceConfirmation } from './community/entities/attendance-confirmation.entity';
import { Invoice } from './billing/entities/invoice.entity';
import { AiSession } from './ai-assistant/entities/ai-session.entity';
import { AiMessage } from './ai-assistant/entities/ai-message.entity';
import { AiSessionSummary } from './ai-assistant/entities/ai-session-summary.entity';
import { SponsorAssignment } from './panic/entities/sponsor-assignment.entity';
import { PanicAlert } from './panic/entities/panic-alert.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { DeviceToken } from './push/entities/device-token.entity';
import { FamilyLink } from './family/entities/family-link.entity';
import { FamilySession } from './family/entities/family-session.entity';
import { SessionAttendance } from './family/entities/session-attendance.entity';
import { PsychologistSede } from './psychologists/entities/psychologist-sede.entity';
import { PatientAssignment } from './psychologists/entities/patient-assignment.entity';
import { todayInChile, daysAgoInChile } from './common/chile-date';

// Seed de demo para la revisión en vivo del Sprint 1 (docs/planning/SPRINT1.md).
// Va aparte de src/seed.ts y src/family/family.seed.ts para no tocarlos: solo AGREGA lo
// que esos dos no pueblan nunca (patient_assignments, psychologist_sedes,
// registration_requests, notifications, subscriptions/invoices) y refresca lo que caduca
// en 24 h (alertas de pánico "de hoy"). Se corre después de los otros dos:
//
//   pnpm run seed
//   pnpm run seed:family
//   pnpm run seed:demo -- --reset
//
// --reset       deja repetibles los criterios que un paso en vivo de la demo ensucia
//               (check-in de hoy, alerta colgada, insignia ya compartida, reportes propios,
//               silenciar comunidad). Sin esta bandera esos datos no se tocan.
// --sin-padrino desactiva el padrino de Carlos para demostrar CA 1.2. Volver a correr el
//               seed sin la bandera (o con --reset) lo reactiva.

// ── IDs de src/seed.ts (no se recrean acá, solo se referencian) ──────────────
const DEMO_USER_ID = '11111111-1111-1111-1111-111111111111'; // Carlos Demo (paciente)
const SPONSOR_ID = '22222222-2222-2222-2222-222222222222'; // Daniela Soto (padrino)
const PSYCHOLOGIST_ID = '33333333-3333-3333-3333-333333333333'; // Miguel Ángel Lara
const PATIENT2_ID = '44444444-4444-4444-4444-444444444444'; // Pedro Álvarez
const PATIENT3_ID = '55555555-5555-5555-5555-555555555555'; // Ana Pérez
const PATIENT4_ID = '66666666-6666-6666-6666-666666666666'; // Roberto Fuentes
const REPORTER1_ID = '77777777-7777-7777-7777-777777777777'; // Jorge Morales
const REPORTER2_ID = '88888888-8888-8888-8888-888888888888'; // Lucía Vega
const PSYCHOLOGIST_2_ID = 'aaaaaaaa-0002-0000-0000-000000000000'; // Valentina Rojas
const PSYCHOLOGIST_3_ID = 'aaaaaaaa-0003-0000-0000-000000000000'; // Tomás Herrera
const PSYCHOLOGIST_4_ID = 'aaaaaaaa-0004-0000-0000-000000000000'; // Camila Soto (suspended)

const DEV_PASSWORD = 'Stopbet2026!';
const SANTIAGO_SEDE = 'Santiago';
const VINA_SEDE = 'Viña del Mar';
const CONCEPCION_SEDE = 'Concepción';

// Las mismas 4 sedes que siembra SedesService.onModuleInit (sedes/sedes.service.ts). Se
// repiten acá por si este script corre antes de que el backend haya arrancado nunca contra
// esta base — si no, `sedeRepo.find()` vuelve vacío y todo lo que depende de una sede real
// (registration_requests, psychologist_sedes, patient_assignments) no tiene dónde apuntar.
const BASE_SEDES = [
  { name: SANTIAGO_SEDE, address: 'Av. Providencia 123', activeGroups: 12, type: 'presential' as const },
  { name: VINA_SEDE, address: 'Calle Valparaíso 456', activeGroups: 8, type: 'presential' as const },
  { name: CONCEPCION_SEDE, address: "Av. O'Higgins 789", activeGroups: 6, type: 'presential' as const },
  { name: 'Online', address: 'Sesiones virtuales desde cualquier lugar', activeGroups: 4, type: 'online' as const },
];

// ── IDs nuevos de este seed ───────────────────────────────────────────────────
const NEW_PATIENT_1_ID = 'd0000000-0000-0000-0000-000000000001'; // Fernanda Castro (Santiago)
const NEW_PATIENT_2_ID = 'd0000000-0000-0000-0000-000000000002'; // Diego Rojas (Santiago)
const NEW_PATIENT_3_ID = 'd0000000-0000-0000-0000-000000000003'; // Camila Torres (Viña del Mar)
const REQUEST_1_ID = 'd0000000-0000-0000-0000-000000000101';
const REQUEST_2_ID = 'd0000000-0000-0000-0000-000000000102';
const REQUEST_3_ID = 'd0000000-0000-0000-0000-000000000103';

// Ninguna se siembra en estado 'pending' a propósito: panic.service.ts corre un @Cron
// cada 10 s que escala CUALQUIER alerta 'pending' con más de 120 s (CA 1.3), sin mirar si
// tiene padrino o no. Con el backend de Railway corriendo siempre, una 'pending' sembrada
// se ve segundos después como 'escalated' — mejor sembrarla ya resuelta y usar el botón de
// pánico en vivo (Carlos) para mostrar el estado 'pending' real, que sí dura los ~120 s.
const ALERT_ROBERTO_ID = 'd0000000-0000-0000-0000-000000000010'; // hoy, escalada
const ALERT_JORGE_ID = 'd0000000-0000-0000-0000-000000000011'; // hoy, escalada
const ALERT_ANA_ID = 'd0000000-0000-0000-0000-000000000012'; // hoy, respondida

const POST_CARLOS_ID = 'd0000000-0000-0000-0000-000000000020'; // para 5.4 y 5.5 en vivo
const POST_ANNOUNCEMENT_ID = 'd0000000-0000-0000-0000-000000000021'; // evento futuro
const POST_CLEAN_1_ID = 'd0000000-0000-0000-0000-000000000022'; // para reportar en vivo (5.3)
const POST_CLEAN_2_ID = 'd0000000-0000-0000-0000-000000000023'; // para reportar en vivo (5.3)
const POST_FLAGGED_2_ID = 'd0000000-0000-0000-0000-000000000024'; // segundo caso de moderación

function daysFromNowInChile(days: number): string {
  return daysAgoInChile(-days);
}

// RUT módulo 11 (mismo algoritmo que packages/shared-types/src/validators/rut.ts). Genera
// un dígito verificador válido en vez de escribirlo a mano y arriesgar un typo.
function rutFor(body: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const dv = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);

  let formattedBody = '';
  for (let i = 0; i < body.length; i++) {
    const posFromEnd = body.length - i;
    formattedBody += body[i];
    if (posFromEnd > 1 && (posFromEnd - 1) % 3 === 0) formattedBody += '.';
  }
  const rut = `${formattedBody}-${dv}`;
  if (!isValidRut(rut)) throw new Error(`RUT generado inválido: ${rut}`);
  return rut;
}

// Patrones de ánimo para el gráfico de 30 días (HdU04 CA4). `i` = días atrás (mayor = más
// antiguo), `total` = tamaño de la ventana para ese paciente.
function improving(i: number, total: number): EmotionType {
  const progress = 1 - i / total;
  if (progress > 0.7) return 'good';
  if (progress > 0.4) return i % 2 === 0 ? 'good' : 'tired';
  return i % 3 === 0 ? 'lonely' : i % 3 === 1 ? 'anxious' : 'tired';
}

function declining(i: number, total: number): EmotionType {
  const progress = 1 - i / total;
  if (progress < 0.3) return 'good';
  if (progress < 0.6) return i % 2 === 0 ? 'tired' : 'good';
  return i % 3 === 0 ? 'angry' : i % 3 === 1 ? 'anxious' : 'lonely';
}

function stable(i: number): EmotionType {
  return i % 2 === 0 ? 'good' : 'tired';
}

function irregular(i: number): EmotionType {
  const cycle: EmotionType[] = ['anxious', 'good', 'tired', 'angry', 'good', 'lonely'];
  return cycle[i % cycle.length];
}

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

async function seedDemo(): Promise<void> {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const sinPadrino = args.includes('--sin-padrino');

  const url = process.env.DATABASE_URL ?? '';
  const ds = new DataSource({
    type: 'postgres',
    url,
    entities: [
      User, CheckIn, Notification, Sede,
      RegistrationRequest, Subscription,
      AbstinencePeriod, EarnedBadge, ValidatedMessage,
      CommunityPost, PostReply, PostReaction, PostReport, AttendanceConfirmation,
      Invoice,
      AiSession, AiMessage, AiSessionSummary,
      SponsorAssignment, PanicAlert,
      RefreshToken,
      DeviceToken,
      FamilyLink, FamilySession, SessionAttendance,
      CommunityMute,
      PsychologistSede, PatientAssignment,
    ],
    synchronize: true,
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
  const sedeRepo = ds.getRepository(Sede);
  const psychSedeRepo = ds.getRepository(PsychologistSede);
  const assignmentRepo = ds.getRepository(PatientAssignment);
  const requestRepo = ds.getRepository(RegistrationRequest);
  const checkInRepo = ds.getRepository(CheckIn);
  const periodRepo = ds.getRepository(AbstinencePeriod);
  const badgeRepo = ds.getRepository(EarnedBadge);
  const panicRepo = ds.getRepository(PanicAlert);
  const sponsorRepo = ds.getRepository(SponsorAssignment);
  const notifRepo = ds.getRepository(Notification);
  const postRepo = ds.getRepository(CommunityPost);
  const reportRepo = ds.getRepository(PostReport);
  const attendanceRepo = ds.getRepository(AttendanceConfirmation);
  const muteRepo = ds.getRepository(CommunityMute);
  const subRepo = ds.getRepository(Subscription);
  const invoiceRepo = ds.getRepository(Invoice);

  const demoUser = await userRepo.findOne({ where: { id: DEMO_USER_ID } });
  if (!demoUser) {
    throw new Error(
      'Falta Carlos Demo. Corre primero `pnpm run seed` (y `pnpm run seed:family`) desde la raíz.',
    );
  }

  // ── 0. Sedes ────────────────────────────────────────────────────────────────
  console.log('── Sedes ─────────────────────────────────');
  for (const s of BASE_SEDES) {
    const existing = await sedeRepo.findOne({ where: { name: s.name } });
    if (!existing) {
      await sedeRepo.save(sedeRepo.create(s));
      console.log(`  ✓ Sede creada: ${s.name}`);
    }
  }
  const santiago = await sedeRepo.findOneOrFail({ where: { name: SANTIAGO_SEDE } });
  const vina = await sedeRepo.findOneOrFail({ where: { name: VINA_SEDE } });

  // ── 1. psychologist_sedes ──────────────────────────────────────────────────
  console.log('\n── Sedes por psicólogo (HdU24) ───────────');
  const psychSedeAssignments: Array<[string, Sede, string]> = [
    [PSYCHOLOGIST_ID, santiago, 'Miguel Ángel Lara → Santiago'],
    [PSYCHOLOGIST_ID, vina, 'Miguel Ángel Lara → Viña del Mar'],
    [PSYCHOLOGIST_2_ID, santiago, 'Valentina Rojas → Santiago'],
    [PSYCHOLOGIST_3_ID, vina, 'Tomás Herrera → Viña del Mar'],
  ];
  for (const [psychologistId, sede, label] of psychSedeAssignments) {
    const existing = await psychSedeRepo.findOne({ where: { psychologistId, sedeId: sede.id } });
    if (!existing) {
      await psychSedeRepo.save(psychSedeRepo.create({ psychologistId, sedeId: sede.id }));
      console.log(`  ✓ ${label}`);
    } else {
      console.log(`  → ${label} (ya existe)`);
    }
  }
  // Camila Soto está suspendida a propósito (ver src/seed.ts); igual necesita una sede
  // en psychologist_sedes para que Equipo la muestre con datos completos.
  const concepcion = await sedeRepo.findOneOrFail({ where: { name: CONCEPCION_SEDE } });
  const camilaLink = await psychSedeRepo.findOne({
    where: { psychologistId: PSYCHOLOGIST_4_ID, sedeId: concepcion.id },
  });
  if (!camilaLink) {
    await psychSedeRepo.save(
      psychSedeRepo.create({ psychologistId: PSYCHOLOGIST_4_ID, sedeId: concepcion.id }),
    );
    console.log('  ✓ Camila Soto → Concepción');
  }

  // ── 2. patient_assignments ────────────────────────────────────────────────
  // Se recalcula en cada corrida (self-corrige si alguien reasignó en vivo el día
  // anterior): no es idempotencia por fila, es "vuelve siempre a esta base".
  console.log('\n── Pacientes asignados (HdU24) ───────────');
  async function upsertAssignment(
    patientId: string,
    psychologistId: string,
    sede: Sede,
    label: string,
  ): Promise<void> {
    const existing = await assignmentRepo.findOne({ where: { patientId, active: true } });
    if (existing && existing.psychologistId === psychologistId && existing.sedeId === sede.id) {
      console.log(`  → ${label} (ya asignado)`);
      return;
    }
    if (existing) {
      await assignmentRepo.update(existing.id, { active: false, endedAt: new Date() });
    }
    await assignmentRepo.save(
      assignmentRepo.create({ patientId, psychologistId, sedeId: sede.id, active: true, endedAt: null }),
    );
    console.log(`  ✓ ${label}`);
  }
  await upsertAssignment(DEMO_USER_ID, PSYCHOLOGIST_ID, santiago, 'Carlos Demo → Miguel (Santiago)');
  await upsertAssignment(PATIENT2_ID, PSYCHOLOGIST_ID, santiago, 'Pedro Álvarez → Miguel (Santiago)');
  // A propósito en una sede distinta a su user.sedeId legado: es lo que hace
  // demostrable CA 24.5 (quitarle Viña a Miguel exige reasignar a Ana).
  await upsertAssignment(PATIENT3_ID, PSYCHOLOGIST_ID, vina, 'Ana Pérez → Miguel (Viña del Mar)');
  await upsertAssignment(PATIENT4_ID, PSYCHOLOGIST_2_ID, santiago, 'Roberto Fuentes → Valentina (Santiago)');
  await upsertAssignment(REPORTER1_ID, PSYCHOLOGIST_2_ID, santiago, 'Jorge Morales → Valentina (Santiago)');
  await upsertAssignment(REPORTER2_ID, PSYCHOLOGIST_3_ID, vina, 'Lucía Vega → Tomás (Viña del Mar)');

  // ── 3. registration_requests pendientes (HdU06 CA6.1) ─────────────────────
  console.log('\n── Solicitudes de registro pendientes ────');
  const pendingApplicants: Array<{
    id: string; requestId: string; email: string; firstName: string; lastName: string;
    rut: string; phone: string; birthDate: string; sede: Sede;
  }> = [
    {
      id: NEW_PATIENT_1_ID, requestId: REQUEST_1_ID,
      email: 'fernanda.castro@example.cl', firstName: 'Fernanda', lastName: 'Castro',
      rut: rutFor('19876543'), phone: '+56977889900', birthDate: '1998-04-22', sede: santiago,
    },
    {
      id: NEW_PATIENT_2_ID, requestId: REQUEST_2_ID,
      email: 'diego.rojas@example.cl', firstName: 'Diego', lastName: 'Rojas',
      rut: rutFor('20123456'), phone: '+56988990011', birthDate: '2001-11-03', sede: santiago,
    },
    {
      id: NEW_PATIENT_3_ID, requestId: REQUEST_3_ID,
      email: 'camila.torres@example.cl', firstName: 'Camila', lastName: 'Torres',
      rut: rutFor('18567890'), phone: '+56999001122', birthDate: '1990-07-14', sede: vina,
    },
  ];
  for (const a of pendingApplicants) {
    await upsert(userRepo, {
      id: a.id,
      email: a.email,
      passwordHash: null,
      role: 'patient',
      firstName: a.firstName,
      lastName: a.lastName,
      rut: a.rut,
      phone: a.phone,
      birthDate: a.birthDate,
      address: 'Dirección de prueba 100',
      referralSource: 'web',
      sedeId: a.sede.id,
      onboardingStatus: 'approval_pending',
    }, `${a.firstName} ${a.lastName} — solicitante`);

    // Se fuerza a 'pending' en cada corrida: son pacientes solo-demo, y la pantalla de
    // Solicitudes necesita las 3 disponibles para aprobar/rechazar en vivo cada vez.
    await upsert(requestRepo, {
      id: a.requestId,
      userId: a.id,
      sedeId: a.sede.id,
      institutionId: 'AJUTER',
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
    }, `Solicitud de ${a.firstName} ${a.lastName} (${a.sede.name})`);
  }

  // ── 4. Check-ins de los demás pacientes (HdU04 CA4.3, CA4.4) ──────────────
  console.log('\n── Check-ins emocionales (otros pacientes) ─');
  async function seedCheckIns(
    userId: string,
    days: number,
    pattern: (i: number, total: number) => EmotionType,
    skipEvery4th: boolean,
    label: string,
  ): Promise<void> {
    let created = 0;
    for (let i = days; i >= 1; i--) {
      if (skipEvery4th && i % 4 === 0) continue;
      const date = daysAgoInChile(i);
      const existing = await checkInRepo.findOne({ where: { userId, date } });
      if (!existing) {
        await checkInRepo.save(
          checkInRepo.create({ userId, date, emotion: pattern(i, days) }),
        );
        created++;
      }
    }
    console.log(created > 0 ? `  ✓ ${created} check-ins creados: ${label}` : `  → Check-ins ya existen: ${label}`);
  }
  // Roberto (PATIENT4_ID) se deja sin ningún check-in a propósito: es el paciente con el
  // que se demuestra CA 4.3 (estado vacío, no una curva inventada).
  await seedCheckIns(PATIENT3_ID, 28, improving, false, 'Ana Pérez (en mejora)');
  await seedCheckIns(PATIENT2_ID, 12, irregular, true, 'Pedro Álvarez (irregular, con huecos)');
  await seedCheckIns(REPORTER1_ID, 7, declining, false, 'Jorge Morales (en deterioro)');
  await seedCheckIns(REPORTER2_ID, 21, stable, false, 'Lucía Vega (estable)');

  // ── 5. Períodos de abstinencia faltantes (Jorge y Lucía) ───────────────────
  console.log('\n── Períodos de abstinencia faltantes ──────');
  for (const [userId, days, label] of [
    [REPORTER1_ID, 7, 'Jorge Morales (7 días)'],
    [REPORTER2_ID, 21, 'Lucía Vega (21 días)'],
  ] as [string, number, string][]) {
    const existing = await periodRepo.findOne({ where: { userId, endDate: IsNull() } });
    if (!existing) {
      await periodRepo.save(
        periodRepo.create({ userId, startDate: daysAgoInChile(days), endDate: null, attemptNumber: 1 }),
      );
      console.log(`  ✓ Período abierto: ${label}`);
    } else {
      console.log(`  → Período ya existe: ${label}`);
    }
  }

  // ── 6. Alertas de pánico "de hoy" (HdU04 CA4.1, panel Alertas) ─────────────
  // Estas SIEMPRE se refrescan (no solo la primera vez): "alertas hoy" caduca cada 24 h.
  //
  // OverviewPage.tsx compara con `new Date().toISOString().slice(0,10)` — día calendario
  // **UTC**, no de Chile.
  //
  // `panic_alerts.createdAt` es `@CreateDateColumn()` **sin** `timestamptz` (a diferencia de
  // `respondedAt`/`escalatedAt`/`cancelledAt`, que sí lo son). Pasar un `Date` de JS por el
  // repositorio de TypeORM para esa columna la serializa con la hora LOCAL de la máquina que
  // corre el seed, no en UTC — invisible en local (Postgres de Windows también asume hora
  // local, así que escritura y lectura se cancelan) pero se ve mal contra Railway (sesión en
  // UTC): una alerta "de hace 10 min" quedaba fechada varias horas atrás. Por eso esto usa
  // SQL crudo con `now()` calculado por el propio Postgres — ni la hora ni el huso de la
  // máquina que corre el seed importan.
  console.log('\n── Alertas de pánico de hoy ────────────────');
  async function upsertTodayAlert(
    id: string,
    patientId: string,
    status: 'responded' | 'escalated',
    createdAgoMinutes: number,
    resolvedAgoMinutes: number,
    label: string,
  ): Promise<void> {
    // $4 (status, columna enum) se usa una sola vez y sin casts en conflicto: Postgres
    // necesita que todas las apariciones de un mismo parámetro resuelvan al mismo tipo, así
    // que las ramas del CASE comparan por separado con booleans ($5/$6), no releyendo $4.
    await ds.query(
      `
      INSERT INTO panic_alerts
        (id, "patientId", "sponsorId", status, "communityNotified",
         "respondedAt", "escalatedAt", "cancelledAt", "createdAt", "updatedAt")
      VALUES (
        $1, $2, $3, $4, false,
        CASE WHEN $5 THEN now() - make_interval(mins => $7) END,
        CASE WHEN $6 THEN now() - make_interval(mins => $7) END,
        NULL,
        now() - make_interval(mins => $8),
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        "patientId" = EXCLUDED."patientId",
        "sponsorId" = EXCLUDED."sponsorId",
        status = EXCLUDED.status,
        "communityNotified" = false,
        "respondedAt" = EXCLUDED."respondedAt",
        "escalatedAt" = EXCLUDED."escalatedAt",
        "cancelledAt" = NULL,
        "createdAt" = EXCLUDED."createdAt",
        "updatedAt" = now()
      `,
      [
        id, patientId, SPONSOR_ID, status,
        status === 'responded', status === 'escalated',
        resolvedAgoMinutes, createdAgoMinutes,
      ],
    );
    console.log(`  ✓ ${label}`);
  }
  await upsertTodayAlert(
    ALERT_ROBERTO_ID, PATIENT4_ID, 'escalated', 40, 38,
    'Roberto Fuentes — escalada a IA (hace 40 min)',
  );
  await upsertTodayAlert(
    ALERT_JORGE_ID, REPORTER1_ID, 'escalated', 25, 25,
    'Jorge Morales — escalada a IA (hace 25 min)',
  );
  await upsertTodayAlert(
    ALERT_ANA_ID, PATIENT3_ID, 'responded', 10, 10,
    'Ana Pérez — respondida (hace 10 min)',
  );

  // ── 7. Notificaciones (HdU05 CA5.5, Home móvil) ────────────────────────────
  console.log('\n── Notificaciones ──────────────────────────');
  async function seedNotifications(
    userId: string,
    items: Array<{ type: 'warning' | 'info' | 'success' | 'danger'; title: string; body: string }>,
    label: string,
  ): Promise<void> {
    const existing = await notifRepo.count({ where: { userId } });
    if (existing === 0) {
      for (const n of items) {
        await notifRepo.save(notifRepo.create({ userId, ...n, read: false }));
      }
      console.log(`  ✓ ${items.length} notificaciones creadas: ${label}`);
    } else {
      console.log(`  → Notificaciones ya existen (${existing}): ${label}`);
    }
  }
  await seedNotifications(DEMO_USER_ID, [
    { type: 'success', title: '¡45 días cumplidos!', body: 'Alcanzaste un nuevo hito. Sigue así.' },
    { type: 'info', title: 'Nueva sesión grupal', body: 'Hay una sesión grupal programada en tu sede.' },
    { type: 'info', title: 'Respondieron tu publicación', body: 'Alguien comentó en tu post de la comunidad.' },
    { type: 'warning', title: 'Check-in pendiente', body: 'Aún no registras tu ánimo de hoy.' },
    { type: 'success', title: 'Pago recibido', body: 'Tu mensualidad fue procesada correctamente.' },
    { type: 'danger', title: 'Alerta de pánico', body: 'Tu padrino fue notificado de tu alerta.' },
  ], 'Carlos Demo');
  await seedNotifications(PATIENT2_ID, [
    { type: 'info', title: 'Bienvenido a la comunidad', body: 'Ya puedes publicar y reaccionar a otros mensajes.' },
    { type: 'warning', title: 'Check-in pendiente', body: 'Aún no registras tu ánimo de hoy.' },
  ], 'Pedro Álvarez');

  // ── 8. Comunidad — lo que falta para HdU05 ─────────────────────────────────
  console.log('\n── Comunidad ────────────────────────────────');
  await upsert(postRepo, {
    id: POST_CARLOS_ID,
    authorId: DEMO_USER_ID,
    type: 'forum_post',
    sede: SANTIAGO_SEDE,
    title: null,
    body: '¿Alguien más siente que el fin de semana es lo más difícil? Cualquier tip es bienvenido.',
  }, 'Post de Carlos (para borrar/reaccionar/responder en vivo — CA 5.4, 5.5)');

  await upsert(postRepo, {
    id: POST_ANNOUNCEMENT_ID,
    authorId: PSYCHOLOGIST_ID,
    type: 'announcement',
    sede: SANTIAGO_SEDE,
    title: 'Taller de manejo de la ansiedad — sesión abierta',
    body: 'Sesión grupal abierta a toda la comunidad de Santiago. Confirma tu asistencia.',
    eventDate: new Date(`${daysFromNowInChile(7)}T18:30:00`),
  }, 'Anuncio con evento futuro (CA 5.1 material)');

  await upsert(postRepo, {
    id: POST_CLEAN_1_ID,
    authorId: REPORTER1_ID,
    type: 'forum_post',
    sede: SANTIAGO_SEDE,
    title: null,
    body: 'Terminé mi primera semana. Fue dura, pero acá seguimos.',
  }, 'Post limpio de Jorge (para reportar en vivo — CA 5.3)');

  await upsert(postRepo, {
    id: POST_CLEAN_2_ID,
    authorId: REPORTER2_ID,
    type: 'forum_post',
    sede: SANTIAGO_SEDE,
    title: null,
    body: '21 días. Lo que más me ha ayudado es tener una rutina fija en las tardes.',
  }, 'Post limpio de Lucía (para reportar en vivo — CA 5.3)');

  await upsert(postRepo, {
    id: POST_FLAGGED_2_ID,
    authorId: PATIENT2_ID,
    type: 'forum_post',
    sede: SANTIAGO_SEDE,
    title: null,
    body: 'Mensaje de prueba con un reporte, para que el panel de moderación no muestre un solo caso.',
  }, 'Post con 1 reporte — segundo caso de moderación');

  const flaggedExisting = await reportRepo.findOne({
    where: { postId: POST_FLAGGED_2_ID, reporterId: PATIENT4_ID },
  });
  if (!flaggedExisting) {
    await reportRepo.save(
      reportRepo.create({
        postId: POST_FLAGGED_2_ID,
        reporterId: PATIENT4_ID,
        reason: 'Contenido de prueba para moderación',
      }),
    );
    await postRepo.increment({ id: POST_FLAGGED_2_ID }, 'reportCount', 1);
    console.log('  ✓ Reporte de Roberto sobre el post de Pedro');
  } else {
    console.log('  → Reporte ya existe (post de Pedro)');
  }

  for (const attendeeId of [PATIENT2_ID, PATIENT3_ID, REPORTER1_ID]) {
    const existing = await attendanceRepo.findOne({
      where: { postId: POST_ANNOUNCEMENT_ID, userId: attendeeId },
    });
    if (!existing) {
      await attendanceRepo.save(attendanceRepo.create({ postId: POST_ANNOUNCEMENT_ID, userId: attendeeId }));
    }
  }
  console.log('  ✓ Confirmaciones de asistencia al anuncio (Pedro, Ana, Jorge)');

  // ── 9. Suscripciones y facturas (HdU pagos / SuspendedAccountScreen) ──────
  console.log('\n── Suscripciones y facturas ─────────────────');
  async function seedPaidHistory(
    userId: string, paymentMethod: 'card' | 'webpay' | 'transfer', label: string,
  ): Promise<void> {
    const existingSub = await subRepo.findOne({ where: { userId } });
    if (!existingSub) {
      await subRepo.save(subRepo.create({
        userId, plan: 'AJUTER_MENSUAL', amountCLP: 30000, paymentMethod, status: 'active',
        expiresAt: new Date(`${daysFromNowInChile(20)}T23:59:59`),
      }));
    }
    const today = todayInChile();
    const currentMonth = today.slice(0, 7);
    const [y, m] = currentMonth.split('-').map(Number);
    const lastMonthDate = new Date(y, m - 2, 1);
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const lastDayCurrentMonth = new Date(y, m, 0).getDate();

    const paidInvoice = await invoiceRepo.findOne({ where: { userId, month: lastMonth } });
    if (!paidInvoice) {
      await invoiceRepo.save(invoiceRepo.create({
        userId, month: lastMonth, amountCLP: 30000, status: 'paid',
        dueDate: `${lastMonth}-05`, paidAt: new Date(`${lastMonth}-03T12:00:00`),
      }));
    }
    const pendingInvoice = await invoiceRepo.findOne({ where: { userId, month: currentMonth } });
    if (!pendingInvoice) {
      await invoiceRepo.save(invoiceRepo.create({
        userId, month: currentMonth, amountCLP: 30000, status: 'pending',
        dueDate: `${currentMonth}-${String(lastDayCurrentMonth).padStart(2, '0')}`, paidAt: null,
      }));
    }
    console.log(`  ✓ Historial de pagos al día: ${label}`);
  }
  await seedPaidHistory(DEMO_USER_ID, 'webpay', 'Carlos Demo');
  await seedPaidHistory(PATIENT2_ID, 'card', 'Pedro Álvarez');

  // Lucía es la única cuenta suspendida por mora, para poder mostrar
  // SuspendedAccountScreen sin tocar a Carlos (que redirige toda la app si se suspende).
  const luciaSub = await subRepo.findOne({ where: { userId: REPORTER2_ID } });
  if (!luciaSub) {
    await subRepo.save(subRepo.create({
      userId: REPORTER2_ID, plan: 'AJUTER_MENSUAL', amountCLP: 30000,
      paymentMethod: 'transfer', status: 'active', expiresAt: null,
    }));
  }
  const overdueMonth = (() => {
    const today = todayInChile();
    const [y, m] = today.slice(0, 7).split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const luciaInvoice = await invoiceRepo.findOne({ where: { userId: REPORTER2_ID, month: overdueMonth } });
  if (!luciaInvoice) {
    await invoiceRepo.save(invoiceRepo.create({
      userId: REPORTER2_ID, month: overdueMonth, amountCLP: 30000, status: 'overdue',
      dueDate: `${overdueMonth}-05`, paidAt: null,
    }));
  }
  await userRepo.update(REPORTER2_ID, { accountStatus: 'suspended' });
  console.log('  ✓ Lucía Vega — cuenta suspendida por mora (factura vencida)');

  // ── 10. --sin-padrino (CA 1.2) ───────────────────────────────────────────
  if (sinPadrino) {
    console.log('\n── --sin-padrino ─────────────────────────');
    await sponsorRepo.update({ patientId: DEMO_USER_ID, sponsorId: SPONSOR_ID }, { isActive: false });
    console.log('  ✓ Padrino de Carlos desactivado (CA 1.2 demostrable)');
  }

  // ── 11. --reset ───────────────────────────────────────────────────────────
  if (reset) {
    console.log('\n── --reset ───────────────────────────────');

    if (!sinPadrino) {
      await sponsorRepo.update({ patientId: DEMO_USER_ID, sponsorId: SPONSOR_ID }, { isActive: true });
      console.log('  ✓ Padrino de Carlos reactivado');
    }

    const stray = await panicRepo.find({
      where: [
        { patientId: DEMO_USER_ID, status: 'pending' },
        { patientId: DEMO_USER_ID, status: 'escalated' },
      ],
    });
    for (const alert of stray) {
      await panicRepo.update(alert.id, { status: 'cancelled', cancelledAt: new Date() });
    }
    console.log(stray.length > 0 ? `  ✓ ${stray.length} alerta(s) colgada(s) de Carlos canceladas` : '  → Sin alertas colgadas de Carlos');

    const todayCheckIn = await checkInRepo.findOne({ where: { userId: DEMO_USER_ID, date: todayInChile() } });
    if (todayCheckIn) {
      await checkInRepo.delete(todayCheckIn.id);
      console.log('  ✓ Check-in de hoy de Carlos eliminado (CA 7.1 repetible)');
    } else {
      console.log('  → Carlos no tiene check-in de hoy');
    }

    const mute = await muteRepo.findOne({ where: { userId: DEMO_USER_ID } });
    if (mute) {
      await muteRepo.delete({ userId: DEMO_USER_ID });
      console.log('  ✓ Silencio de comunidad de Carlos removido (CA 5.6 repetible)');
    } else {
      console.log('  → Carlos no tenía comunidad silenciada');
    }

    const carlosReports = await reportRepo.find({ where: { reporterId: DEMO_USER_ID } });
    for (const r of carlosReports) {
      await reportRepo.delete(r.id);
      await postRepo.decrement({ id: r.postId }, 'reportCount', 1);
    }
    console.log(carlosReports.length > 0 ? `  ✓ ${carlosReports.length} reporte(s) de Carlos removidos (CA 5.3 repetible)` : '  → Carlos no tenía reportes propios');

    const currentPeriod = await periodRepo.findOne({ where: { userId: DEMO_USER_ID, endDate: IsNull() } });
    if (currentPeriod) {
      const badge45 = await badgeRepo.findOne({ where: { periodId: currentPeriod.id, milestone: 45 } });
      if (badge45 && badge45.sharedToCommunity) {
        await badgeRepo.update(badge45.id, { sharedToCommunity: false });
        console.log('  ✓ Insignia de 45 días de Carlos marcada como no compartida (CA 5.2 repetible)');
      } else {
        console.log('  → Insignia de 45 días de Carlos ya estaba sin compartir');
      }
    }
  }

  await ds.destroy();

  console.log('\n════════════════════════════════════════════');
  console.log('  Seed de demo completado.');
  console.log('');
  console.log('  Clave de todas las cuentas de prueba: ' + DEV_PASSWORD);
  console.log('');
  console.log('  Cuentas clave para la demo:');
  console.log('    Coordinador (HdU24 completo): sofia.reyes@ajuter.cl');
  console.log('    Psicólogo con 2 sedes y 3 pacientes: miguel.lara@ajuter.cl');
  console.log('    Psicólogo (moderación de comunidad — requiere rol psychologist): miguel.lara@ajuter.cl');
  console.log('    Familiar con sesiones: patricia.gomez@stopbet.cl');
  console.log('');
  console.log('  Recuerda: --reset caduca cada 24 h (alertas "de hoy", check-in del día).');
  console.log('  Corre `pnpm run seed:demo -- --reset` la mañana de la demo.');
  console.log('════════════════════════════════════════════\n');
}

seedDemo().catch((err) => {
  console.error('\nError en seed:demo:', err.message);
  console.error(err.stack);
  process.exit(1);
});
