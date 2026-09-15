import type { AlertHistoryItem } from '../services/api'

export type PanicStatus = AlertHistoryItem['status']

// Los cuatro estados reales del backend. `escalated` NO es una alerta resuelta: el padrino
// no respondió a tiempo (o el paciente la escaló) y sigue abierta. Antes se traducía como
// "Resuelto con IA" y `cancelled` como "Sin resolver": el psicólogo veía cerrada justo la
// crisis sin atender y perseguía las que el paciente ya había cerrado.
export const ALERT_STATUS: Record<PanicStatus, { label: string; fg: string; bg: string; icon: string; needsAttention: boolean }> = {
  pending:   { label: 'Esperando respuesta',     fg: 'var(--danger)',        bg: 'var(--red-50)',  icon: 'clock',        needsAttention: true },
  escalated: { label: 'Escalada · sin respuesta', fg: 'var(--danger)',        bg: 'var(--red-50)',  icon: 'circle-alert', needsAttention: true },
  responded: { label: 'Respondida',     fg: 'var(--primary-hover)', bg: 'var(--teal-50)', icon: 'circle-check', needsAttention: false },
  cancelled: { label: 'Cerrada',                  fg: 'var(--fg2)',           bg: 'var(--bg)',      icon: 'check',        needsAttention: false },
}

export function needsAttention(status: PanicStatus): boolean {
  return ALERT_STATUS[status].needsAttention
}

// Se compara el día local: con toISOString() el día UTC ya es mañana desde las 20–21 h de
// Chile, y "Alertas hoy" quedaba en 0 con alertas de esa misma tarde.
export function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}
