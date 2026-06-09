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

// ── Facturación y suspensión de cuenta ───────────────────────────────────

export type AccountStatus = 'active' | 'suspended';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue';

export interface Invoice {
  id: string;
  userId: string;
  month: string;        // 'YYYY-MM'
  amountCLP: number;
  status: InvoiceStatus;
  dueDate: string;      // 'YYYY-MM-DD'
  paidAt: string | null;
  createdAt: string;
}

export interface BillingStatus {
  accountStatus: AccountStatus;
  overdueInvoices: Invoice[];
  totalOwedCLP: number;
  overdueMonths: number;
  firstOverdueDate: string | null;
  daysOverdue: number;
  nextPaymentDate: string | null;
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

export interface RelapseResponse {
  period: AbstinencePeriod;
  // Mensaje de contención validado por AJUTER, elegido al azar
  message: string;
}

// ── Asistente Virtual IA ─────────────────────────────────────────────────

export type AISessionStatus = 'active' | 'closed';
export type RiskLevel = 'low' | 'medium' | 'high';
export type TechniqueType = 'breathing' | 'grounding' | 'postponement';

export interface AIMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  techniqueTriggered: TechniqueType | null;
  createdAt: string;
}

export interface AISession {
  id: string;
  userId: string;
  status: AISessionStatus;
  previousContext: string | null;
  startedAt: string;
  closedAt: string | null;
  lastActivityAt: string | null;
}

export interface AiSessionSummary {
  id: string;
  sessionId: string;
  userId: string;
  mood: string | null;
  techniqueUsed: string | null;
  trigger: string | null;
  riskLevel: RiskLevel;
  durationMinutes: number;
  progressNote: string | null;
  createdAt: string;
}

export interface StartSessionResponse {
  session: AISession;
  messages: AIMessage[];
  previousContext: string | null;
}

export interface SendMessageResponse {
  userMessage: AIMessage;
  assistantMessage: AIMessage;
  techniqueTriggered: TechniqueType | null;
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

// ── Botón de Pánico ───────────────────────────────────────────────────────

export type PanicAlertStatus = 'pending' | 'responded' | 'escalated' | 'cancelled';

export interface SponsorInfo {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isOnline: boolean;
}

export interface PanicAlertDto {
  id: string;
  patientId: string;
  sponsorId: string;
  status: PanicAlertStatus;
  communityNotified: boolean;
  respondedAt: string | null;
  escalatedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface ActiveAlertResponse {
  alert: PanicAlertDto | null;
  sponsor: SponsorInfo | null;
}
