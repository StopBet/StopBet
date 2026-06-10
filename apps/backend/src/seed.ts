import 'reflect-metadata';
import { DataSource, IsNull } from 'typeorm';
import { User } from './users/entities/user.entity';
import { CheckIn } from './check-ins/entities/check-in.entity';
import { Notification } from './notifications/entities/notification.entity';
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

// ── IDs fijos para datos de prueba ────────────────────────────────────────────
const DEMO_USER_ID   = '11111111-1111-1111-1111-111111111111';
const SPONSOR_ID     = '22222222-2222-2222-2222-222222222222';
const PSYCHOLOGIST_ID = '33333333-3333-3333-3333-333333333333';
const PATIENT2_ID    = '44444444-4444-4444-4444-444444444444';
const PATIENT3_ID    = '55555555-5555-5555-5555-555555555555';
const PATIENT4_ID    = '66666666-6666-6666-6666-666666666666';
const REPORTER1_ID   = '77777777-7777-7777-7777-777777777777';
const REPORTER2_ID   = '88888888-8888-8888-8888-888888888888';

const DAYS_STREAK = 45;
const SANTIAGO_SEDE = 'Santiago';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function daysAgoDate(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function upsertUser(repo: any, data: any) {
  const existing = await repo.findOne({ where: { id: data.id } });
  if (!existing) {
    await repo.save(repo.create(data));
    console.log(`  ✓ Usuario creado: ${data.firstName} ${data.lastName} (${data.role})`);
  } else {
    await repo.update({ id: data.id }, data);
    console.log(`  → Usuario actualizado: ${data.firstName} ${data.lastName}`);
  }
}

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [
      User, CheckIn, Notification, Sede,
      RegistrationRequest, Subscription,
      AbstinencePeriod, EarnedBadge, ValidatedMessage,
      CommunityPost, PostReply, PostReaction, PostReport, AttendanceConfirmation,
      Invoice,
      AiSession, AiMessage, AiSessionSummary,
      SponsorAssignment, PanicAlert,
    ],
    synchronize: true,
    logging: false,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  await ds.initialize();
  console.log('\nConectado a la base de datos.\n');

  const userRepo      = ds.getRepository(User);
  const periodRepo    = ds.getRepository(AbstinencePeriod);
  const badgeRepo     = ds.getRepository(EarnedBadge);
  const msgRepo       = ds.getRepository(ValidatedMessage);
  const postRepo      = ds.getRepository(CommunityPost);
  const replyRepo     = ds.getRepository(PostReply);
  const reactionRepo  = ds.getRepository(PostReaction);
  const reportRepo    = ds.getRepository(PostReport);
  const panicRepo     = ds.getRepository(PanicAlert);
  const sponsorRepo   = ds.getRepository(SponsorAssignment);
  const sessionRepo   = ds.getRepository(AiSession);
  const msgAiRepo     = ds.getRepository(AiMessage);
  const summaryRepo   = ds.getRepository(AiSessionSummary);
  const checkInRepo   = ds.getRepository(CheckIn);

  // ── 1. USUARIOS ────────────────────────────────────────────────────────────
  console.log('── Usuarios ──────────────────────────────');

  await upsertUser(userRepo, {
    id: DEMO_USER_ID,
    email: 'demo@stopbet.cl',
    passwordHash: null,
    role: 'patient',
    firstName: 'Carlos',
    lastName: 'Demo',
    phone: '+56912345678',
    rut: '12.345.678-9',
    birthDate: '1995-03-15',
    sedeId: SANTIAGO_SEDE,
    daysStreak: DAYS_STREAK,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  });

  await upsertUser(userRepo, {
    id: SPONSOR_ID,
    email: 'daniela.soto@stopbet.cl',
    passwordHash: null,
    role: 'sponsor',
    firstName: 'Daniela',
    lastName: 'Soto',
    phone: '+56987654321',
    sedeId: SANTIAGO_SEDE,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  });

  await upsertUser(userRepo, {
    id: PSYCHOLOGIST_ID,
    email: 'miguel.lara@ajuter.cl',
    passwordHash: null,
    role: 'psychologist',
    firstName: 'Miguel Ángel',
    lastName: 'Lara',
    phone: '+56911223344',
    sedeId: SANTIAGO_SEDE,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  });

  await upsertUser(userRepo, {
    id: PATIENT2_ID,
    email: 'pedro.alvarez@stopbet.cl',
    passwordHash: null,
    role: 'patient',
    firstName: 'Pedro',
    lastName: 'Álvarez',
    phone: '+56955667788',
    rut: '15.234.567-K',
    sedeId: SANTIAGO_SEDE,
    daysStreak: 12,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  });

  await upsertUser(userRepo, {
    id: PATIENT3_ID,
    email: 'ana.perez@stopbet.cl',
    passwordHash: null,
    role: 'patient',
    firstName: 'Ana',
    lastName: 'Pérez',
    phone: '+56933445566',
    rut: '16.345.678-2',
    sedeId: SANTIAGO_SEDE,
    daysStreak: 78,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  });

  await upsertUser(userRepo, {
    id: PATIENT4_ID,
    email: 'roberto.fuentes@stopbet.cl',
    passwordHash: null,
    role: 'patient',
    firstName: 'Roberto',
    lastName: 'Fuentes',
    phone: '+56922334455',
    rut: '17.456.789-3',
    sedeId: SANTIAGO_SEDE,
    daysStreak: 3,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  });

  await upsertUser(userRepo, {
    id: REPORTER1_ID,
    email: 'jorge.morales@stopbet.cl',
    passwordHash: null,
    role: 'patient',
    firstName: 'Jorge',
    lastName: 'Morales',
    sedeId: SANTIAGO_SEDE,
    daysStreak: 7,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  });

  await upsertUser(userRepo, {
    id: REPORTER2_ID,
    email: 'lucia.vega@stopbet.cl',
    passwordHash: null,
    role: 'patient',
    firstName: 'Lucía',
    lastName: 'Vega',
    sedeId: SANTIAGO_SEDE,
    daysStreak: 21,
    accountStatus: 'active',
    onboardingStatus: 'complete',
  });

  // ── 2. PERÍODOS DE ABSTINENCIA (HU-03) ────────────────────────────────────
  console.log('\n── Logros / Períodos de abstinencia ──────');

  // Limpiar períodos actuales de Carlos para reiniciar limpio
  const carlosPeriods = await periodRepo.find({ where: { userId: DEMO_USER_ID } });

  let histPeriod1: AbstinencePeriod | null = null;
  let histPeriod2: AbstinencePeriod | null = null;
  let currentPeriod: AbstinencePeriod | null = null;

  // Período histórico 1 (90 días, recaída hace 200 días)
  const hp1Start = daysAgo(290); // empezó hace 290 días
  const hp1End   = daysAgo(200); // terminó hace 200 días (duró 90 días)
  if (!carlosPeriods.find(p => p.startDate === hp1Start)) {
    histPeriod1 = await periodRepo.save(periodRepo.create({
      userId: DEMO_USER_ID,
      startDate: hp1Start,
      endDate: hp1End,
      attemptNumber: 1,
    }));
    console.log(`  ✓ Período histórico 1: ${hp1Start} → ${hp1End} (90 días)`);
  } else {
    histPeriod1 = carlosPeriods.find(p => p.startDate === hp1Start)!;
    console.log('  → Período histórico 1 ya existe');
  }

  // Período histórico 2 (30 días, recaída hace 90 días)
  const hp2Start = daysAgo(130);
  const hp2End   = daysAgo(100);
  if (!carlosPeriods.find(p => p.startDate === hp2Start)) {
    histPeriod2 = await periodRepo.save(periodRepo.create({
      userId: DEMO_USER_ID,
      startDate: hp2Start,
      endDate: hp2End,
      attemptNumber: 2,
    }));
    console.log(`  ✓ Período histórico 2: ${hp2Start} → ${hp2End} (30 días)`);
  } else {
    histPeriod2 = carlosPeriods.find(p => p.startDate === hp2Start)!;
    console.log('  → Período histórico 2 ya existe');
  }

  // Período actual (45 días, en curso)
  const currentStart = daysAgo(DAYS_STREAK);
  const existingCurrent = await periodRepo.findOne({
    where: { userId: DEMO_USER_ID, endDate: IsNull() },
  });
  if (!existingCurrent) {
    currentPeriod = await periodRepo.save(periodRepo.create({
      userId: DEMO_USER_ID,
      startDate: currentStart,
      endDate: null,
      attemptNumber: 3,
    }));
    console.log(`  ✓ Período actual creado (inicio: ${currentStart}, 45 días)`);
  } else {
    currentPeriod = existingCurrent;
    console.log('  → Período actual ya existe');
  }

  // Períodos para otros pacientes
  for (const [pid, days, attempt] of [
    [PATIENT2_ID, 12, 1],
    [PATIENT3_ID, 78, 2],
    [PATIENT4_ID, 3, 1],
  ] as [string, number, number][]) {
    const existing = await periodRepo.findOne({ where: { userId: pid, endDate: IsNull() } });
    if (!existing) {
      await periodRepo.save(periodRepo.create({
        userId: pid, startDate: daysAgo(days), endDate: null, attemptNumber: attempt,
      }));
    }
  }

  // ── 3. INSIGNIAS (badges) ──────────────────────────────────────────────────
  // Período histórico 1: hitos 1, 3, 7, 14, 21, 30, 45, 60, 75, 90
  const hp1Milestones = [1, 3, 7, 14, 21, 30, 45, 60, 75, 90];
  if (histPeriod1) {
    for (const m of hp1Milestones) {
      const existingBadge = await badgeRepo.findOne({
        where: { periodId: histPeriod1.id, milestone: m },
      });
      if (!existingBadge) {
        await badgeRepo.save(badgeRepo.create({
          userId: DEMO_USER_ID,
          periodId: histPeriod1.id,
          milestone: m,
          earnedAt: daysAgo(290 - m),
          sharedToCommunity: m === 30 || m === 90,
        }));
      }
    }
    console.log(`  ✓ Insignias período histórico 1 (${hp1Milestones.join(', ')} días)`);
  }

  // Período histórico 2: hitos 1, 3, 7, 14, 21, 30
  const hp2Milestones = [1, 3, 7, 14, 21, 30];
  if (histPeriod2) {
    for (const m of hp2Milestones) {
      const existingBadge = await badgeRepo.findOne({
        where: { periodId: histPeriod2.id, milestone: m },
      });
      if (!existingBadge) {
        await badgeRepo.save(badgeRepo.create({
          userId: DEMO_USER_ID,
          periodId: histPeriod2.id,
          milestone: m,
          earnedAt: daysAgo(130 - m),
          sharedToCommunity: false,
        }));
      }
    }
    console.log(`  ✓ Insignias período histórico 2 (${hp2Milestones.join(', ')} días)`);
  }

  // Período actual: hitos 1, 3, 7, 14, 21, 30, 45
  const currentMilestones = [1, 3, 7, 14, 21, 30, 45];
  for (const m of currentMilestones) {
    const existingBadge = await badgeRepo.findOne({
      where: { periodId: currentPeriod.id, milestone: m },
    });
    if (!existingBadge) {
      await badgeRepo.save(badgeRepo.create({
        userId: DEMO_USER_ID,
        periodId: currentPeriod.id,
        milestone: m,
        earnedAt: daysAgo(DAYS_STREAK - m),
        sharedToCommunity: m === 30,
      }));
    }
  }
  console.log(`  ✓ Insignias período actual (${currentMilestones.join(', ')} días)`);

  // ── 4. MENSAJES VALIDADOS para modal de recaída (HU-03 CA3) ───────────────
  const validatedMessages = [
    'Tu esfuerzo anterior no se borra, estamos aquí para retomar el camino.',
    'Cada intento te enseña algo. Hoy empezamos de nuevo con más fuerza.',
    'La recaída no es el fin. Es una parte del proceso de recuperación. Sigues aquí.',
    'Lo importante no es cuántas veces caíste, sino cuántas veces te levantaste.',
    'El camino no es recto, pero siempre podemos continuar. Estamos contigo.',
  ];

  const existingMsgs = await msgRepo.count();
  if (existingMsgs === 0) {
    for (const body of validatedMessages) {
      await msgRepo.save(msgRepo.create({ body }));
    }
    console.log(`  ✓ ${validatedMessages.length} mensajes validados de recaída creados`);
  } else {
    console.log(`  → Mensajes validados ya existen (${existingMsgs})`);
  }

  // ── 5. PADRINO ASIGNADO (HU-01) ───────────────────────────────────────────
  console.log('\n── Pánico / Padrino ──────────────────────');

  const existingAssignment = await sponsorRepo.findOne({
    where: { patientId: DEMO_USER_ID, sponsorId: SPONSOR_ID },
  });
  if (!existingAssignment) {
    await sponsorRepo.save(sponsorRepo.create({
      patientId: DEMO_USER_ID,
      sponsorId: SPONSOR_ID,
      isActive: true,
    }));
    console.log('  ✓ Asignación padrino creada (Carlos → Daniela)');
  } else {
    console.log('  → Asignación padrino ya existe');
  }

  // Pánico histórico respondido (hace 20 días)
  const existingResponded = await panicRepo.findOne({
    where: { patientId: DEMO_USER_ID, status: 'responded' },
  });
  if (!existingResponded) {
    await panicRepo.save(panicRepo.create({
      patientId: DEMO_USER_ID,
      sponsorId: SPONSOR_ID,
      status: 'responded',
      communityNotified: false,
      respondedAt: daysAgoDate(20),
      createdAt: daysAgoDate(20),
    } as any));
    console.log('  ✓ Alerta pánico histórica (respondida, hace 20 días)');
  } else {
    console.log('  → Alerta pánico respondida ya existe');
  }

  // Pánico histórico cancelado (hace 10 días)
  const existingCancelled = await panicRepo.findOne({
    where: { patientId: DEMO_USER_ID, status: 'cancelled' },
  });
  if (!existingCancelled) {
    await panicRepo.save(panicRepo.create({
      patientId: DEMO_USER_ID,
      sponsorId: SPONSOR_ID,
      status: 'cancelled',
      communityNotified: false,
      cancelledAt: daysAgoDate(10),
      createdAt: daysAgoDate(10),
    } as any));
    console.log('  ✓ Alerta pánico histórica (cancelada, hace 10 días)');
  } else {
    console.log('  → Alerta pánico cancelada ya existe');
  }

  // Pánico para Pedro (para dashboard HU-04 CA2)
  const existingPedroAlert = await panicRepo.findOne({ where: { patientId: PATIENT2_ID } });
  if (!existingPedroAlert) {
    await panicRepo.save(panicRepo.create({
      patientId: PATIENT2_ID,
      sponsorId: SPONSOR_ID,
      status: 'responded',
      communityNotified: false,
      respondedAt: daysAgoDate(2),
      createdAt: daysAgoDate(2),
    } as any));
    console.log('  ✓ Alerta pánico para Pedro Álvarez (hace 2 días)');
  } else {
    console.log('  → Alerta pánico de Pedro ya existe');
  }

  // ── 6. CHECK-INS EMOCIONALES (HU-04 gráfico anímico) ─────────────────────
  console.log('\n── Check-ins emocionales ─────────────────');

  const emotions: string[] = ['tired', 'anxious', 'angry', 'lonely', 'good'];
  let checkInsCreated = 0;
  for (let i = 30; i >= 1; i--) {
    const date = daysAgo(i);
    const existingCI = await checkInRepo.findOne({
      where: { userId: DEMO_USER_ID, date },
    } as any);
    if (!existingCI) {
      const emotion = emotions[Math.floor((i * 7 + 3) % emotions.length)];
      await checkInRepo.save(checkInRepo.create({
        userId: DEMO_USER_ID,
        emotion,
        date,
      } as any));
      checkInsCreated++;
    }
  }
  console.log(
    checkInsCreated > 0
      ? `  ✓ ${checkInsCreated} check-ins creados (últimos 30 días)`
      : '  → Check-ins ya existen',
  );

  // ── 7. SESIONES IA (HU-02) ────────────────────────────────────────────────
  console.log('\n── Sesiones IA ───────────────────────────');

  const existingSessions = await sessionRepo.count({ where: { userId: DEMO_USER_ID } });
  if (existingSessions < 2) {
    // Sesión 1 hace 15 días — ansiedad, técnica respiración, riesgo alto
    const s1 = (await sessionRepo.save(sessionRepo.create({
      userId: DEMO_USER_ID,
      status: 'closed',
      previousContext: null,
      closedAt: daysAgoDate(15),
      lastActivityAt: daysAgoDate(15),
    } as any))) as unknown as AiSession;
    await msgAiRepo.save(msgAiRepo.create({
      sessionId: s1.id,
      role: 'user',
      content: 'Siento muchas ganas de apostar, estoy muy ansioso.',
    } as any));
    await msgAiRepo.save(msgAiRepo.create({
      sessionId: s1.id,
      role: 'assistant',
      content: 'Entiendo cómo te sientes. Vamos a hacer una respiración 4-7-8 juntos. Inhala 4 segundos...',
    } as any));
    await summaryRepo.save(summaryRepo.create({
      sessionId: s1.id,
      userId: DEMO_USER_ID,
      mood: 'Ansiedad',
      techniqueUsed: 'Respiración 4-7-8',
      trigger: 'Ver publicidad de casino en televisión',
      riskLevel: 'high',
      durationMinutes: 12,
      progressNote: 'Paciente logró reducir ansiedad aplicando técnica de respiración.',
    } as any));
    console.log('  ✓ Sesión IA 1 creada (hace 15 días, ansiedad, alto riesgo)');

    // Sesión 2 hace 7 días — soledad, técnica distracción, riesgo medio
    const s2 = (await sessionRepo.save(sessionRepo.create({
      userId: DEMO_USER_ID,
      status: 'closed',
      previousContext: 'Sesión previa: ansiedad ante publicidad de casino. Técnica de respiración aplicada exitosamente.',
      closedAt: daysAgoDate(7),
      lastActivityAt: daysAgoDate(7),
    } as any))) as unknown as AiSession;
    await msgAiRepo.save(msgAiRepo.create({
      sessionId: s2.id,
      role: 'user',
      content: 'Me siento muy solo, mi familia no me entiende.',
    } as any));
    await msgAiRepo.save(msgAiRepo.create({
      sessionId: s2.id,
      role: 'assistant',
      content: 'Tu valentía de buscar apoyo habla muy bien de ti. Te propongo una actividad de distracción cognitiva...',
    } as any));
    await summaryRepo.save(summaryRepo.create({
      sessionId: s2.id,
      userId: DEMO_USER_ID,
      mood: 'Soledad',
      techniqueUsed: 'Distracción cognitiva',
      trigger: 'Conflicto familiar',
      riskLevel: 'medium',
      durationMinutes: 8,
      progressNote: 'Paciente identificó el detonante. Se sugirió comunicarlo al psicólogo.',
    } as any));
    console.log('  ✓ Sesión IA 2 creada (hace 7 días, soledad, riesgo medio)');

    // Sesión 3 hace 2 días — cansancio, técnica mindfulness, riesgo bajo
    const s3 = (await sessionRepo.save(sessionRepo.create({
      userId: DEMO_USER_ID,
      status: 'closed',
      previousContext: 'Sesiones previas: ansiedad y soledad detectadas. Buena adherencia a técnicas.',
      closedAt: daysAgoDate(2),
      lastActivityAt: daysAgoDate(2),
    } as any))) as unknown as AiSession;
    await msgAiRepo.save(msgAiRepo.create({
      sessionId: s3.id,
      role: 'user',
      content: 'Estoy cansado, tuve un día muy difícil en el trabajo.',
    } as any));
    await msgAiRepo.save(msgAiRepo.create({
      sessionId: s3.id,
      role: 'assistant',
      content: 'El cansancio puede ser un detonante. Hagamos un ejercicio rápido de mindfulness...',
    } as any));
    await summaryRepo.save(summaryRepo.create({
      sessionId: s3.id,
      userId: DEMO_USER_ID,
      mood: 'Cansancio',
      techniqueUsed: 'Mindfulness',
      trigger: 'Estrés laboral',
      riskLevel: 'low',
      durationMinutes: 5,
      progressNote: 'Sesión breve. Paciente reportó mejoría rápida.',
    } as any));
    console.log('  ✓ Sesión IA 3 creada (hace 2 días, cansancio, riesgo bajo)');
  } else {
    console.log(`  → Sesiones IA ya existen (${existingSessions})`);
  }

  // ── 8. COMUNIDAD — posts, reacciones, respuestas, reportes (HU-05) ────────
  console.log('\n── Comunidad ─────────────────────────────');

  const existingPosts = await postRepo.find({ where: { sede: SANTIAGO_SEDE } });
  const postCount = existingPosts.length;

  let targetPost: CommunityPost | null = null;

  if (postCount < 6) {
    // Post 1 — anuncio de evento
    await postRepo.save(postRepo.create({
      authorId: PSYCHOLOGIST_ID,
      type: 'announcement',
      sede: SANTIAGO_SEDE,
      title: 'Sesión grupal presencial — Miércoles 18 de junio',
      body: 'Recordatorio: este miércoles 18 de junio a las 18:30 tendremos nuestra sesión grupal presencial en la sede Santiago. ¡Los esperamos!',
      eventDate: new Date('2026-06-18T18:30:00'),
    }));
    console.log('  ✓ Anuncio de evento creado');

    // Post 2 — mensaje de apoyo de Carlos
    await postRepo.save(postRepo.create({
      authorId: DEMO_USER_ID,
      type: 'forum_post',
      sede: SANTIAGO_SEDE,
      title: null,
      body: '¡Hoy completo 45 días! No fue fácil pero el apoyo de todos en esta comunidad ha sido fundamental. ¡Gracias!',
    }));
    console.log('  ✓ Post de Carlos (45 días) creado');

    // Post 3 — mensaje de Pedro
    await postRepo.save(postRepo.create({
      authorId: PATIENT2_ID,
      type: 'forum_post',
      sede: SANTIAGO_SEDE,
      title: null,
      body: 'Tuve un momento difícil esta semana, pero usé el asistente y me ayudó mucho. Gracias a todos.',
    }));

    // Post 4 — mensaje de Ana
    await postRepo.save(postRepo.create({
      authorId: PATIENT3_ID,
      type: 'forum_post',
      sede: SANTIAGO_SEDE,
      title: null,
      body: '78 días y contando 💪 Para los que recién empiezan: sí se puede. El primer mes es el más difícil.',
    }));

    // Post 5 — contenido inapropiado para testear moderación (CA3)
    targetPost = await postRepo.save(postRepo.create({
      authorId: REPORTER1_ID,
      type: 'forum_post',
      sede: SANTIAGO_SEDE,
      title: null,
      body: 'Mensaje de prueba que será reportado 5 veces para testear moderación del dashboard.',
      reportCount: 0,
    }));
    console.log(`  ✓ Post para moderación creado (ID: ${targetPost.id})`);
  } else {
    console.log(`  → Posts ya existen (${postCount} en Santiago)`);
    // Buscar el post con menor reportCount para agregar reportes si es necesario
    targetPost = existingPosts.find(p => p.authorId === REPORTER1_ID) ??
                 existingPosts.find(p => p.reportCount < 5) ??
                 existingPosts[existingPosts.length - 1];
  }

  // Reacciones en posts (HU-05 CA2)
  const allPosts = await postRepo.find({ where: { sede: SANTIAGO_SEDE } });
  const forumPosts = allPosts.filter(p => p.type === 'forum_post');

  if (forumPosts.length > 0) {
    const firstPost = forumPosts[0];
    const reactors = [DEMO_USER_ID, PATIENT2_ID, PATIENT3_ID, SPONSOR_ID];
    const emojis = ['💪', '❤️', '🤗'];
    let reactionsCreated = 0;
    for (let i = 0; i < reactors.length; i++) {
      const existingReaction = await reactionRepo.findOne({
        where: { postId: firstPost.id, authorId: reactors[i] },
      } as any);
      if (!existingReaction) {
        await reactionRepo.save(reactionRepo.create({
          postId: firstPost.id,
          authorId: reactors[i],
          emoji: emojis[i % emojis.length],
        } as any));
        reactionsCreated++;
      }
    }
    if (reactionsCreated > 0) console.log(`  ✓ ${reactionsCreated} reacciones creadas`);
    else console.log('  → Reacciones ya existen');

    // Respuestas en el primer post (HU-05 CA2)
    const existingReply = await replyRepo.findOne({ where: { postId: firstPost.id } });
    if (!existingReply) {
      await replyRepo.save(replyRepo.create({
        postId: firstPost.id,
        authorId: PATIENT3_ID,
        body: '¡Genial Carlos! Yo también lo logré. ¡Ánimo a todos!',
      }));
      await replyRepo.save(replyRepo.create({
        postId: firstPost.id,
        authorId: SPONSOR_ID,
        body: 'Muy bien, sigues avanzando. Aquí estamos para apoyarte.',
      }));
      console.log('  ✓ 2 respuestas creadas en el primer post');
    } else {
      console.log('  → Respuestas ya existen');
    }
  }

  // 5 reportes en el post objetivo (HU-05 CA3 — moderación)
  if (targetPost) {
    const reporters = [DEMO_USER_ID, PATIENT2_ID, PATIENT3_ID, PATIENT4_ID, REPORTER2_ID];
    let reportsCreated = 0;
    for (const rid of reporters) {
      const existingReport = await reportRepo.findOne({
        where: { postId: targetPost.id, reporterId: rid },
      });
      if (!existingReport) {
        await reportRepo.save(reportRepo.create({
          postId: targetPost.id,
          reporterId: rid,
        }));
        // Actualizar reportCount en el post
        await postRepo.increment({ id: targetPost.id }, 'reportCount', 1);
        reportsCreated++;
      }
    }
    const finalPost = await postRepo.findOne({ where: { id: targetPost.id } });
    if (reportsCreated > 0) {
      console.log(`  ✓ ${reportsCreated} reportes creados → post tiene ${finalPost?.reportCount} reportes (CA3: umbral = 5)`);
    } else {
      console.log(`  → Post ya tiene ${finalPost?.reportCount} reportes`);
    }
  }

  await ds.destroy();

  console.log('\n════════════════════════════════════════════');
  console.log('  Seed completado. Resumen para testeo:');
  console.log('');
  console.log('  USUARIOS:');
  console.log(`    Paciente demo:  Carlos Demo (ID: ${DEMO_USER_ID})`);
  console.log(`    Padrino:        Daniela Soto (ID: ${SPONSOR_ID})`);
  console.log(`    Psicólogo:      Miguel Ángel Lara (ID: ${PSYCHOLOGIST_ID})`);
  console.log('    Pacientes extra: Pedro, Ana, Roberto');
  console.log('');
  console.log('  HU-01 Pánico:    padrino asignado + 3 alertas históricas');
  console.log('  HU-02 IA:        3 sesiones cerradas con resúmenes');
  console.log('  HU-03 Logros:    45 días + 2 períodos históricos + 7 insignias actuales');
  console.log('  HU-04 Dashboard: 4 pacientes en Santiago + alertas pánico');
  console.log('  HU-05 Comunidad: posts + reacciones + respuestas + post con 5 reportes');
  console.log('════════════════════════════════════════════\n');
}

seed().catch((err) => {
  console.error('\nError en seed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
