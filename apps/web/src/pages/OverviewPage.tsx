import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WIcon, DownloadIcon } from '../components/WIcon'
import { MetricCard } from '../components/MetricCard'
import { MoodChart } from '../components/MoodChart'
import { type Patient, type TodayAlert } from '../data/mockData'
import { generatePatientPDF } from '../utils/generatePatientPDF'
import { api } from '../services/api'
import type { PatientListItem, AlertHistoryItem } from '../services/api'
import { useAlertsRealtime } from '../hooks/useAlertsRealtime'
import { AlertStatusBadge } from '../components/AlertStatusBadge'
import { isToday, needsAttention } from '../utils/alertStatus'
import { useDialog } from '../hooks/useDialog'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useIsNarrow } from '../hooks/useIsNarrow'

/* ── Data helpers ────────────────────────────────────── */

const EMOTION_EMOJI: Record<string, string> = {
  tired: '😴', anxious: '😰', angry: '😡', lonely: '😔', good: '😊',
}

const EMOTION_MOOD: Record<string, number> = {
  good: 5, tired: 3, anxious: 2, lonely: 2, angry: 1,
}

function buildEvolution(recentCheckIns: { emotion: string; date: string }[]) {
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

function relTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days} días`
}

function shortSedeName(name: string): string {
  if (name.includes('Santiago')) return 'Santiago'
  if (name.includes('Viña')) return 'Viña del Mar'
  if (name.includes('Online')) return 'Online'
  if (name.includes('Concepción')) return 'Concepción'
  return name
}

function toPatient(
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

/* ── Helpers ─────────────────────────────────────────── */
function StatusBadge({ status }: { status: 'normal' | 'riesgo' }) {
  const map = {
    normal: { bg: 'var(--sage-50)', fg: 'var(--secondary-text)', label: 'Normal' },
    riesgo: { bg: 'var(--red-50)',  fg: 'var(--danger)',   label: 'En riesgo' },
  }
  const s = map[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', background: s.bg, color: s.fg, borderRadius: 9999, padding: '5px 12px', fontSize: 12, fontWeight: 700 }}>
      {s.label}
    </span>
  )
}

function ProgressBar({ value, max = 90, color = 'var(--primary)' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ height: 6, width: 64, background: 'var(--border)', borderRadius: 9999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999 }} />
    </div>
  )
}

/* ── Patient Drawer ──────────────────────────────────── */
function PatientDrawer({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [tab, setTab] = useState<'evolucion' | 'alertas' | 'sesiones' | 'datos'>('evolucion')
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const [relapseStep, setRelapseStep] = useState<'idle' | 'confirm' | 'done' | 'error'>('idle')
  const queryClient = useQueryClient()

  const { data: metrics, isLoading: loadingMetrics, isError: metricsError } = useQuery({
    queryKey: ['patient-metrics', patient.id],
    queryFn: () => api.getPatientMetrics(patient.id),
  })

  const moodPoints = (metrics?.evolution ?? []).map(e => ({
    label: new Date(e.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }),
    mood: e.mood,
  }))

  const relapseMutation = useMutation({
    mutationFn: () => api.reportRelapse(patient.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      setRelapseStep('done')
      setTimeout(() => setRelapseStep('idle'), 4000)
    },
    onError: () => setRelapseStep('error'),
  })
  const tabs = [
    { id: 'evolucion' as const, label: 'Evolución' },
    { id: 'alertas' as const,   label: 'Alertas' },
    { id: 'sesiones' as const,  label: 'Sesiones IA' },
    { id: 'datos' as const,     label: 'Datos' },
  ]

  const StatRow = ({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <WIcon name={icon} size={17} />
      </div>
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--fg2)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: color ?? 'var(--fg1)' }}>{value}</span>
    </div>
  )

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(45,90,158,0.32)', zIndex: 40, animation: 'sb-scrim-in 0.24s ease' }}
      />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="sb-ficha-titulo" tabIndex={-1} style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: 480,
        maxWidth: '92vw', background: 'var(--surface)', boxShadow: 'var(--shadow-strong)',
        zIndex: 41, display: 'flex', flexDirection: 'column',
        animation: 'sb-drawer-in 0.42s cubic-bezier(0.22,0.61,0.36,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 24 }}>
              {patient.initials}
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <h2 id="sb-ficha-titulo" style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: 'var(--fg1)', lineHeight: 1.15 }}>{patient.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 9999, padding: '3px 11px', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{patient.days} días</span>
                <span style={{ fontSize: 12.5, color: 'var(--fg2)' }}>{patient.email}</span>
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar ficha" style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WIcon name="x" size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div role="tablist" style={{ display: 'flex', gap: 4, marginTop: 20, borderBottom: '1px solid var(--border)' }}>
            {tabs.map(t => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{
                background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer',
                fontSize: 13.5, fontWeight: tab === t.id ? 700 : 500,
                fontFamily: 'var(--font-body)',
                color: tab === t.id ? 'var(--primary)' : 'var(--fg2)',
                borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -1,
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {tab === 'evolucion' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 10 }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--fg1)' }}>Estado emocional</h3>
                <span style={{ fontSize: 12, color: 'var(--fg2)' }}>Últimos 30 días</span>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 12px 6px', marginBottom: 12 }}>
                {loadingMetrics ? (
                  <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg2)', fontSize: 13 }}>
                    Cargando evolución…
                  </div>
                ) : metricsError ? (
                  <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', fontSize: 13, textAlign: 'center', padding: '0 20px' }}>
                    No se pudo cargar la evolución. Intenta de nuevo.
                  </div>
                ) : (
                  <MoodChart data={moodPoints} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, fontSize: 12, color: 'var(--fg2)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--primary)', display: 'inline-block' }} /> Estado anímico
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} /> Alerta de pánico
                </span>
              </div>
              <StatRow icon="clipboard-list" label="Total check-ins (30 días)" value={metrics?.totalCheckIns ?? '-'} />
              <StatRow icon="triangle-alert" label="Alertas de pánico (30 días)" value={metrics?.panicCount ?? '-'} color={metrics && metrics.panicCount > 0 ? 'var(--danger)' : undefined} />
              <StatRow icon="activity" label="Promedio de estado" value={metrics?.moodAvg != null ? `${metrics.moodAvg}/5` : 'Sin datos'} />
              <StatRow icon="clock" label="Último check emocional" value={patient.lastCheck} />
              <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {relapseStep === 'confirm' && (
                  <div style={{ background: 'var(--surface-alt)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: 'var(--fg1)', fontWeight: 600, lineHeight: 1.5 }}>
                    ¿Confirmar recaída? Esta acción reiniciará el contador de abstinencia del paciente.
                  </div>
                )}
                {relapseStep === 'done' && (
                  <div style={{ background: 'var(--sage-50)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: 'var(--secondary-text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <WIcon name="circle-check" size={15} /> Recaída registrada. El contador fue reiniciado.
                  </div>
                )}
                {relapseStep === 'error' && (
                  <div style={{ background: 'var(--red-50)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
                    Error al registrar. Intenta de nuevo.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                  {relapseStep === 'confirm' ? (
                    <>
                      <button
                        onClick={() => setRelapseStep('idle')}
                        style={{ flex: 1, height: 44, borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'var(--font-heading)' }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => { setRelapseStep('idle'); relapseMutation.mutate() }}
                        style={{ flex: 1, height: 44, borderRadius: 9999, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'var(--font-heading)' }}
                      >
                        Confirmar recaída
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setRelapseStep('confirm')}
                      disabled={relapseMutation.isPending || relapseStep === 'done'}
                      style={{ flex: 1, height: 44, borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg1)', fontWeight: 700, fontSize: 13.5, cursor: relapseMutation.isPending || relapseStep === 'done' ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-heading)', opacity: relapseMutation.isPending ? 0.6 : 1 }}
                    >
                      {relapseMutation.isPending ? 'Registrando…' : 'Registrar recaída'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'alertas' && (
            patient.alerts.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--fg2)', fontSize: 13 }}>Sin alertas registradas</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {patient.alerts.map((a, i) => (
                  <div key={i} style={{ background: needsAttention(a.status) ? 'var(--red-50)' : 'var(--bg)', borderRadius: 12, padding: '13px 15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5, color: 'var(--fg1)' }}>{a.time}</span>
                      <span style={{ fontSize: 12, color: 'var(--fg2)' }}>{a.rel}</span>
                    </div>
                    <div style={{ marginTop: 9 }}><AlertStatusBadge status={a.status} /></div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'sesiones' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Antes decía "aún no ha usado el asistente" siempre, aunque sí lo hubiera usado:
                  el panel todavía no recibe esas sesiones, y eso es lo único cierto que se puede decir. */}
              {(patient.sessions.length ? patient.sessions : [{ date: 'Todavía no disponible', summary: 'El panel aún no muestra las sesiones de este paciente con el asistente. Que esté vacío no significa que no lo haya usado.' }]).map((s, i) => (
                <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <WIcon name="message-circle" size={16} color="var(--primary)" />
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5, color: 'var(--fg1)' }}>{s.date}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>{s.summary}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'datos' && (
            // Antes eran campos editables con un "Guardar cambios" que no llamaba a nada: el
            // psicólogo creía haber corregido un correo y no quedaba guardado.
            <div>
              <dl style={{ margin: 0 }}>
                {[['Nombre completo', patient.name], ['Correo', patient.email], ['Sede', patient.sede]].map(([l, v]) => (
                  <div key={l} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <dt style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', marginBottom: 4 }}>{l}</dt>
                    <dd style={{ margin: 0, fontSize: 14, color: 'var(--fg1)' }}>{v}</dd>
                  </div>
                ))}
              </dl>
              <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>
                Estos datos todavía no se pueden editar desde el panel.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ── Patient Table ───────────────────────────────────── */
function PatientTable({ patients, onOpen }: { patients: Patient[]; onOpen: (p: Patient) => void }) {
  const isNarrow = useIsNarrow()
  const [q, setQ] = useState('')
  const [sedeFilter, setSedeFilter] = useState('Todas')

  const sedeOptions = ['Todas', ...Array.from(new Set(patients.map(p => p.sede).filter(Boolean)))]

  const rows = patients.filter(p => {
    const matchName = p.name.toLowerCase().includes(q.toLowerCase())
    const matchSede = sedeFilter === 'Todas' || p.sede === sedeFilter
    return matchName && matchSede
  })

  const Head = ({ label }: { label: string }) => (
    <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 12px 12px', whiteSpace: 'nowrap' }}>{label}</th>
  )

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Mis pacientes</h2>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select value={sedeFilter} onChange={e => setSedeFilter(e.target.value)} aria-label="Filtrar pacientes por sede"
              style={{ appearance: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '6px 30px 6px 10px', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--primary)', cursor: 'pointer', fontFamily: 'var(--font-body)', outline: 'none' }}>
              {sedeOptions.map(s => <option key={s} value={s}>{s === 'Todas' ? 'Todas las sedes' : `Sede: ${s}`}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--primary)' }}>
              <WIcon name="chevron-down" size={13} />
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 14px' }}>
          <WIcon name="search" size={16} color="var(--fg2)" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre…" aria-label="Buscar paciente por nombre"
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, width: '100%', color: 'var(--fg1)' }} />
        </label>
      </div>

      {/* Seis columnas no entran en un teléfono, y forzarlas con scroll horizontal
          esconde justo lo que importa (días y última alerta). Cada paciente pasa a
          ser una tarjeta con los mismos datos apilados. */}
      {isNarrow ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map(p => {
            const danger = p.lastAlertTone === 'danger'
            return (
              <button
                key={p.id}
                onClick={() => onOpen(p)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 10, width: '100%',
                  textAlign: 'left', border: 'none', borderTop: '1px solid var(--border)',
                  background: danger ? 'var(--red-50)' : 'transparent',
                  padding: '14px 20px', cursor: 'pointer', font: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{p.initials}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, color: 'var(--fg1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--primary)', minWidth: 34 }}>{p.days}</span>
                  <ProgressBar value={p.days} max={120} color={danger ? 'var(--accent)' : 'var(--primary)'} />
                  <span style={{ fontSize: 12, color: 'var(--fg2)', whiteSpace: 'nowrap' }}>días</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-block', background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{p.sede}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: danger ? 600 : 400, color: danger ? 'var(--danger)' : 'var(--fg2)' }}>
                    {danger && <WIcon name="circle-alert" size={13} color="var(--danger)" />}
                    {p.lastAlert}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col /><col style={{ width: 92 }} /><col style={{ width: 138 }} />
          <col style={{ width: 104 }} /><col style={{ width: 110 }} /><col style={{ width: 110 }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <Head label="Paciente" /><Head label="Sede" /><Head label="Días abstinencia" />
            <Head label="Estado" /><Head label="Última alerta" /><Head label="" />
          </tr>
        </thead>
        <tbody>
          {rows.map(p => {
            const danger = p.lastAlertTone === 'danger'
            return (
              <tr key={p.id} onClick={() => onOpen(p)}
                style={{ borderBottom: '1px solid var(--border)', background: danger ? 'var(--red-50)' : 'transparent', cursor: 'pointer', transition: 'background 0.14s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--teal-50)')}
                onMouseLeave={e => (e.currentTarget.style.background = danger ? 'var(--red-50)' : 'transparent')}
              >
                <td style={{ padding: '14px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{p.initials}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--fg1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 12px' }}>
                  <span style={{ display: 'inline-block', background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{p.sede}</span>
                </td>
                <td style={{ padding: '14px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--primary)', minWidth: 30 }}>{p.days}</span>
                    <ProgressBar value={p.days} max={120} color={danger ? 'var(--accent)' : 'var(--primary)'} />
                  </div>
                </td>
                <td style={{ padding: '14px 12px' }}><StatusBadge status={p.status} /></td>
                <td style={{ padding: '14px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: danger ? 600 : 400, color: danger ? 'var(--danger)' : 'var(--fg2)' }}>
                    {danger && <WIcon name="circle-alert" size={14} color="var(--danger)" />}
                    {p.lastAlert}
                  </span>
                </td>
                <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                  {/* La fila se abre con clic, pero sin un botón real no había forma de llegar
                      con el teclado. El "···" de al lado no hacía nada y se quitó. */}
                  <button
                    onClick={e => { e.stopPropagation(); onOpen(p) }}
                    aria-label={`Ver ficha de ${p.name}`}
                    style={{ background: 'none', border: 'none', padding: '6px 4px', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}
                  >
                    Ver ficha
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      )}

      {/* Había una paginación con flechas que no hacían nada: la lista siempre se muestra completa */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, color: 'var(--fg2)' }}>
          {rows.length === patients.length ? `${patients.length} pacientes` : `${rows.length} de ${patients.length} pacientes`}
        </span>
      </div>
    </div>
  )
}

/* ── Panic Panel ─────────────────────────────────────── */
function PanicPanel({ todayAlerts, onOpenPatient, onViewAll }: { todayAlerts: TodayAlert[]; onOpenPatient: (name: string) => void; onViewAll: () => void }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', borderTop: '3px solid var(--danger)', boxShadow: 'var(--shadow-soft)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <WIcon name="triangle-alert" size={19} color="var(--danger)" />
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--danger)' }}>Alertas de pánico</h2>
        </div>
        <span style={{ background: 'var(--red-50)', color: 'var(--danger)', borderRadius: 9999, padding: '3px 11px', fontSize: 12, fontWeight: 700 }}>{todayAlerts.length} hoy</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {todayAlerts.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--fg2)', fontSize: 13 }}>Sin alertas hoy</div>
        ) : todayAlerts.slice(0, 3).map((a, i) => (
          <div key={i} style={{ background: needsAttention(a.status) ? 'var(--red-50)' : 'var(--bg)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--fg1)' }}>{a.name}</div>
            <div style={{ fontSize: 12, color: 'var(--fg2)', marginTop: 2 }}>{a.rel} · {a.time}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
              <AlertStatusBadge status={a.status} />
              <button onClick={() => onOpenPatient(a.name)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Ver ficha <WIcon name="arrow-right" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onViewAll} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
        Ver historial completo <WIcon name="arrow-right" size={14} />
      </button>
    </div>
  )
}

/* ── Export Panel ────────────────────────────────────── */
function ExportPanel({ patients }: { patients: Patient[] }) {
  const [patientId, setPatientId] = useState('')
  // Proponía mayo de 2026 fijo: ahora abre con los últimos 30 días, en fecha local.
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 30 * 86_400_000)))
  const [to, setTo] = useState(() => ymd(new Date()))
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)

  const inputStyle: React.CSSProperties = { height: 40, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', padding: '0 12px', fontSize: 13, color: 'var(--fg1)', width: '100%', boxSizing: 'border-box', outline: 'none' }

  const canExport = patientId !== '' && from !== '' && to !== ''

  function handleExport() {
    const patient = patients.find(p => p.id === patientId)
    if (!patient) return

    setLoading(true)
    setToast(null)

    setTimeout(() => {
      try {
        generatePatientPDF(patient, from, to)
        setToast({ ok: true, msg: `Reporte de ${patient.name} descargado` })
      } catch {
        setToast({ ok: false, msg: 'Error al generar el PDF. Intenta nuevamente.' })
      } finally {
        setLoading(false)
        setTimeout(() => setToast(null), 3500)
      }
    }, 50)
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', padding: 20, position: 'relative' }}>
      <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Generar reporte PDF</h2>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--fg2)' }}>Exporta la evolución y alertas de un paciente.</p>

      <label htmlFor="sb-reporte-paciente" style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 6 }}>Paciente</label>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <select
          id="sb-reporte-paciente"
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', borderColor: !patientId ? 'var(--border)' : 'var(--primary)' }}
        >
          <option value="">Seleccionar paciente…</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span style={{ position: 'absolute', right: 12, top: 12, pointerEvents: 'none', color: 'var(--fg2)' }}><WIcon name="chevron-down" size={16} /></span>
      </div>

      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 6 }}>Rango de fechas</label>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        {[{ label: 'Desde', val: from, set: setFrom }, { label: 'Hasta', val: to, set: setTo }].map(({ label, val, set }) => (
          <div key={label} style={{ flex: 1 }}>
            <label htmlFor={`sb-reporte-${label}`} style={{ display: 'block', fontSize: 12, color: 'var(--fg2)', marginBottom: 4 }}>{label}</label>
            <input id={`sb-reporte-${label}`} type="date" value={val} onChange={e => set(e.target.value)} style={inputStyle} />
          </div>
        ))}
      </div>

      <button
        onClick={handleExport}
        disabled={!canExport || loading}
        style={{
          width: '100%', height: 46, borderRadius: 9999, border: 'none',
          background: canExport ? 'var(--primary)' : 'var(--border)',
          color: canExport ? '#fff' : 'var(--fg2)',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15,
          cursor: canExport && !loading ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          transition: 'background 0.2s',
        }}
      >
        {loading
          ? <><WIcon name="loader" size={18} color="currentColor" style={{ animation: 'sb-spin 0.8s linear infinite' }} /> Generando…</>
          : <><DownloadIcon size={18} color={canExport ? '#fff' : 'var(--fg2)'} /> Exportar PDF</>
        }
      </button>
      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--fg2)', textAlign: 'center' }}>
        {canExport ? 'El reporte se generará en menos de 10 segundos.' : 'Selecciona un paciente y rango de fechas para continuar.'}
      </p>

      {toast && (
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 20, background: toast.ok ? 'var(--primary-hover)' : 'var(--danger)', color: '#fff', borderRadius: 12, padding: '12px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 9, boxShadow: 'var(--shadow-strong)', zIndex: 10 }}>
          <WIcon name={toast.ok ? 'circle-check' : 'circle-alert'} size={17} color="#fff" />
          {toast.msg}
        </div>
      )}
    </div>
  )
}

/* ── Overview Page ───────────────────────────────────── */
interface OverviewPageProps {
  onNav: (id: string) => void
  reqCount: number
}

export function OverviewPage({ onNav, reqCount }: OverviewPageProps) {
  const [selected, setSelected] = useState<Patient | null>(null)
  const isNarrow = useIsNarrow()
  const isCompact = useMediaQuery('(max-width: 1399px)')
  const stacked = isNarrow || isCompact

  useAlertsRealtime()

  const { data: patientList = [], isLoading: loadingPatients } = useQuery({
    queryKey: ['patients'],
    queryFn: api.getPatients,
    refetchInterval: 15_000,
    staleTime: 0,
  })

  const { data: alertHistory = [] } = useQuery({
    queryKey: ['alerts', 'history'],
    queryFn: api.getAlertHistory,
    // Red de seguridad si el SSE no está disponible (4.1: alerta nueva sin recargar)
    refetchInterval: 30_000,
  })

  const { data: sedes = [] } = useQuery({
    queryKey: ['sedes'],
    queryFn: api.getSedes,
  })

  const sedeMap = Object.fromEntries(sedes.map(s => [s.id, s.name]))

  const alertsByPatient: Record<string, AlertHistoryItem[]> = {}
  for (const a of alertHistory) {
    if (!alertsByPatient[a.patientId]) alertsByPatient[a.patientId] = []
    alertsByPatient[a.patientId].push(a)
  }

  const patients: Patient[] = patientList.map(p => toPatient(p, alertsByPatient, sedeMap))

  const todayAlerts: TodayAlert[] = alertHistory
    .filter(a => isToday(a.createdAt))
    .map(a => ({
      name: a.patientName,
      rel: relTime(a.createdAt),
      time: new Date(a.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      status: a.status,
    }))

  const avgDays = patients.length
    ? Math.round(patients.reduce((s, p) => s + p.days, 0) / patients.length)
    : 0

  const openByName = (name: string) => {
    const p = patients.find(x => x.name === name)
    if (p) setSelected(p)
  }

  if (loadingPatients) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <span style={{ color: 'var(--fg2)', fontSize: 14 }}>Cargando pacientes…</span>
      </div>
    )
  }

  return (
    // Sin ancho mínimo: con `minWidth: 1180`, un notebook de 1280–1366 px tenía que
    // desplazar la página de lado. El reparto de columnas lo decide la cuadrícula de abajo.
    <div style={{
      padding: isNarrow ? '16px 12px 28px' : 32,
      maxWidth: 1440,
      margin: '0 auto', width: '100%', boxSizing: 'border-box',
    }}>
      {/* Las cuatro métricas en fila no caben; en dos columnas siguen siendo legibles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))',
        gap: isNarrow ? 10 : 16,
        marginBottom: isNarrow ? 16 : 24,
      }}>
        <MetricCard icon="users" label="Pacientes activos" value={patients.length} tone="teal" important
          sub="en tu sede" />
        <MetricCard icon="inbox" label="Solicitudes pendientes" value={reqCount} tone="amber" important
          onClick={() => onNav('requests')}
          sub={<><WIcon name="clock" size={14} color="var(--primary)" /><span style={{ color: 'var(--primary)', fontWeight: 600 }}>{reqCount} esperando aprobación</span></>} />
        <MetricCard icon="triangle-alert" label="Alertas hoy" value={todayAlerts.length}
          tone={todayAlerts.some(a => needsAttention(a.status)) ? 'red' : 'teal'} important={todayAlerts.some(a => needsAttention(a.status))}
          sub="Botones de pánico activados" />
        <MetricCard icon="trophy" label="Promedio abstinencia" value={avgDays} tone="gold" important
          sub="días promedio por paciente · acumulado 2026" />
      </div>

      {/* En pantalla ancha, la tabla va a la izquierda y las alertas y el reporte a la
          derecha. Por debajo de 1400 px la tabla necesita todo el ancho (la columna del
          paciente quedaba en ~70 px), así que todo va en una columna, con las alertas de
          pánico primero: son lo que no puede quedar abajo del scroll. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: stacked ? '1fr' : 'minmax(0,1.85fr) minmax(0,1fr)',
        gridTemplateRows: stacked ? undefined : 'auto 1fr',
        gridTemplateAreas: stacked ? '"panic" "table" "export"' : '"table panic" "table export"',
        gap: isNarrow ? 12 : 16,
        alignItems: 'start',
      }}>
        <div style={{ gridArea: 'table', minWidth: 0 }}>
          <PatientTable patients={patients} onOpen={setSelected} />
        </div>
        <div style={{ gridArea: 'panic', minWidth: 0 }}>
          <PanicPanel todayAlerts={todayAlerts} onOpenPatient={openByName} onViewAll={() => onNav('alerts')} />
        </div>
        <div style={{ gridArea: 'export', minWidth: 0 }}>
          <ExportPanel patients={patients} />
        </div>
      </div>

      {selected && <PatientDrawer patient={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
