// Tipos compartidos entre backend y web dashboard.

export type UserRole = 'patient' | 'psychologist' | 'sponsor' | 'family';

// approval_pending → payment_pending → complete
export type OnboardingStatus = 'approval_pending' | 'payment_pending' | 'complete';

export interface BaseUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Check-in emocional diario ──────────────────────────────────────────────

export type EmotionType = 'tired' | 'anxious' | 'angry' | 'lonely' | 'good';

export interface CheckIn {
  id: string;
  userId: string;
  emotion: EmotionType;
  date: string;       // 'YYYY-MM-DD'
  createdAt: string;
}

// ── Notificaciones ────────────────────────────────────────────────────────

export type NotificationType = 'warning' | 'info' | 'success' | 'danger';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

// ── Progreso del paciente ─────────────────────────────────────────────────

export interface PatientProgress {
  userId: string;
  daysStreak: number;
  nextMilestone: number;
  lastCheckIn: CheckIn | null;
}

// ── Sedes AJUTER ─────────────────────────────────────────────────────────

export type SedeType = 'presential' | 'online';

export interface Sede {
  id: string;
  name: string;
  address: string;
  activeGroups: number;
  type: SedeType;
}

// ── Registro y onboarding ─────────────────────────────────────────────────

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface RegistrationRequest {
  id: string;
  userId: string;
  sedeId: string;
  institutionId: string;
  status: RegistrationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface SubmitRegistrationResponse {
  userId: string;
  requestId: string;
  status: RegistrationStatus;
}

// ── Suscripción / pago mensual ────────────────────────────────────────────

export type PaymentMethod = 'card' | 'webpay' | 'transfer';
export type SubscriptionStatus = 'pending' | 'active' | 'cancelled';

export interface Subscription {
  id: string;
  userId: string;
  plan: string;
  amountCLP: number;
  paymentMethod: PaymentMethod;
  status: SubscriptionStatus;
  expiresAt: string | null;
  createdAt: string;
}

// ── Logros y gamificación ─────────────────────────────────────────────────

export type BadgeMilestone = 1 | 3 | 7 | 14 | 21 | 30 | 45 | 60 | 75 | 90;

export interface EarnedBadge {
  id: string;
  milestone: BadgeMilestone;
  earnedAt: string;
  sharedToCommunity: boolean;
  periodId: string;
}

export interface AbstinencePeriod {
  id: string;
  userId: string;
  startDate: string;
  endDate: string | null;
  daysAchieved: number;
  attemptNumber: number;
  earnedBadges: EarnedBadge[];
}

export interface AchievementsData {
  currentPeriod: AbstinencePeriod;
  historicalPeriods: AbstinencePeriod[];
  newestMilestone: BadgeMilestone | null;
}

// ── Comunidad y Red de Apoyo ──────────────────────────────────────────────

export type CommunityPostType = 'announcement' | 'forum_post';
export type ReactionEmoji = '💪' | '❤️' | '🤗';

export interface ReactionSummary {
  emoji: ReactionEmoji;
  count: number;
  userReacted: boolean;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  type: CommunityPostType;
  sede: string;
  title: string | null;
  body: string;
  eventDate: string | null;
  reportCount: number;
  replyCount: number;
  reactions: ReactionSummary[];
  userAttends: boolean;
  createdAt: string;
}

export interface CommunityReply {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  body: string;
  createdAt: string;
}
