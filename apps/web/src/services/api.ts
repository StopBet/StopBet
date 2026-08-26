const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// ── Sesión ────────────────────────────────────────────────────────────────────
// El backend exige Authorization: Bearer en los endpoints con JwtAuthGuard
// (/users/patients, /metrics/*, /family/*). Los que aún leen x-user-id siguen
// recibiéndolo explícitamente desde cada llamada, más abajo.

const ACCESS_KEY = 'sb-access-token'
const REFRESH_KEY = 'sb-refresh-token'

function readStored(key: string): string | null {
  return localStorage.getItem(key) || sessionStorage.getItem(key)
}

let accessToken: string | null = readStored(ACCESS_KEY)
let refreshToken: string | null = readStored(REFRESH_KEY)
let onSessionExpired: (() => void) | null = null

export const session = {
  setTokens(tokens: { accessToken: string; refreshToken: string }, keepSession: boolean) {
    accessToken = tokens.accessToken
    refreshToken = tokens.refreshToken
    const storage = keepSession ? localStorage : sessionStorage
    storage.setItem(ACCESS_KEY, tokens.accessToken)
    storage.setItem(REFRESH_KEY, tokens.refreshToken)
  },

  clear() {
    accessToken = null
    refreshToken = null
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(ACCESS_KEY)
      storage.removeItem(REFRESH_KEY)
    }
  },

  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,

  // App.tsx se registra acá para mandar al login cuando el refresh ya no sirve
  setOnSessionExpired(cb: (() => void) | null) {
    onSessionExpired = cb
  },
}

function buildHeaders(headers?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...headers,
  }
}

// El access token dura 15 min. Ante un 401 se intenta rotar una vez con el
// refresh token; si eso falla, se limpia la sesión y se avisa a la UI.
async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as LoginResponse
    // Se conserva el mismo storage que eligió el usuario al entrar
    const keepSession = localStorage.getItem(ACCESS_KEY) !== null
    session.setTokens(data, keepSession)
    return true
  } catch {
    return false
  }
}

async function request(
  path: string,
  init: RequestInit,
  headers?: Record<string, string>,
): Promise<Response> {
  const send = () => fetch(`${BASE}${path}`, { ...init, headers: buildHeaders(headers) })

  let res = await send()

  // Las rutas de /auth quedan fuera del reintento: un 401 ahí significa
  // "credenciales incorrectas", no "token vencido". Sin esta guarda, fallar el
  // login con un refresh token viejo guardado mostraría "sesión expirada".
  const isAuthRoute = path.startsWith('/auth/')

  if (res.status === 401 && refreshToken && !isAuthRoute) {
    if (await tryRefresh()) {
      res = await send()
    } else {
      session.clear()
      onSessionExpired?.()
    }
  }
  return res
}

function failed(method: string, path: string, res: Response): Error & { status: number } {
  const err = new Error(`${method} ${path} → ${res.status}`) as Error & { status: number }
  err.status = res.status
  return err
}

async function get<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const res = await request(path, {}, headers)
  if (!res.ok) throw failed('GET', path, res)
  return res.json() as Promise<T>
}

async function del<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const res = await request(path, { method: 'DELETE' }, headers)
  if (!res.ok) throw failed('DELETE', path, res)
  if (res.status === 204) return undefined as unknown as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function patch<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const res = await request(path, { method: 'PATCH' }, headers)
  if (!res.ok) throw failed('PATCH', path, res)
  return res.json() as Promise<T>
}

async function post<T>(path: string, headers?: Record<string, string>, body?: unknown): Promise<T> {
  const res = await request(
    path,
    { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined },
    headers,
  )
  if (!res.ok) throw failed('POST', path, res)
  if (res.status === 204) return undefined as unknown as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

// Espeja AuthUser/LoginResponse del backend. Se definen locales porque apps/web
// no depende de @stopbet/shared-types; unificarlos queda como deuda.
export type UserRole = 'patient' | 'psychologist' | 'sponsor' | 'family' | 'coordinator'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  firstName: string
  lastName: string
  sedeId: string | null
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

// Shape real de GET /family/link-status (family.service.ts:79)
export type FamilyLinkState = 'active' | 'pending' | 'unlinked'

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

// ── Llamadas ──────────────────────────────────────────────────────────────────

export const api = {
  // /auth/login no filtra por rol: sirve para psicólogo, coordinador y familiar
  login: (email: string, password: string) =>
    post<LoginResponse>('/auth/login', undefined, { email, password }),

  logout: () => {
    const token = session.getRefreshToken()
    if (!token) return Promise.resolve()
    return post<void>('/auth/logout', undefined, { refreshToken: token }).catch(() => {
      // Si el backend no responde igual se limpia la sesión local (App.tsx)
    })
  },

  getFamilyLinkStatus: () => get<{ status: FamilyLinkState }>('/family/link-status'),

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

  // ── Portal del familiar (HU-11) ─────────────────────────────────────────────

  getFamilySessions: () => get<FamilySessionsResponse>('/family/sessions'),

  confirmAttendance: (sessionId: string, confirmed: boolean) =>
    post<SessionAttendance>(`/family/sessions/${sessionId}/attendance`, undefined, { confirmed }),

  // Vista del psicólogo: sesiones de su sede con quién confirmó (CA 11.4)
  getSedeFamilySessions: () => get<SedeFamilySession[]>('/family/sede/sessions'),
}

// ── Tipos del portal del familiar (HU-11) ─────────────────────────────────────

export interface FamilySession {
  id: string
  title: string
  sessionDate: string
  location: string
  isOnline: boolean
  sedeId: string
  createdAt: string
  // null = el familiar todavía no respondió
  userAttends: boolean | null
}

export interface FamilySessionsResponse {
  linkStatus: FamilyLinkState
  sessions: FamilySession[]
  // false cuando no hay ninguna sesión dentro de las próximas 4 semanas (CA 11.5)
  hasUpcoming: boolean
}

export interface SessionAttendance {
  id: string
  sessionId: string
  familyUserId: string
  confirmed: boolean
  confirmedAt: string
}

export interface FamilyAttendance {
  id: string
  sessionId: string
  familyUserId: string
  familyUserName: string
  confirmed: boolean
  confirmedAt: string
}

export interface SedeFamilySession {
  id: string
  title: string
  sessionDate: string
  location: string
  isOnline: boolean
  confirmedCount: number
  declinedCount: number
  attendances: FamilyAttendance[]
}
