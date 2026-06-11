const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`)
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
    return res.json() as Promise<T>
  } catch {
    return fallback
  }
}

async function patch<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
  })
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, headers?: Record<string, string>, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = new Error(`POST ${path} → ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  if (res.status === 204) return undefined as unknown as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface LoginResult {
  id: string
  role: string
  firstName: string
  lastName: string
}

export interface PatientListItem {
  id: string
  firstName: string
  lastName: string
  email: string
  sedeId: string | null
  daysStreak: number
  accountStatus: string
  onboardingStatus: string | null
  lastCheckIn: { emotion: string; date: string } | null
  createdAt: string
}

export interface PendingRequest {
  id: string
  userId: string
  sedeId: string
  firstName: string
  lastName: string
  email: string
  createdAt: string
}

export interface AlertHistoryItem {
  id: string
  patientId: string
  patientName: string
  sedeId: string | null
  status: 'pending' | 'responded' | 'escalated' | 'cancelled'
  communityNotified: boolean
  createdAt: string
  respondedAt: string | null
  escalatedAt: string | null
  cancelledAt: string | null
}

export interface Sede {
  id: string
  name: string
  address: string
  type: string
  isActive: boolean
}

// ── Llamadas ──────────────────────────────────────────────────────────────────

export const api = {
  login: (email: string, password: string) =>
    post<LoginResult>('/users/login', undefined, { email, password }),

  getPatients:        () => get<PatientListItem[]>('/users/patients',        []),
  getPendingRequests: () => get<PendingRequest[]>('/registration/pending',   []),
  getAlertHistory:    () => get<AlertHistoryItem[]>('/panic/alerts/history', []),
  getSedes:           () => get<Sede[]>('/sedes',                            []),

  approveRequest: (requestId: string, psychologistId: string) =>
    patch<void>(`/registration/${requestId}/approve`, { 'x-user-id': psychologistId }),

  rejectRequest: (requestId: string, psychologistId: string) =>
    patch<void>(`/registration/${requestId}/reject`, { 'x-user-id': psychologistId }),

  reportRelapse: (patientId: string) =>
    post<void>('/achievements/relapse', { 'x-user-id': patientId }),
}
