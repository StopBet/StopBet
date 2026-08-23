const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

async function get<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: headers ? { 'Content-Type': 'application/json', ...headers } : undefined,
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function del<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...headers },
  })
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`)
  if (res.status === 204) return undefined as unknown as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
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
  recentCheckIns: { emotion: string; date: string }[]
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

export interface FlaggedPost {
  id: string
  authorId: string
  authorName: string | null
  authorInitials: string
  type: string
  sede: string
  body: string | null
  reportCount: number
  replyCount: number
  createdAt: string
}

export interface PatientMetrics {
  evolution: { date: string; mood: number }[]
  totalCheckIns: number
  panicCount: number
  moodAvg: number | null
}

export interface PsychologistListItem {
  id: string
  firstName: string
  lastName: string
  email: string
  accountStatus: string
  sedes: Sede[]
  patientCount: number
}

export interface CreatePsychologistPayload {
  firstName: string
  lastName: string
  email: string
  rut: string
  sedeIds: string[]
}

export interface CreatePsychologistResponse {
  id: string
  firstName: string
  lastName: string
  email: string
  sedes: Sede[]
  temporaryPassword: string
}

// ── Llamadas ──────────────────────────────────────────────────────────────────

export const api = {
  login: (email: string, password: string) =>
    post<LoginResult>('/users/login', undefined, { email, password }),

  getPatients:        () => get<PatientListItem[]>('/users/patients'),
  getPendingRequests: () => get<PendingRequest[]>('/registration/pending'),
  getAlertHistory:    () => get<AlertHistoryItem[]>('/panic/alerts/history'),
  getSedes:           () => get<Sede[]>('/sedes'),

  approveRequest: (requestId: string, psychologistId: string) =>
    patch<void>(`/registration/${requestId}/approve`, { 'x-user-id': psychologistId }),

  rejectRequest: (requestId: string, psychologistId: string) =>
    patch<void>(`/registration/${requestId}/reject`, { 'x-user-id': psychologistId }),

  reportRelapse: (patientId: string) =>
    post<void>('/achievements/relapse', { 'x-user-id': patientId }),

  getFlaggedPosts: (psychId: string) =>
    get<FlaggedPost[]>('/community/moderation/flagged', { 'x-user-id': psychId }),

  deletePost: (postId: string, psychId: string) =>
    del<{ deleted: boolean }>(`/community/posts/${postId}`, { 'x-user-id': psychId }),

  getPatientMetrics: (patientId: string) =>
    get<PatientMetrics>(`/metrics/patients/${patientId}`),

  getPsychologists: () =>
    get<PsychologistListItem[]>('/psychologists', authHeaders()),

  createPsychologist: (payload: CreatePsychologistPayload) =>
    postWithAuth<CreatePsychologistResponse>('/psychologists', payload),

  deactivatePsychologist: (id: string, reassignTo?: string) =>
    patchWithAuth<void>(`/psychologists/${id}/deactivate`, reassignTo ? { reassignTo } : {}),

  updatePsychologistSedes: (id: string, sedeIds: string[], reassignments?: Record<string, string>) =>
    patchWithAuth<void>(`/psychologists/${id}/sedes`, { sedeIds, reassignments }),
}

// ── Auth Bearer para /psychologists ─────────────────────────────────────────────
// El dashboard todavía no maneja JWT (ver CLAUDE.md "Estado actual"): el login solo
// guarda un flag en localStorage, no un token. Estas llamadas leen 'sb-dashboard-token'
// si existe; hasta que el login lo guarde, el backend responde 401.
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('sb-dashboard-token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface ApiError extends Error {
  status: number
  // Cuerpo JSON del error de Nest — trae `message`, y en los 409 de /psychologists
  // también `patientIds` / `sedeId` (ver PsychologistsService)
  body: { message?: string; [key: string]: unknown } | undefined
}

async function requestWithAuth<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    const err = new Error(`${method} ${path} → ${res.status}`) as ApiError
    err.status = res.status
    err.body = text ? JSON.parse(text) : undefined
    throw err
  }
  if (res.status === 204) return undefined as unknown as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const postWithAuth = <T,>(path: string, body: unknown) => requestWithAuth<T>('POST', path, body)
const patchWithAuth = <T,>(path: string, body: unknown) => requestWithAuth<T>('PATCH', path, body)
