// Tipos compartidos entre backend y web dashboard.

export type UserRole = 'patient' | 'psychologist' | 'sponsor' | 'family' | 'coordinator';

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
  // Instante exacto en que se otorgó. `earnedAt` es solo el día, y no alcanza para
  // saber si la insignia se ganó recién (el chip "¡Nuevo!" dura una hora).
  createdAt: string;
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
  // null significa "no se pudo evaluar" (falló el LLM), distinto de 'low',
  // que significa "evaluado y sin riesgo". Confundirlos es registrar un dato
  // clínico falso.
  riskLevel: RiskLevel | null;
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
  // null cuando el paciente no tenía padrino activo al disparar la alerta (CA1.2)
  sponsorId: string | null;
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

// ── Autenticación ─────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  sedeId: string | null;
  // Opcional: las sesiones guardadas antes de que existiera no la traen.
  institutionId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  sedeId: string | null;
}

// ── Métricas del paciente (dashboard clínico, HdU04) ───────────────────────

// Mapa único ánimo → escala 1-5. Antes duplicado en apps/web (OverviewPage).
export const EMOTION_MOOD: Record<EmotionType, number> = {
  good: 5,
  tired: 3,
  anxious: 2,
  lonely: 2,
  angry: 1,
};

export interface PatientMetrics {
  evolution: { date: string; mood: number }[]; // últimos 30 días, un punto por check-in
  totalCheckIns: number;                       // del periodo
  panicCount: number;                          // del periodo, no histórico
  moodAvg: number | null;                      // null si no hay check-ins — nunca 0
}

// ── HdU02 CA2.1: señal de crisis por mensaje ──────────────────────────────
// Tipos nuevos al final para no modificar SendMessageResponse, que comparten
// otras ramas. Los umbrales se ajustan contra el documento de reglas (S.1).

export type CrisisSuggestion = 'panic_button' | 'contact_sponsor' | 'crisis_line';

export interface CrisisSignal {
  riskLevel: RiskLevel;
  // El criterio pide riesgo alto *sostenido*, no un pico aislado
  sustained: boolean;
  suggestions: CrisisSuggestion[];
}

export interface SendMessageWithRiskResponse extends SendMessageResponse {
  crisis: CrisisSignal | null;
}

// ── HdU06 / HdU24: validador de RUT módulo 11, compartido entre mobile y backend ──
export * from './validators/rut';

// ── HdU24: gestión de cuentas de psicólogo ────────────────────────────────
// Un psicólogo puede atender varias sedes y sus pacientes están repartidos entre ellas, así
// que reasignar exige saber cuántos hay en cada una: un total suelto no alcanza para decidir
// a quién se le pasa qué. Solo trae las sedes con al menos un paciente activo.
export interface PatientsBySede {
  sedeId: string;
  sedeName: string;
  count: number;
}

export interface PsychologistListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  accountStatus: AccountStatus;
  sedes: Sede[];
  patientCount: number;
  patientsBySede: PatientsBySede[];
}

export interface CreatePsychologistResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  sedes: Sede[];
  // Contraseña en texto plano — se devuelve una sola vez en el 201, nunca se persiste así
  temporaryPassword: string;
  // false si el SMTP está sin configurar o falló: la entrega queda a cargo del coordinador
  credentialsEmailSent: boolean;
}

// ── HdU13: ficha clínica del paciente ──

// Los cinco campos que el CA1 declara obligatorios. Se nombran acá una sola vez porque el
// backend los recorre para validar y para calcular qué cambió entre dos versiones: una lista
// suelta en cada lado se desincroniza al agregar el sexto.
export const CLINICAL_RECORD_FIELDS = [
  'admissionReason',
  'gamblingHistory',
  'triggers',
  'healthAndSupport',
  'treatmentGoals',
] as const;

export type ClinicalRecordField = (typeof CLINICAL_RECORD_FIELDS)[number];

export type ClinicalRecordContent = Record<ClinicalRecordField, string>;

