import { useState } from 'react'
import { WIcon } from '../components/WIcon'
import { MetricCard } from '../components/MetricCard'
import { PAYMENT_DATA, UPCOMING_PAYMENTS, RECENT_COBROS, SEDES, type PaymentData } from '../data/mockData'
import { useIsNarrow } from '../hooks/useIsNarrow'

type PayStatus = PaymentData['status']

function PayStatusChip({ status }: { status: PayStatus }) {
  const map: Record<PayStatus, { bg: string; fg: string; label: string }> = {
    pagado:    { bg: 'var(--sage-50)',  fg: 'var(--secondary-text)', label: 'Pagado'   },
    pendiente: { bg: 'var(--amber-50)', fg: 'var(--primary-text)',   label: 'Pendiente' },
    vencido:   { bg: 'var(--red-50)',   fg: 'var(--danger-text)',   label: 'Vencido'  },
    exento:    { bg: 'var(--teal-50)',  fg: 'var(--primary-text)',  label: 'Exento'   },
  }
  const s = map[status]
  return (
    <span style={{ display: 'inline-block', background: s.bg, color: s.fg, borderRadius: 9999, padding: '5px 13px', fontSize: 12, fontWeight: 700 }}>{s.label}</span>
  )
}

const pagado    = PAYMENT_DATA.filter(p => p.status === 'pagado').length
const pendiente = PAYMENT_DATA.filter(p => p.status === 'pendiente').length
const vencido   = PAYMENT_DATA.filter(p => p.status === 'vencido').length

