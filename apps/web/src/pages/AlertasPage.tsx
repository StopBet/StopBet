import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import { useAlertsRealtime } from '../hooks/useAlertsRealtime'
import { MetricCard } from '../components/MetricCard'
import { api } from '../services/api'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { AlertStatusBadge } from '../components/AlertStatusBadge'
import { needsAttention, type PanicStatus } from '../utils/alertStatus'

type FilterChip = 'todas' | 'atencion' | 'responded' | 'cancelled'

interface AlertRow {
  id: string
  initials: string
  name: string
  sede: string
  fecha: string
  status: PanicStatus
}

function shortSedeName(name: string): string {
  if (name.includes('Santiago')) return 'Santiago'
  if (name.includes('Viña')) return 'Viña del Mar'
  if (name.includes('Online')) return 'Online'
  if (name.includes('Concepción')) return 'Concepción'
  return name
}

const FILTER_LABELS: Record<FilterChip, string> = {
  todas: 'Todas',
  atencion: 'Requieren atención',
  responded: 'Respondida',
  cancelled: 'Cerradas',
}

// Lo que el backend hace de verdad (panic.service.ts). La versión anterior marcaba pasos como
// "hechos" siempre y prometía un push al psicólogo y una llamada de emergencia a los 30
// minutos que el sistema no hace.
const PROTOCOL = [
  { title: 'Aviso al compañero de viaje', desc: 'Su compañero de viaje asignado recibe una notificación en el teléfono. Si el paciente no tiene uno, la alerta se escala de inmediato.' },
  { title: 'Espera de 2 minutos', desc: 'Si el compañero de viaje no responde, la alerta pasa a «Escalada · sin respuesta» y aparece en «Requieren atención».' },
  { title: 'Apoyo en la app', desc: 'Mientras tanto, el paciente tiene a mano el asistente y la línea *4141.' },
  { title: 'Seguimiento del equipo', desc: 'El panel no envía avisos al psicólogo: revisa esta lista para contactar a los pacientes con alertas escaladas.' },
]

