import type {
  AbstinencePeriod,
  AchievementsData,
  BadgeMilestone,
  CheckIn,
  EmotionType,
  Notification,
  PatientProgress,
  PaymentMethod,
  Sede,
  SubmitRegistrationResponse,
} from '@stopbet/shared-types';

const BASE_URL = process.env.API_URL ?? 'http://10.0.2.2:3000'; // 10.0.2.2 = localhost desde emulador Android

async function request<T>(
  path: string,
  options?: RequestInit & { userId?: string },
): Promise<T> {
  const { userId, ...fetchOpts } = options ?? {};
  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOpts,
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
};
