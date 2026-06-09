import type {
  AbstinencePeriod,
  ActiveAlertResponse,
  AchievementsData,
  AiSessionSummary,
  BadgeMilestone,
  BillingStatus,
  CheckIn,
  EmotionType,
  Notification,
  PanicAlertDto,
  PatientProgress,
  PaymentMethod,
  Sede,
  SendMessageResponse,
  SponsorInfo,
  StartSessionResponse,
  SubmitRegistrationResponse,
} from '@stopbet/shared-types';

// localhost funciona en dispositivo real gracias a `adb reverse tcp:3000 tcp:3000`
const BASE_URL = 'http://localhost:3000';

const REQUEST_TIMEOUT_MS = 8000;

async function request<T>(
  path: string,
  options?: RequestInit & { userId?: string },
): Promise<T> {
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
    // 204 No Content
    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  // ── Progreso del paciente ────────────────────────────────────────────
  getProgress: (userId: string) =>
    request<PatientProgress>(`/users/${userId}/progress`, { userId }),

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
    request<AbstinencePeriod>('/achievements/relapse', {
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
};