export function FinanzasPage() {
  const isNarrow = useIsNarrow()
  const [sedeFilter, setSedeFilter] = useState('Todas')
  const [statusFilter, setStatusFilter] = useState<'todas' | PayStatus>('todas')

  const rows = PAYMENT_DATA.filter(p => {
    const matchSede = sedeFilter === 'Todas' || p.sede === sedeFilter
    const matchStatus = statusFilter === 'todas' || p.status === statusFilter
    return matchSede && matchStatus
  })

  const totalRecaudado = PAYMENT_DATA.filter(p => p.status === 'pagado').reduce((s, p) => s + p.amount, 0)

  const fmt = (n: number) => `$${n.toLocaleString('es-CL')}`
  const Head = ({ label }: { label: string }) => (
    <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 14px 12px' }}>{label}</th>
  )

  return (
    <div style={{ padding: isNarrow ? '16px 12px 28px' : 32, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Toda la página sale de mockData. Sin este aviso se leía como la contabilidad real
          de la sede, con nombres de pacientes y montos inventados. */}
      <div role="note" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: isNarrow ? 16 : 20 }}>
        <WIcon name="circle-alert" size={18} color="var(--primary-text)" />
        <div style={{ fontSize: 13.5, color: 'var(--fg1)', lineHeight: 1.5 }}>
          <strong>Datos de ejemplo.</strong> Finanzas todavía no está conectada a los pagos reales: las cifras y los nombres de esta página son ficticios.
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: isNarrow ? 10 : 16, marginBottom: isNarrow ? 16 : 24 }}>
        <MetricCard icon="wallet" label="Recaudado este mes" value={fmt(totalRecaudado)} tone="teal" important
          sub={<><WIcon name="trending-up" size={14} color="var(--secondary-text)" /><span style={{ color: 'var(--secondary-text)', fontWeight: 600 }}>+12%</span> vs. mes anterior</>} />
        <MetricCard icon="circle-check" label="Pagos al día" value={pagado} tone="sage" important
          sub="de 10 pacientes activos" />
        <MetricCard icon="clock" label="Cobros pendientes" value={pendiente} tone="amber" important
          sub="vencen antes del 30 jun" />
        <MetricCard icon="circle-alert" label="Pagos vencidos" value={vencido} tone="red" important
          sub="requieren seguimiento" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : 'minmax(0,2fr) minmax(0,1fr)', gap: isNarrow ? 12 : 16, alignItems: 'start' }}>
        {/* Payments table */}
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Pagos del mes</h2>
            {/* En angosto los tres controles no caben en una línea y el botón de
                exportar quedaba cortado por la derecha. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Sede filter */}
              <div style={{ position: 'relative' }}>
                <select value={sedeFilter} onChange={e => setSedeFilter(e.target.value)} aria-label="Filtrar pagos por sede"
                  style={{ appearance: 'none', background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '7px 28px 7px 10px', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--primary)', cursor: 'pointer', outline: 'none' }}>
                  {SEDES.map(s => <option key={s}>{s === 'Todas' ? 'Todas las sedes' : `Sede: ${s}`}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--primary-text)' }}>
                  <WIcon name="chevron-down" size={13} />
                </span>
              </div>
              {/* Status filter */}
              <div style={{ position: 'relative' }}>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filtrar pagos por estado"
                  style={{ appearance: 'none', background: 'var(--bg)', color: 'var(--fg2)', borderRadius: 8, padding: '7px 28px 7px 10px', fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer', outline: 'none' }}>
                  <option value="todas">Todos los estados</option>
                  <option value="pagado">Pagado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="vencido">Vencido</option>
                  <option value="exento">Exento</option>
                </select>
                <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--fg2)' }}>
                  <WIcon name="chevron-down" size={13} />
                </span>
              </div>
            </div>
          </div>

          {isNarrow ? (
            /* Siete columnas de ancho fijo: la de nombre se aplastaba a nada y el
               monto y el vencimiento, que es lo que se viene a mirar acá, quedaban
               fuera de pantalla. */
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {rows.map(p => {
                const overdue = p.status === 'vencido'
                return (
                  <div key={p.id} style={{
                    display: 'flex', flexDirection: 'column', gap: 9,
                    padding: '14px 20px', borderTop: '1px solid var(--border)',
                    background: overdue ? 'var(--red-50)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12.5 }}>{p.initials}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, color: 'var(--fg1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: overdue ? 'var(--danger-text)' : 'var(--fg2)', fontWeight: overdue ? 600 : 400 }}>
                          Vence {p.dueDate}
                        </div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--fg1)', flexShrink: 0 }}>{fmt(p.amount)}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <PayStatusChip status={p.status} />
                      <span style={{ background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{p.sede}</span>
                      <span style={{ fontSize: 12, color: 'var(--fg2)' }}>{p.permanencia} mes{p.permanencia !== 1 ? 'es' : ''}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col /><col style={{ width: 102 }} /><col style={{ width: 115 }} /><col style={{ width: 100 }} /><col style={{ width: 60 }} /><col style={{ width: 120 }} /></colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <Head label="Paciente" /><Head label="Sede" /><Head label="Monto" /><Head label="Vencimiento" /><Head label="Meses" /><Head label="Estado" />
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '13px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12 }}>{p.initials}</div>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13.5, color: 'var(--fg1)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{ background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{p.sede}</span>
                  </td>
                  <td style={{ padding: '13px 14px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--fg1)' }}>{fmt(p.amount)}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: p.status === 'vencido' ? 'var(--danger-text)' : 'var(--fg2)', fontWeight: p.status === 'vencido' ? 600 : 400 }}>{p.dueDate}</td>
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'var(--teal-50)', color: 'var(--primary-text)', fontSize: 12, fontWeight: 700 }}>{p.permanencia}</span>
                  </td>
                  <td style={{ padding: '13px 14px' }}><PayStatusChip status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upcoming payments */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', padding: 20 }}>
            <h2 style={{ margin: '0 0 14px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Próximos cobros</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {UPCOMING_PAYMENTS.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: p.urgent ? 'var(--red-50)' : 'var(--bg)', borderRadius: 12, padding: '11px 13px', borderLeft: p.urgent ? '3px solid var(--danger)' : '3px solid transparent' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: p.urgent ? 'var(--surface)' : 'var(--teal-50)', color: p.urgent ? 'var(--danger-text)' : 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12 }}>{p.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13.5, color: 'var(--fg1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: p.urgent ? 'var(--danger-text)' : 'var(--fg2)', fontWeight: p.urgent ? 600 : 400 }}>{p.date}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: p.urgent ? 'var(--danger-text)' : 'var(--primary-text)', flexShrink: 0 }}>{p.amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent cobros */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', padding: 20 }}>
            <h2 style={{ margin: '0 0 14px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Cobros recientes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {RECENT_COBROS.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < RECENT_COBROS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--sage-50)', color: 'var(--secondary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12 }}>{c.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13.5, color: 'var(--fg1)' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{c.date}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--secondary-text)', flexShrink: 0 }}>{c.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
