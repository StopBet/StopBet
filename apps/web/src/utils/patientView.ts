import type { Patient } from '../data/mockData'
import type { PatientListItem, AlertHistoryItem } from '../services/api'
import { needsAttention } from './alertStatus'

// Cómo se convierte un paciente de la API en lo que muestran el panel y el reporte PDF.
// Vivía dentro de OverviewPage; se sacó porque «Mis pacientes» necesita lo mismo, y
// tener dos copias ya había dado dos tablas de ánimo distintas para la misma emoción.

export const EMOTION_EMOJI: Record<string, string> = {
  tired: '😴', anxious: '😰', angry: '😡', lonely: '😔', good: '😊',
}

export const EMOTION_MOOD: Record<string, number> = {
  good: 5, tired: 3, anxious: 2, lonely: 2, angry: 1,
}

export function buildEvolution(recentCheckIns: { emotion: string; date: string }[]) {
  if (!recentCheckIns.length) return []
  // recentCheckIns viene DESC (más reciente primero) → invertir
  const sorted = [...recentCheckIns].reverse()
  // Agrupar por semana (lunes de la semana)
  const weekMap = new Map<string, number[]>()
  for (const c of sorted) {
    const d = new Date(c.date)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = monday.toISOString().slice(0, 10)
    if (!weekMap.has(key)) weekMap.set(key, [])
    weekMap.get(key)!.push(EMOTION_MOOD[c.emotion] ?? 3)
  }
  return Array.from(weekMap.entries()).map(([weekStart, moods]) => {
    const avg = moods.reduce((a, b) => a + b, 0) / moods.length
    const d = new Date(weekStart)
    const label = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
    return { label, mood: Math.round(avg * 10) / 10 }
  })
}

export function relTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days} días`
}

export function shortSedeName(name: string): string {
  if (name.includes('Santiago')) return 'Santiago'
  if (name.includes('Viña')) return 'Viña del Mar'
  if (name.includes('Online')) return 'Online'
  if (name.includes('Concepción')) return 'Concepción'
  return name
}

export function toPatient(
  p: PatientListItem,
  alertsByPatient: Record<string, AlertHistoryItem[]>,
  sedeMap: Record<string, string>,
): Patient {
  const patientAlerts = alertsByPatient[p.id] ?? []
  const lastAlert = patientAlerts[0]
  const hasActiveAlert = patientAlerts.some(a => needsAttention(a.status))

  return {
    id: p.id,
    initials: `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase(),
    name: `${p.firstName} ${p.lastName}`,
    email: p.email,
    sede: shortSedeName(sedeMap[p.sedeId ?? ''] ?? p.sedeId ?? '-'),
    days: p.daysStreak,
    status: hasActiveAlert ? 'riesgo' : 'normal',
    mood: p.lastCheckIn ? (EMOTION_EMOJI[p.lastCheckIn.emotion] ?? '😊') : '-',
    lastAlert: lastAlert ? relTime(lastAlert.createdAt) : 'Nunca',
    lastAlertTone: hasActiveAlert ? 'danger' : (lastAlert ? 'muted' : 'muted'),
    panicTotal: patientAlerts.length,
    moodAvg: '-',
    lastCheck: p.lastCheckIn ? relTime(p.lastCheckIn.date) : 'Sin datos',
    evolution: buildEvolution(p.recentCheckIns),
    alerts: patientAlerts.map(a => ({
      time: new Date(a.createdAt).toLocaleString('es-CL', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      }),
      rel: relTime(a.createdAt),
      status: a.status,
    })),
    sessions: [],
  }
}


// ── Seguimiento ─────────────────────────────────────────────────────────────
// Quién conviene mirar y por qué. Lo usan «Mis pacientes» (detalle) y el Resumen
// (vistazo): vive acá para que las dos pantallas no puedan contar distinto.

// Cuántos días sin registrar el ánimo se consideran una señal de que el paciente se está
// despegando del tratamiento. No es un criterio clínico validado: es el umbral a partir del
// cual la pantalla pide mirar al paciente, no un diagnóstico. Conviene revisarlo con AJUTER.
export const DIAS_SIN_CHECKIN_ALERTA = 7

// Adherencia = en cuántos de los últimos 28 días el paciente registró su check-in.
// Se calcula sobre `recentCheckIns`, que el backend ya manda, para no pedir métricas
// paciente por paciente. **Hay que filtrar por fecha**: el backend manda los 28 check-ins
// más recientes sin mirar cuándo fueron, así que contar el largo del arreglo le daría
// 100 % a alguien con 28 check-ins repartidos en seis meses.
export const VENTANA_ADHERENCIA = 28

function inicioDeVentana(): string {
  const d = new Date()
  d.setDate(d.getDate() - (VENTANA_ADHERENCIA - 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const then = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((today.getTime() - then.getTime()) / 86_400_000))
}

export interface Flag {
  label: string
  tone: 'danger' | 'warn'
}

export interface FollowUpRow {
  p: PatientListItem
  name: string
  initials: string
  sinCheckIn: number | null
  adherencia: number
  moodReciente: number | null
  flags: Flag[]
}

export function followUp(p: PatientListItem): FollowUpRow {
  const name = `${p.firstName} ${p.lastName}`.trim()
  const sinCheckIn = daysSince(p.lastCheckIn?.date ?? null)
  const recientes = p.recentCheckIns ?? []
  const desde = inicioDeVentana()
  // Las fechas vienen como YYYY-MM-DD: comparar como texto evita líos de zona horaria.
  const enVentana = recientes.filter(c => (c.date ?? '').slice(0, 10) >= desde)
  const adherencia = Math.min(100, Math.round((enVentana.length / VENTANA_ADHERENCIA) * 100))

  const ultimos7 = recientes.slice(0, 7).map(c => EMOTION_MOOD[c.emotion] ?? 3)
  const moodReciente = ultimos7.length
    ? Math.round((ultimos7.reduce((a, b) => a + b, 0) / ultimos7.length) * 10) / 10
    : null

  // El motivo se dice explícito: la pantalla señala qué mirar, no emite un juicio clínico.
  const flags: Flag[] = []
  if (p.accountStatus === 'suspended') {
    flags.push({ label: 'Cuenta suspendida', tone: 'danger' })
  }
  if (p.onboardingStatus && p.onboardingStatus !== 'complete') {
    flags.push({ label: 'Registro sin completar', tone: 'warn' })
  }
  if (sinCheckIn === null) {
    flags.push({ label: 'Nunca hizo check-in', tone: 'warn' })
  } else if (sinCheckIn >= DIAS_SIN_CHECKIN_ALERTA) {
    flags.push({ label: `${sinCheckIn} días sin check-in`, tone: 'warn' })
  }
  if (moodReciente !== null && moodReciente <= 2) {
    flags.push({ label: 'Ánimo bajo esta semana', tone: 'warn' })
  }

  return {
    p, name, sinCheckIn, adherencia, moodReciente, flags,
    initials: `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase(),
  }
}

