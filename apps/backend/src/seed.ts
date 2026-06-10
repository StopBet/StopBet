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

const DEMO_USER_ID = '11111111-1111-1111-1111-111111111111';
const DAYS_STREAK = 45;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
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
  console.log('Conectado a la base de datos.');

  const userRepo = ds.getRepository(User);
  const periodRepo = ds.getRepository(AbstinencePeriod);

  const existing = await userRepo.findOne({ where: { id: DEMO_USER_ID } });
  if (!existing) {
    await userRepo.save(
      userRepo.create({
        id: DEMO_USER_ID,
        email: 'demo@stopbet.cl',
        passwordHash: null,
        role: 'patient',
        firstName: 'Carlos',
        lastName: 'Demo',
        daysStreak: DAYS_STREAK,
        accountStatus: 'active',
        onboardingStatus: 'complete',
      }),
    );
    console.log('✓ Usuario demo creado (Carlos Demo, 45 días de racha)');
  } else {
    console.log('→ Usuario demo ya existe, sin cambios');
  }

  const startDate = daysAgo(DAYS_STREAK);
  const existingPeriod = await periodRepo.findOne({
    where: { userId: DEMO_USER_ID, endDate: IsNull() },
  });
  if (!existingPeriod) {
    await periodRepo.save(
      periodRepo.create({
        userId: DEMO_USER_ID,
        startDate,
        endDate: null,
        attemptNumber: 1,
      }),
    );
    console.log(`✓ Período de abstinencia creado (inicio: ${startDate})`);
  } else {
    console.log('→ Período de abstinencia ya existe, sin cambios');
  }

  await ds.destroy();
  console.log('\nSeed completado. La app mobile ya puede conectarse.');
}

seed().catch((err) => {
  console.error('\nError en seed:', err.message);
  process.exit(1);
});
