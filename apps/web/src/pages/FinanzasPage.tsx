import { useState } from 'react'
import { WIcon, DownloadIcon } from '../components/WIcon'
import { MetricCard } from '../components/MetricCard'
import { PAYMENT_DATA, UPCOMING_PAYMENTS, RECENT_COBROS, SEDES, type PaymentData } from '../data/mockData'

type PayStatus = PaymentData['status']

function PayStatusChip({ status }: { status: PayStatus }) {
  const map: Record<PayStatus, { bg: string; fg: string; label: string }> = {
    pagado:    { bg: 'var(--sage-50)',  fg: 'var(--sage-500)', label: 'Pagado'   },
    pendiente: { bg: 'var(--amber-50)', fg: 'var(--accent)',   label: 'Pendiente' },
    vencido:   { bg: 'var(--red-50)',   fg: 'var(--danger)',   label: 'Vencido'  },
    exento:    { bg: 'var(--teal-50)',  fg: 'var(--primary)',  label: 'Exento'   },
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
    <th style={{ textAlign: 'left', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 14px 12px' }}>{label}</th>
  )

  return (
    <div style={{ padding: 32, maxWidth: 1440, minWidth: 1100, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <MetricCard icon="wallet" label="Recaudado este mes" value={fmt(totalRecaudado)} tone="teal" important
          sub={<><WIcon name="trending-up" size={14} color="var(--sage-500)" /><span style={{ color: 'var(--sage-500)', fontWeight: 600 }}>+12%</span> vs. mes anterior</>} />
        <MetricCard icon="circle-check" label="Pagos al día" value={pagado} tone="sage" important
          sub="de 10 pacientes activos" />
        <MetricCard icon="clock" label="Cobros pendientes" value={pendiente} tone="amber" important
          sub="vencen antes del 30 jun" />
        <MetricCard icon="circle-alert" label="Pagos vencidos" value={vencido} tone="red" important
          sub="requieren seguimiento" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        {/* Payments table */}
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Pagos del mes</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Sede filter */}
              <div style={{ position: 'relative' }}>
                <select value={sedeFilter} onChange={e => setSedeFilter(e.target.value)}
                  style={{ appearance: 'none', background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '7px 28px 7px 10px', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--primary)', cursor: 'pointer', outline: 'none' }}>
                  {SEDES.map(s => <option key={s}>{s === 'Todas' ? 'Todas las sedes' : `Sede: ${s}`}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--primary)' }}>
                  <WIcon name="chevron-down" size={13} />
                </span>
              </div>
              {/* Status filter */}
              <div style={{ position: 'relative' }}>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
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
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px solid var(--border)', color: 'var(--primary)', borderRadius: 9999, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <DownloadIcon size={15} color="var(--primary)" /> Exportar
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col /><col style={{ width: 102 }} /><col style={{ width: 115 }} /><col style={{ width: 100 }} /><col style={{ width: 60 }} /><col style={{ width: 120 }} /><col style={{ width: 80 }} /></colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <Head label="Paciente" /><Head label="Sede" /><Head label="Monto" /><Head label="Vencimiento" /><Head label="Meses" /><Head label="Estado" /><Head label="" />
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--teal-50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '13px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12 }}>{p.initials}</div>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13.5, color: 'var(--fg1)' }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{ background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{p.sede}</span>
                  </td>
                  <td style={{ padding: '13px 14px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--fg1)' }}>{fmt(p.amount)}</td>
                  <td style={{ padding: '13px 14px', fontSize: 13, color: p.status === 'vencido' ? 'var(--danger)' : 'var(--fg2)', fontWeight: p.status === 'vencido' ? 600 : 400 }}>{p.dueDate}</td>
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'var(--teal-50)', color: 'var(--primary)', fontSize: 12, fontWeight: 700 }}>{p.permanencia}</span>
                  </td>
                  <td style={{ padding: '13px 14px' }}><PayStatusChip status={p.status} /></td>
                  <td style={{ padding: '13px 14px' }}>
                    <button style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Ver →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upcoming payments */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', padding: 20 }}>
            <h2 style={{ margin: '0 0 14px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Próximos cobros</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {UPCOMING_PAYMENTS.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: p.urgent ? 'var(--red-50)' : 'var(--bg)', borderRadius: 12, padding: '11px 13px', borderLeft: p.urgent ? '3px solid var(--danger)' : '3px solid transparent' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: p.urgent ? '#fff' : 'var(--teal-50)', color: p.urgent ? 'var(--danger)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12 }}>{p.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13.5, color: 'var(--fg1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: p.urgent ? 'var(--danger)' : 'var(--fg2)', fontWeight: p.urgent ? 600 : 400 }}>{p.date}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: p.urgent ? 'var(--danger)' : 'var(--primary)', flexShrink: 0 }}>{p.amount}</span>
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
                  <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--sage-50)', color: 'var(--sage-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12 }}>{c.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13.5, color: 'var(--fg1)' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{c.date}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--sage-500)', flexShrink: 0 }}>{c.amount}</span>
                </div>
              ))}
            </div>
            <button style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              Ver historial completo →
            </button>
          </div>

          {/* Export PDF panel */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', padding: 20 }}>
            <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15, color: 'var(--fg1)' }}>Exportar reporte financiero</h2>
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--fg2)' }}>Genera el resumen de cobros en PDF.</p>
            <button style={{ width: '100%', height: 44, borderRadius: 9999, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <DownloadIcon size={17} color="#fff" /> Exportar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