export interface ClinicalRecord extends ClinicalRecordContent {
  id: string;
  patientId: string;
  // Quién hizo la última modificación y cuándo (CA2)
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
  createdAt: string;
}

// CA1: el psicólogo abre el perfil por primera vez y ve la ficha vacía, no un 404. `exists`
// distingue "todavía no se ha escrito nada" de "hay una ficha con campos en blanco", que para
// el historial de auditoría no son lo mismo.
export interface ClinicalRecordView {
  exists: boolean;
  record: ClinicalRecord | null;
  content: ClinicalRecordContent;
}

// Para la lista de pacientes: solo dice si la ficha existe y cuándo se tocó, nunca su
// contenido. Sirve para marcar a quién le falta sin pedir cinco fichas completas.
export interface ClinicalRecordStatus {
  patientId: string;
  updatedAt: string;
  updatedByName: string;
}

export interface ClinicalRecordFieldChange {
  field: ClinicalRecordField;
  before: string;
  after: string;
}

// CA4: una entrada por guardado, con el detalle de qué campos cambiaron en cada uno.
export interface ClinicalRecordVersion {
  id: string;
  recordId: string;
  versionNumber: number;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  changedFields: ClinicalRecordFieldChange[];
}

// ── Cuestionario de ingreso (HdU13 + HdU19) ──
//
// Lo que el paciente declara al registrarse. Alimenta la ficha clínica, pero **no se mezcla
// con ella**: el psicólogo lo ve en solo lectura y escribe su ficha aparte. Si el paciente
// minimiza o se equivoca, el contraste entre lo declarado y lo observado es material clínico.
//
// Todo es opcional: quien llena esto está pidiendo ayuda, y una pregunta obligatoria de más es
// alguien que abandona el registro a medio camino.

export const INTAKE_MOTIVES = [
  'Perdí dinero que necesitaba',
  'Alguien cercano me lo pidió',
  'Problemas en mi casa o mi pareja',
  'Problemas en el trabajo o los estudios',
  'Lo decidí por mi cuenta',
  'Me derivó un profesional de la salud',
] as const;

export const INTAKE_GAMBLING_TYPES = [
  'Apuestas deportivas en línea',
  'Casinos en línea',
  'Tragamonedas',
  'Casino presencial',
  'Loterías o raspaditos',
  'Bingo',
  'Juegos de cartas con dinero',
] as const;

export const INTAKE_DURATIONS = [
  'Menos de 6 meses',
  'Entre 6 meses y 1 año',
  'Entre 1 y 3 años',
  'Entre 3 y 5 años',
  'Más de 5 años',
] as const;

export const INTAKE_TRIGGERS = [
  'Cuando recibo dinero o me pagan',
  'Cuando estoy solo',
  'Cuando estoy estresado o ansioso',
  'Después de una discusión',
  'Cuando veo publicidad de apuestas',
  'Los fines de semana o cuando hay partidos',
  'De noche o cuando no puedo dormir',
] as const;

// Las respuestas se guardan como el texto de la alternativa, no como un código. Un `motive: 3`
// obliga a mantener sincronizadas dos listas para leer una ficha, y si mañana se reordenan las
// opciones, las fichas viejas empiezan a decir otra cosa sin que nada falle.
export interface IntakeAnswers {
  motive: string | null;
  motiveOther: string | null;
  gamblingTypes: string[];
  gamblingTypesOther: string | null;
  duration: string | null;
  triggers: string[];
  triggersOther: string | null;
}

// Lo que el panel muestra en la ficha, ya resuelto: las respuestas más cuándo se declararon.
export interface IntakeView {
  answered: boolean;
  submittedAt: string | null;
  answers: IntakeAnswers | null;
}

// Anotaciones del seguimiento clínico: cronología que se acumula, a diferencia de la ficha,
// que se corrige. No se editan ni se borran.
export interface ClinicalNote {
  id: string;
  patientId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

// ── HdU06: validación de fechas de calendario, compartida entre mobile y backend ──
export * from './validators/date';
