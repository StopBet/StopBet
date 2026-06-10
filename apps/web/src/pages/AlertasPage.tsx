import { useState } from 'react'
import { WIcon } from '../components/WIcon'
import { MetricCard } from '../components/MetricCard'
import { ALERT_DATA, type AlertData } from '../data/mockData'

type FilterChip = 'todas' | 'sin-resolver' | 'resuelto-ia' | 'resuelto-manual'

function AlertStatusBadge({ status }: { status: AlertData['status'] }) {
  const map: Record<AlertData['status'], { bg: string; fg: string; label: string; icon: string }> = {
    'resuelto-ia':      { bg: 'var(--teal-50)',  fg: 'var(--primary)',   label: 'Resuelto con IA',    icon: 'sparkles'      },
    'resuelto-manual':  { bg: 'var(--sage-50)',  fg: 'var(--sage-500)', label: 'Resuelto manualmente', icon: 'circle-check'  },
    'sin-resolver':     { bg: 'var(--red-50)',   fg: 'var(--danger)',   label: 'Sin resolver',          icon: 'circle-alert'  },
  }
  const s = map[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: s.bg, color: s.fg, borderRadius: 9999, padding: '5px 12px', fontSize: 12, fontWeight: 700 }}>
      <WIcon name={s.icon} size={13} />
      {s.label}
    </span>
  )
}

const FILTER_LABELS: Record<FilterChip, string> = {
  todas: 'Todas',
  'sin-resolver': 'Sin resolver',
  'resuelto-ia': 'Resuelto con IA',
  'resuelto-manual': 'Resuelto manualmente',
}

export function AlertasPage() {
  const [filter, setFilter] = useState<FilterChip>('todas')

  const rows = filter === 'todas' ? ALERT_DATA : ALERT_DATA.filter(a => a.status === filter)
  const unresolved = ALERT_DATA.filter(a => a.status === 'sin-resolver')
  const resolvedIA = ALERT_DATA.filter(a => a.status === 'resuelto-ia')

  const Head = ({ label }: { label: string }) => (
    <th style={{ textAlign: 'left', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 14px 12px' }}>{label}</th>
  )

  return (
    <div style={{ padding: 32, maxWidth: 1440, minWidth: 1100, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <MetricCard icon="triangle-alert" label="Total alertas hoy" value={ALERT_DATA.length} tone="red" important
          sub="botones de pánico activados hoy" />
        <MetricCard icon="circle-alert" label="Sin resolver" value={unresolved.length} tone="amber" important
          sub="requieren atención manual" />
        <MetricCard icon="sparkles" label="Resueltos con IA" value={resolvedIA.length} tone="teal" important
          sub="contención automática exitosa" />
        <MetricCard icon="activity" label="Tiempo prom. respuesta" value="8m" tone="gold" important
          sub="desde activación hasta contención" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        {/* Alerts table */}
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Historial de alertas</h2>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px solid var(--border)', color: 'var(--fg2)', borderRadius: 9999, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
                <WIcon name="download" size={15} /> Exportar
              </button>
            </div>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {(Object.keys(FILTER_LABELS) as FilterChip[]).map(f => {
                const active = filter === f
                return (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    background: active ? 'var(--primary)' : 'var(--bg)', color: active ? '#fff' : 'var(--fg2)',
                    border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 9999, padding: '6px 14px', fontSize: 12.5, fontWeight: active ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}>
                    {FILTER_LABELS[f]}
                  </button>
                )
              })}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col /><col style={{ width: 100 }} /><col style={{ width: 160 }} />
              <col style={{ width: 140 }} /><col style={{ width: 190 }} /><col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <Head label="Paciente" /><Head label="Sede" /><Head label="Fecha" />
                <Head label="Tipo" /><Head label="Estado" /><Head label="" />
              </tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--teal-50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: a.status === 'sin-resolver' ? 'var(--red-50)' : 'var(--teal-50)', color: a.status === 'sin-resolver' ? 'var(--danger)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{a.initials}</div>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--fg1)' }}>{a.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 14px' }}>
                    <span style={{ background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{a.sede}</span>
                  </td>
                  <td style={{ padding: '14px 14px', fontSize: 13, color: 'var(--fg2)', whiteSpace: 'nowrap' }}>{a.fecha}</td>
                  <td style={{ padding: '14px 14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--red-50)', color: 'var(--danger)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                      <WIcon name="triangle-alert" size={13} /> {a.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '14px 14px' }}><AlertStatusBadge status={a.status} /></td>
                  <td style={{ padding: '14px 14px' }}>
                    <button style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Ver →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--fg2)' }}>
            Mostrando {rows.length} de {ALERT_DATA.length} alertas
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Unresolved panel */}
          {unresolved.length > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--danger)', boxShadow: 'var(--shadow-soft)', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, animation: 'sb-pulse 1.8s ease-in-out infinite' }} />
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--danger)' }}>Requieren atención</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {unresolved.map(a => (
                  <div key={a.id} style={{ background: 'var(--red-50)', borderRadius: 12, padding: '13px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: '#fff', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{a.initials}</div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5, color: 'var(--fg1)' }}>{a.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg2)' }}>{a.fecha}</div>
                      </div>
                    </div>
                    <button style={{ background: 'var(--danger)', border: 'none', color: '#fff', borderRadius: 9999, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Atender
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Protocol panel */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', padding: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Protocolo de contención</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { n: 1, title: 'Asistente IA activado', desc: 'Respuesta inmediata con técnicas de respiración y contención.', color: 'var(--primary)', done: true },
                { n: 2, title: 'Notificación al padrino', desc: 'El padrino asignado recibe una alerta en tiempo real.', color: 'var(--accent)', done: true },
                { n: 3, title: 'Alerta al psicólogo', desc: 'Se envía notificación push al profesional a cargo.', color: 'var(--sage-500)', done: false },
                { n: 4, title: 'Llamada de emergencia', desc: 'Si no hay respuesta en 30 minutos, se llama al contacto de emergencia.', color: 'var(--danger)', done: false },
              ].map((step, i) => (
                <div key={step.n} style={{ display: 'flex', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: step.done ? step.color : 'var(--border)', color: step.done ? '#fff' : 'var(--fg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{step.n}</div>
                    {i < 3 && <div style={{ width: 2, flex: 1, minHeight: 18, background: 'var(--border)' }} />}
                  </div>
                  <div style={{ paddingBottom: i < 3 ? 18 : 0, paddingTop: 5 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5, color: step.done ? 'var(--fg1)' : 'var(--fg2)' }}>{step.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg2)', marginTop: 3, lineHeight: 1.5 }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
