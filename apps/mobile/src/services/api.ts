import type {
  LoginResponse,
  ActiveAlertResponse,
  AchievementsData,
  RelapseResponse,
  AiSessionSummary,
  BadgeMilestone,
  BillingStatus,
  CheckIn,
  CommunityPost,
  CommunityReply,
  EmotionType,
  Notification,
  PaginatedResponse,
  PanicAlertDto,
  PaymentMethod,
  ReactionEmoji,
  ReactionSummary,
  Sede,
  SendMessageResponse,
  SponsorInfo,
  StartSessionResponse,
  SubmitRegistrationResponse,
} from '@stopbet/shared-types';

import { devFlags } from '../store/devFlags';
import { session } from './session';
import { singleFlight } from './singleFlight';

// ── Detección de recaída externa (psicólogo desde dashboard) ─────────────────
let _lastAttemptNumber: number | null = null;
let _pendingExternalRelapse = false;
let _suppressExternalDetection = false;

export function hasPendingExternalRelapse(): boolean {
  return _pendingExternalRelapse;
}
export function acknowledgePendingRelapse(): void {
  _pendingExternalRelapse = false;
}
export function suppressNextExternalRelapseDetection(): void {
  _suppressExternalDetection = true;
}

/**
 * El número de intento recordado es de un paciente concreto. Al cambiar de cuenta, el de
 * la nueva casi nunca coincide con el de la anterior y la app le anunciaba a quien recién
 * entraba: "tu psicólogo registró una recaída en tu historial". En una app clínica ese
 * aviso falso no es un detalle.
 */
export function resetRelapseDetection(): void {
  _lastAttemptNumber = null;
  _pendingExternalRelapse = false;
  _suppressExternalDetection = false;
}

// En debug el teléfono alcanza el backend del PC por `adb reverse tcp:3000 tcp:3000`.
// En release no hay túnel: el APK que se instala fuera del computador de alguien
// del equipo tiene que ir contra el backend desplegado o no llega a nada.
const BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://stopbetbackend-production.up.railway.app';

const REQUEST_TIMEOUT_MS = 25000;

// El access token dura 15 min. Ante un 401 se rota una vez con el refresh token; si eso
// falla, se limpia la sesión y la app vuelve al login.
async function tryRefresh(): Promise<boolean> {
  const token = session.getRefreshToken();
  if (!token) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    if (!res.ok) return false;
    await session.save((await res.json()) as LoginResponse);
    return true;
  } catch {
    return false;
  }
}

const refreshOnce = singleFlight(tryRefresh);

