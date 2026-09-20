import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WIcon } from './WIcon'
import { MoodChart } from './MoodChart'
import { AlertStatusBadge } from './AlertStatusBadge'
import { api } from '../services/api'
import { needsAttention } from '../utils/alertStatus'
import { useDialog } from '../hooks/useDialog'
import type { Patient } from '../data/mockData'

// El seguimiento de un paciente: cómo viene semana a semana. Vivía dentro del Resumen; ahora
// el Resumen es solo un vistazo y el detalle se abre desde «Mis pacientes».
//
// Se llamaba «ficha» hasta la HdU13, y convivía con la ficha clínica del psicólogo bajo el
// mismo nombre. Son cosas distintas: esto es lo que el paciente genera (check-ins, alertas,
// sesiones con el asistente); la ficha clínica es lo que el psicólogo escribe sobre él.
export function PatientDrawer({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [tab, setTab] = useState<'evolucion' | 'alertas' | 'sesiones' | 'datos'>('evolucion')
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const navigate = useNavigate()
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
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 40, animation: 'sb-scrim-in 0.24s ease' }}
      />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="sb-seguimiento-titulo" tabIndex={-1} style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: 480,
        maxWidth: '92vw', background: 'var(--surface)', boxShadow: 'var(--shadow-strong)',
        zIndex: 41, display: 'flex', flexDirection: 'column',
        animation: 'sb-drawer-in 0.42s cubic-bezier(0.22,0.61,0.36,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 24 }}>
              {patient.initials}
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <h2 id="sb-seguimiento-titulo" style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: 'var(--fg1)', lineHeight: 1.15 }}>{patient.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 9999, padding: '3px 11px', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{patient.days} días</span>
                <span style={{ fontSize: 12.5, color: 'var(--fg2)' }}>{patient.email}</span>
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar seguimiento" style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                color: tab === t.id ? 'var(--primary-text)' : 'var(--fg2)',
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
                  <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger-text)', fontSize: 13, textAlign: 'center', padding: '0 20px' }}>
                    No se pudo cargar la evolución. Intenta de nuevo.
                  </div>
                ) : (
                  <MoodChart data={moodPoints} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, fontSize: 12, color: 'var(--fg2)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--primary-text)', display: 'inline-block' }} /> Estado anímico
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} /> Alerta de pánico
                </span>
              </div>
              <StatRow icon="clipboard-list" label="Total check-ins (30 días)" value={metrics?.totalCheckIns ?? '-'} />
              <StatRow icon="triangle-alert" label="Alertas de pánico (30 días)" value={metrics?.panicCount ?? '-'} color={metrics && metrics.panicCount > 0 ? 'var(--danger-text)' : undefined} />
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
                  <div style={{ background: 'var(--red-50)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: 'var(--danger-text)', fontWeight: 600 }}>
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
                        style={{ flex: 1, height: 44, borderRadius: 9999, border: 'none', background: 'var(--primary)', color: 'var(--fg-on-primary)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'var(--font-heading)' }}
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
                    <WIcon name="message-circle" size={16} color="var(--primary-text)" />
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
                Estos datos de contacto todavía no se pueden editar desde el panel. El
                seguimiento clínico estructurado va en la ficha clínica.
              </p>
              <button
                type="button"
                onClick={() => { onClose(); navigate(`/pacientes/${patient.id}/ficha`) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginTop: 14,
                  background: 'var(--primary)', color: 'var(--fg-on-primary)',
                  border: 'none', borderRadius: 999, padding: '11px 20px',
                  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <WIcon name="notebook-pen" size={16} color="var(--fg-on-primary)" />
                Abrir ficha clínica
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

