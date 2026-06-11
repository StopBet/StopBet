import type {
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
  PatientProgress,
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

// localhost funciona en dispositivo real gracias a `adb reverse tcp:3000 tcp:3000`
const BASE_URL = 'http://localhost:3000';

const REQUEST_TIMEOUT_MS = 8000;

async function request<T>(
  path: string,
  options?: RequestInit & { userId?: string },
): Promise<T> {
  if (devFlags.simulateOffline) throw new Error('Network request failed');
  const { userId, ...fetchOpts } = options ?? {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...fetchOpts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
        ...fetchOpts.headers,
      },
    });
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

export const api = {
  // ── Progreso del paciente ────────────────────────────────────────────
  getProgress: async (userId: string) => {
    const data = await request<PatientProgress>(`/users/${userId}/progress`, { userId });
    const override = devFlags.overrideDays;
    return override !== null ? { ...data, daysStreak: override } : data;
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
  getAchievements: (userId: string) =>
    request<AchievementsData>('/achievements', { userId }),

  reportRelapse: (userId: string) =>
    request<RelapseResponse>('/achievements/relapse', {
      userId,
      method: 'POST',
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

  createForumPost: (userId: string, sede: string, body: string) =>
    request<CommunityPost>('/community/posts', {
      userId,
      method: 'POST',
      body: JSON.stringify({ sede, body }),
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

  createReply: (userId: string, postId: string, body: string) =>
    request<CommunityReply>(`/community/posts/${postId}/replies`, {
      userId,
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  reportPost: (userId: string, postId: string) =>
    request<{ reported: boolean }>(`/community/posts/${postId}/report`, {
      userId,
      method: 'POST',
    }),
};