async function request<T>(
  path: string,
  options?: RequestInit & { userId?: string },
): Promise<T> {
  if (devFlags.simulateOffline) throw new Error('Network request failed');
  const { userId, ...fetchOpts } = options ?? {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const enviar = () => {
      const token = session.getAccessToken();
      return fetch(`${BASE_URL}${path}`, {
        ...fetchOpts,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // 14 de 17 controladores del backend todavía leen `x-user-id` sin verificarlo.
          // Se sigue mandando, pero con el id real de la sesión, no con uno fijo.
          ...(userId ? { 'x-user-id': userId } : {}),
          ...fetchOpts.headers,
        },
      });
    };

    let res = await enviar();

    // Las rutas de /auth quedan fuera del reintento: un 401 ahí significa "credenciales
    // incorrectas", no "token vencido".
    if (res.status === 401 && !path.startsWith('/auth/')) {
      if (await refreshOnce()) {
        res = await enviar();
      } else {
        await session.clear();
        session.notifyExpired();
      }
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${body}`);
    }
    // 204 No Content o 200 con cuerpo vacío (algunos endpoints devuelven body vacío)
    if (res.status === 204) return undefined as unknown as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Tipos de la vista del equipo clínico ─────────────────────────────────────
// Se declaran acá y no en `@stopbet/shared-types` por la misma razón que en el dashboard
// web, que ya los tiene locales: tocar el paquete compartido obliga a todo el equipo a
// recompilarlo después de pullear. Si algún día se mueven, se mueven los dos juntos.

export interface StaffPatient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  sedeId: string | null;
  daysStreak: number;
  accountStatus: string;
  onboardingStatus: string | null;
  lastCheckIn: { emotion: string; date: string } | null;
  recentCheckIns: { emotion: string; date: string }[];
  createdAt: string;
}

export type PanicStatus = 'pending' | 'responded' | 'escalated' | 'cancelled';

export interface StaffAlert {
  id: string;
  patientId: string;
  patientName: string;
  sedeId: string | null;
  status: PanicStatus;
  communityNotified: boolean;
  createdAt: string;
  respondedAt: string | null;
  escalatedAt: string | null;
  cancelledAt: string | null;
}

export interface StaffPendingRequest {
  id: string;
  userId: string;
  sedeId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface FlaggedPost {
  id: string;
  authorId: string;
  authorName: string | null;
  type: string;
  sede: string;
  body: string | null;
  reportCount: number;
  replyCount: number;
  createdAt: string;
}

export interface StaffProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  accountStatus: string;
  sedes: Sede[];
  patientCount: number;
  patientsBySede: { sedeId: string; sedeName: string; count: number }[];
}

export const api = {
  // ── Sesión ───────────────────────────────────────────────────────────
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const data = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await session.save(data);
    return data;
  },

  logout: async (): Promise<void> => {
    const refreshToken = session.getRefreshToken();
    try {
      if (refreshToken) {
        await request<void>('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Si el servidor no responde igual se cierra la sesión local: dejar al paciente
      // dentro de una cuenta que quiso cerrar es peor que un token sin revocar.
    } finally {
      await session.clear();
    }
  },

  // ── Check-in emocional ───────────────────────────────────────────────
  getTodayCheckIn: (userId: string) =>
    request<CheckIn | null>('/check-ins/today', { userId }),

  createCheckIn: (userId: string, emotion: EmotionType) =>
    request<CheckIn>('/check-ins', {
      userId,
      method: 'POST',
      body: JSON.stringify({ emotion }),
    }),

  resetTodayCheckIn: (userId: string) =>
    request<{ deleted: boolean }>('/check-ins/today', { userId, method: 'DELETE' }),

  // ── Notificaciones ───────────────────────────────────────────────────
  getNotifications: (userId: string) =>
    request<Notification[]>('/notifications', { userId }),

  markNotificationRead: (userId: string, notificationId: string) =>
    request<void>(`/notifications/${notificationId}/read`, {
      userId,
      method: 'PATCH',
    }),

  // ── Sedes ────────────────────────────────────────────────────────────
  getSedes: () => request<Sede[]>('/sedes'),

  // ── Registro ─────────────────────────────────────────────────────────
  submitRegistration: (data: {
    firstName: string;
    lastName: string;
    rut: string;
    email: string;
    phone?: string;
    birthDate?: string;
    address?: string;
    referralSource?: string;
    sedeId: string;
    institutionId: string;
  }) =>
    request<SubmitRegistrationResponse>('/registration/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getRegistrationStatus: (requestId: string) =>
    request<{ status: string }>(`/registration/${requestId}`),

  // ── Suscripción / pago ───────────────────────────────────────────────
  createSubscription: (data: { userId: string; paymentMethod: PaymentMethod }) =>
    request<{ id: string; status: string }>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── Facturación / suspensión ─────────────────────────────────────────
  getBillingStatus: (userId: string) =>
    request<BillingStatus>('/billing/status', { userId }),

  payOverdue: (userId: string) =>
    request<BillingStatus>('/billing/pay', { userId, method: 'POST' }),

  getFamilyLink: (userId: string) =>
    request<{ token: string; url: string }>('/billing/family-link', { userId }),

  // ── Logros y gamificación ────────────────────────────────────────────
  getAchievements: async (userId: string) => {
    const data = await request<AchievementsData>('/achievements', { userId });

    // Detectar cambio de período externo (psicólogo registró recaída desde dashboard)
    if (_lastAttemptNumber !== null && data.currentPeriod.attemptNumber > _lastAttemptNumber) {
      if (!_suppressExternalDetection) _pendingExternalRelapse = true;
      devFlags.setOverrideDays(null); // override stale → limpiar siempre
    }
    _suppressExternalDetection = false;
    _lastAttemptNumber = data.currentPeriod.attemptNumber;

    const override = devFlags.overrideDays;
    if (override === null) return data;

    const MILESTONES = [1, 3, 7, 14, 21, 30, 45, 60, 75, 90] as const;
    const startMs = Date.now() - override * 86_400_000;
    const startDate = new Date(startMs).toISOString().split('T')[0];

    const earnedBadges = MILESTONES
      .filter((m) => m <= override)
      .map((m) => ({
        id: `dev-badge-${m}`,
        milestone: m as (typeof MILESTONES)[number],
        earnedAt: new Date(startMs + m * 86_400_000).toISOString(),
        sharedToCommunity: false,
        periodId: data.currentPeriod.id,
        // Insignias simuladas: se "ganaron" en el pasado, así que no deben salir
        // con el chip de recién obtenida.
        createdAt: new Date(startMs + m * 86_400_000).toISOString(),
      }));

    const newestMilestone = earnedBadges.length > 0
      ? earnedBadges[earnedBadges.length - 1].milestone
      : null;

    return {
      ...data,
      currentPeriod: {
        ...data.currentPeriod,
        startDate,
        daysAchieved: override,
        earnedBadges,
      },
      newestMilestone,
    } satisfies AchievementsData;
  },

  reportRelapse: (userId: string, devStartDate?: string) =>
    request<RelapseResponse>('/achievements/relapse', {
      userId,
      method: 'POST',
      body: JSON.stringify(devStartDate ? { devStartDate } : {}),
    }),

  devSetDays: (userId: string, days: number) =>
    request<{ startDate: string; daysAchieved: number }>('/achievements/dev-set-days', {
      userId,
      method: 'POST',
      body: JSON.stringify({ days }),
    }),

  shareBadge: (userId: string, milestone: BadgeMilestone) =>
    request<void>(`/achievements/badges/${milestone}/share`, {
      userId,
      method: 'POST',
    }),

  // ── Asistente IA ─────────────────────────────────────────────────────
  startAiSession: (userId: string) =>
    request<StartSessionResponse>('/ai/sessions', {
      userId,
      method: 'POST',
    }),

  getActiveAiSession: (userId: string) =>
    request<StartSessionResponse | null>('/ai/sessions/active', { userId }),

  sendAiMessage: (userId: string, sessionId: string, content: string) =>
    request<SendMessageResponse>(`/ai/sessions/${sessionId}/messages`, {
      userId,
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  closeAiSession: (userId: string, sessionId: string) =>
    request<AiSessionSummary>(`/ai/sessions/${sessionId}/close`, {
      userId,
      method: 'POST',
    }),

  getAiSummaries: (userId: string) =>
    request<AiSessionSummary[]>('/ai/sessions/summaries', { userId }),

  // ── Botón de pánico ──────────────────────────────────────────────────
  getSponsorInfo: (userId: string) =>
    request<SponsorInfo | null>('/panic/sponsor', { userId }),

  createPanicAlert: (userId: string) =>
    request<PanicAlertDto>('/panic/alerts', { userId, method: 'POST' }),

  getPanicActiveAlert: (userId: string) =>
    request<ActiveAlertResponse>('/panic/alerts/active', { userId }),

  respondToPanicAlert: (sponsorId: string, alertId: string) =>
    request<PanicAlertDto>(`/panic/alerts/${alertId}/respond`, {
      userId: sponsorId,
      method: 'POST',
    }),

  cancelActivePanicAlert: (userId: string) =>
    request<{ cancelled: boolean }>('/panic/alerts/active', { userId, method: 'DELETE' }),

  cancelPanicAlert: (userId: string, alertId: string) =>
    request<PanicAlertDto>(`/panic/alerts/${alertId}/cancel`, {
      userId,
      method: 'POST',
    }),

  escalatePanicAlert: (userId: string, alertId: string) =>
    request<PanicAlertDto>(`/panic/alerts/${alertId}/escalate`, {
      userId,
      method: 'POST',
    }),

  notifyCommunity: (userId: string, alertId: string) =>
    request<{ communityNotified: boolean }>(`/panic/alerts/${alertId}/community`, {
      userId,
      method: 'POST',
    }),

  getPendingPanicAlerts: (sponsorId: string) =>
    request<PanicAlertDto[]>('/panic/pending', { userId: sponsorId }),

  // ── Comunidad y red de apoyo ─────────────────────────────────────────
  getAnnouncements: (userId: string, sede: string) =>
    request<CommunityPost[]>(
      `/community/announcements?sede=${encodeURIComponent(sede)}`,
      { userId },
    ),

  toggleAttendance: (userId: string, announcementId: string) =>
    request<{ attends: boolean }>(
      `/community/announcements/${announcementId}/attend`,
      { userId, method: 'POST' },
    ),

  getForumPosts: (userId: string, sede: string, page = 1, limit = 20) =>
    request<PaginatedResponse<CommunityPost>>(
      `/community/posts?sede=${encodeURIComponent(sede)}&page=${page}&limit=${limit}`,
      { userId },
    ),

  // `clientRequestId` se conserva entre reintentos: si la respuesta se pierde de
  // vuelta y el paciente vuelve a enviar, el backend devuelve el post ya creado en
  // vez de publicarlo dos veces.
  createForumPost: (userId: string, sede: string, body: string, clientRequestId?: string) =>
    request<CommunityPost>('/community/posts', {
      userId,
      method: 'POST',
      body: JSON.stringify({ sede, body, clientRequestId }),
    }),

  addReaction: (userId: string, postId: string, emoji: ReactionEmoji) =>
    request<{ reactions: ReactionSummary[] }>(`/community/posts/${postId}/reactions`, {
      userId,
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  removeReaction: (userId: string, postId: string, emoji: ReactionEmoji) =>
    request<{ reactions: ReactionSummary[] }>(
      `/community/posts/${postId}/reactions/${encodeURIComponent(emoji)}`,
      { userId, method: 'DELETE' },
    ),

  getReplies: (userId: string, postId: string) =>
    request<CommunityReply[]>(`/community/posts/${postId}/replies`, { userId }),

  createReply: (userId: string, postId: string, body: string, clientRequestId?: string) =>
    request<CommunityReply>(`/community/posts/${postId}/replies`, {
      userId,
      method: 'POST',
      body: JSON.stringify({ body, clientRequestId }),
    }),

  reportPost: (userId: string, postId: string, reason: string) =>
    request<{ reported: boolean }>(`/community/posts/${postId}/report`, {
      userId,
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  deletePost: (userId: string, postId: string) =>
    request<{ deleted: boolean }>(`/community/posts/${postId}`, {
      userId,
      method: 'DELETE',
    }),

  registrarTokenPush: (userId: string, token: string) =>
    request<{ registrado: boolean }>('/push/tokens', {
      userId,
      method: 'POST',
      body: JSON.stringify({ token, platform: 'android' }),
    }),

  getCommunityMute: (userId: string) =>
    request<{ muted: boolean }>('/notifications/community-mute', { userId }),

  muteCommunity: (userId: string) =>
    request<{ muted: boolean }>('/notifications/community-mute', { userId, method: 'POST' }),

  unmuteCommunity: (userId: string) =>
    request<{ muted: boolean }>('/notifications/community-mute', { userId, method: 'DELETE' }),

  // ── Vista del equipo clínico ─────────────────────────────────────────
  // Estos cinco endpoints ya exigen `Authorization: Bearer` y rol en el backend, así que
  // no se les manda `x-user-id`: el servidor saca quién pregunta del token.

  getStaffProfile: (psychologistId: string) =>
    request<StaffProfile>(`/psychologists/${psychologistId}`),

  getStaffPatients: () => request<StaffPatient[]>('/users/patients'),

  getStaffAlerts: () => request<StaffAlert[]>('/panic/alerts/history'),

  getStaffPendingRequests: () =>
    request<StaffPendingRequest[]>('/registration/pending'),

  getFlaggedPosts: (sede?: string) =>
    request<FlaggedPost[]>(
      `/community/moderation/flagged${sede ? `?sede=${encodeURIComponent(sede)}` : ''}`,
    ),

  createAnnouncement: (data: {
    sede: string;
    body: string;
    title?: string;
    eventDate?: string;
  }) =>
    request<CommunityPost>('/community/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