export function AlertasPage() {
  const isNarrow = useIsNarrow()
  const [filter, setFilter] = useState<FilterChip>('todas')
  const [histPage, setHistPage] = useState(0)
  const [attnPage, setAttnPage] = useState(0)

  const HIST_PAGE_SIZE = 8
  const ATTN_PAGE_SIZE = 5

  useAlertsRealtime()

  const { data: alertHistory = [], isLoading } = useQuery({
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

  const allRows: AlertRow[] = alertHistory.map(a => ({
    id: a.id,
    initials: a.patientName.split(' ').map(n => n[0] ?? '').slice(0, 2).join('').toUpperCase(),
    name: a.patientName,
    sede: shortSedeName(sedeMap[a.sedeId ?? ''] ?? a.sedeId ?? '-'),
    fecha: new Date(a.createdAt).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
    status: a.status,
  }))

  const rows = allRows.filter(a =>
    filter === 'todas' ? true : filter === 'atencion' ? needsAttention(a.status) : a.status === filter,
  )
  const unresolved = allRows.filter(a => needsAttention(a.status))
  const respondedCount = allRows.filter(a => a.status === 'responded').length
  const closedCount = allRows.filter(a => a.status === 'cancelled').length

  const histTotalPages = Math.max(1, Math.ceil(rows.length / HIST_PAGE_SIZE))
  const pagedRows = rows.slice(histPage * HIST_PAGE_SIZE, (histPage + 1) * HIST_PAGE_SIZE)

  const attnTotalPages = Math.max(1, Math.ceil(unresolved.length / ATTN_PAGE_SIZE))
  const pagedUnresolved = unresolved.slice(attnPage * ATTN_PAGE_SIZE, (attnPage + 1) * ATTN_PAGE_SIZE)

  const Head = ({ label }: { label: string }) => (
    <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 14px 12px' }}>{label}</th>
  )

  return (
    <div style={{ padding: isNarrow ? '16px 12px 28px' : 32, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: isNarrow ? 10 : 16, marginBottom: isNarrow ? 16 : 24 }}>
        {/* Antes había un "Tiempo prom. respuesta: 8m" escrito a mano: se reemplaza por
            conteos que salen del historial real. */}
        <MetricCard icon="triangle-alert" label="Total alertas" value={allRows.length} tone="teal"
          sub="historial completo de botones de pánico" />
        <MetricCard icon="circle-alert" label="Requieren atención" value={unresolved.length} tone="red" important
          sub="esperando respuesta o escaladas" />
        <MetricCard icon="circle-check" label="Respondidas" value={respondedCount} tone="teal"
          sub="el compañero de viaje contestó" />
        <MetricCard icon="check" label="Cerradas" value={closedCount} tone="teal"
          sub="por el paciente o reemplazadas por una nueva" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : 'minmax(0,2.2fr) minmax(0,1fr)', gap: isNarrow ? 12 : 16, alignItems: 'start' }}>
        {/* Alerts table */}
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Historial de alertas</h2>
            </div>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {(Object.keys(FILTER_LABELS) as FilterChip[]).map(f => {
                const active = filter === f
                return (
                  <button key={f} aria-pressed={active} onClick={() => { setFilter(f); setHistPage(0) }} style={{
                    background: active ? 'var(--primary)' : 'var(--bg)', color: active ? 'var(--fg-on-primary)' : 'var(--fg2)',
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

          {isLoading ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--fg2)', fontSize: 13 }}>Cargando alertas…</div>
          ) : (
            isNarrow ? (
              /* Con seis columnas fijas el encabezado se encimaba ("PACIENTE" sobre
                 "SEDE") y el nombre del paciente quedaba cortado. Una tarjeta por
                 alerta mantiene los mismos datos y respeta el ancho del teléfono. */
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {pagedRows.map(a => {
                  const unresolved = needsAttention(a.status)
                  return (
                    <div key={a.id} style={{
                      display: 'flex', flexDirection: 'column', gap: 10,
                      padding: '14px 20px', borderTop: '1px solid var(--border)',
                      background: unresolved ? 'var(--red-50)' : 'transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: unresolved ? 'var(--surface)' : 'var(--teal-50)', color: unresolved ? 'var(--danger-text)' : 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{a.initials}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, color: 'var(--fg1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{a.fecha}</div>
                        </div>
                        <AlertStatusBadge status={a.status} />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{a.sede}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                {/* Sin las columnas "Tipo" (siempre decía "Botón de pánico") ni "Ver" (no
                    hacía nada), la fecha y el estado tienen el ancho que necesitan: antes la
                    hora quedaba cortada. */}
                <col /><col style={{ width: 92 }} /><col style={{ width: 180 }} /><col style={{ width: 210 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <Head label="Paciente" /><Head label="Sede" /><Head label="Fecha" /><Head label="Estado" />
                </tr>
              </thead>
              <tbody>
                {pagedRows.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: needsAttention(a.status) ? 'var(--red-50)' : 'var(--teal-50)', color: needsAttention(a.status) ? 'var(--danger-text)' : 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{a.initials}</div>
                        {/* Sin esto el nombre se desbordaba de la celda (tableLayout
                            fijo no recorta solo) y la etiqueta de sede de la columna
                            siguiente le quedaba encima. */}
                        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--fg1)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.name}>{a.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      <span style={{ background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{a.sede}</span>
                    </td>
                    <td style={{ padding: '14px 14px', fontSize: 13, color: 'var(--fg2)', whiteSpace: 'nowrap' }}>{a.fecha}</td>
                    <td style={{ padding: '14px 14px' }}><AlertStatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            )
          )}

          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--fg2)' }}>
              Mostrando {histPage * HIST_PAGE_SIZE + 1}-{Math.min((histPage + 1) * HIST_PAGE_SIZE, rows.length)} de {rows.length} alertas
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setHistPage(p => p - 1)}
                aria-label="Página anterior"
                disabled={histPage === 0}
                style={{ width: 32, height: 32, borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--surface)', color: histPage === 0 ? 'var(--border)' : 'var(--fg1)', cursor: histPage === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <WIcon name="chevron-left" size={16} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--fg2)', minWidth: 60, textAlign: 'center' }}>
                {histPage + 1} / {histTotalPages}
              </span>
              <button
                onClick={() => setHistPage(p => p + 1)}
                aria-label="Página siguiente"
                disabled={histPage >= histTotalPages - 1}
                style={{ width: 32, height: 32, borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--surface)', color: histPage >= histTotalPages - 1 ? 'var(--border)' : 'var(--fg1)', cursor: histPage >= histTotalPages - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <WIcon name="chevron-right" size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Unresolved panel */}
          {unresolved.length > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--danger)', boxShadow: 'var(--shadow-soft)', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, animation: 'sb-pulse 1.8s ease-in-out infinite' }} />
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--danger-text)' }}>Requieren atención</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pagedUnresolved.map(a => (
                  <div key={a.id} style={{ background: 'var(--red-50)', borderRadius: 12, padding: '13px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'var(--surface)', color: 'var(--danger-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{a.initials}</div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5, color: 'var(--fg1)' }}>{a.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{a.fecha}</div>
                      </div>
                    </div>
                    {/* "Atender" era un botón sin acción: el panel no puede cerrar alertas. El
                        estado distingue si todavía espera al padrino o si ya se escaló. */}
                    <AlertStatusBadge status={a.status} />
                  </div>
                ))}
              </div>
              {attnTotalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--fg2)' }}>{attnPage + 1} / {attnTotalPages}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setAttnPage(p => p - 1)}
                      aria-label="Alertas anteriores"
                      disabled={attnPage === 0}
                      style={{ width: 30, height: 30, borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--surface)', color: attnPage === 0 ? 'var(--border)' : 'var(--danger-text)', cursor: attnPage === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <WIcon name="chevron-left" size={14} />
                    </button>
                    <button
                      onClick={() => setAttnPage(p => p + 1)}
                      aria-label="Alertas siguientes"
                      disabled={attnPage >= attnTotalPages - 1}
                      style={{ width: 30, height: 30, borderRadius: 9999, border: '1px solid var(--border)', background: 'var(--surface)', color: attnPage >= attnTotalPages - 1 ? 'var(--border)' : 'var(--danger-text)', cursor: attnPage >= attnTotalPages - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <WIcon name="chevron-right" size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', padding: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Qué pasa cuando un paciente activa el botón</h2>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
              {PROTOCOL.map((step, i) => (
                <li key={step.title} style={{ display: 'flex', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{i + 1}</div>
                    {i < PROTOCOL.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 18, background: 'var(--border)' }} />}
                  </div>
                  <div style={{ paddingBottom: i < PROTOCOL.length - 1 ? 18 : 0, paddingTop: 4 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5, color: 'var(--fg1)' }}>{step.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--fg2)', marginTop: 3, lineHeight: 1.5 }}>{step.desc}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
