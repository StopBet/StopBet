import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import { MetricCard } from '../components/MetricCard'
import { api, getPatientsBilling, type PatientBillingRow, type PatientPaymentState } from '../services/api'
import { shortSedeName } from '../utils/patientView'
import { useIsNarrow } from '../hooks/useIsNarrow'

const STATE_LABEL: Record<PatientPaymentState, string> = {
  up_to_date: 'Al día',
  pending: 'Pendiente',
  overdue: 'Vencido',
}

function PayStatusChip({ state }: { state: PatientPaymentState }) {
  const map: Record<PatientPaymentState, { bg: string; fg: string; icon: string }> = {
    up_to_date: { bg: 'var(--sage-50)',  fg: 'var(--secondary-text)', icon: 'circle-check' },
    pending:    { bg: 'var(--amber-50)', fg: 'var(--primary-text)',   icon: 'clock' },
    overdue:    { bg: 'var(--red-50)',   fg: 'var(--danger-text)',    icon: 'circle-alert' },
  }
  const s = map[state]
  // El ícono va además del color: el estado no puede depender solo de distinguir verde de rojo.
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', background: s.bg, color: s.fg, borderRadius: 9999, padding: '5px 12px', fontSize: 12, fontWeight: 700 }}>
      <WIcon name={s.icon} size={13} color={s.fg} />
      {STATE_LABEL[state]}
    </span>
  )
}

const fmtCLP = (n: number) => `$${n.toLocaleString('es-CL')}`

// Las fechas llegan como 'YYYY-MM-DD' (día de Chile). Pasarlas por `new Date()` las leería como
// medianoche UTC y en Chile mostraría el día anterior.
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function dueText(r: PatientBillingRow): string {
  if (!r.nextDueDate) return 'Sin cobros próximos'
  if (r.state === 'overdue') return `Venció el ${fmtDate(r.nextDueDate)}`
  if (r.state === 'pending') return `Vence el ${fmtDate(r.nextDueDate)}`
  return `Próximo cobro: ${fmtDate(r.nextDueDate)}`
}

function delayText(days: number): string {
  if (days === 0) return '—'
  return days === 1 ? '1 día' : `${days} días`
}

const initials = (r: PatientBillingRow) => `${r.firstName[0] ?? ''}${r.lastName[0] ?? ''}`.toUpperCase()

type StateFilter = 'todas' | PatientPaymentState

const RING: Record<PatientPaymentState, string> = {
  up_to_date: 'var(--secondary-text)',
  pending: 'var(--primary)',
  overdue: 'var(--danger)',
}

// Un <button> alrededor de MetricCard y no su `onClick`: MetricCard es un <div> que no se alcanza
// con el teclado ni dice si está activo. El anillo marca qué filtro se está mirando; con solo el
// select de la tabla no se notaba que tocar la tarjeta había filtrado algo.
function FilterCard({ state, active, onToggle, children }: { state: PatientPaymentState; active: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={`${active ? 'Quitar el filtro' : 'Mostrar solo'} «${STATE_LABEL[state]}»`}
      style={{
        display: 'flex', width: '100%', minWidth: 0, padding: 0, border: 'none', background: 'none', textAlign: 'left',
        font: 'inherit', color: 'inherit', cursor: 'pointer', borderRadius: 16,
        boxShadow: active ? `0 0 0 3px ${RING[state]}` : 'none',
        transition: 'box-shadow 150ms ease',
      }}
    >
      {children}
    </button>
  )
}

export function FinanzasPage() {
  const isNarrow = useIsNarrow()
  const [sedeFilter, setSedeFilter] = useState('todas')
  const [stateFilter, setStateFilter] = useState<StateFilter>('todas')

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['billing', 'patients'],
    queryFn: getPatientsBilling,
  })
  const { data: sedes = [] } = useQuery({
    queryKey: ['sedes'],
    queryFn: api.getSedes,
  })

  // `users.sedeId` guarda el nombre o el UUID según de dónde venga la cuenta: se normaliza al
  // nombre para que una sede no aparezca dos veces en el filtro.
  const sedeName = useMemo(() => {
    const byId = Object.fromEntries(sedes.map(s => [s.id, s.name]))
    return (r: PatientBillingRow) => shortSedeName(byId[r.sedeId ?? ''] ?? r.sedeId ?? 'Sin sede')
  }, [sedes])

  const all = useMemo(() => data ?? [], [data])
  const sedeOptions = useMemo(() => [...new Set(all.map(sedeName))].sort((a, b) => a.localeCompare(b, 'es')), [all, sedeName])

  const rows = useMemo(() => {
    const filtered = all.filter(r =>
      (sedeFilter === 'todas' || sedeName(r) === sedeFilter) &&
      (stateFilter === 'todas' || r.state === stateFilter),
    )
    // CA2: con «Vencido», de más a menos días de atraso. El backend ya manda ese orden; se repite
    // acá para que no dependa de él.
    return stateFilter === 'overdue' ? [...filtered].sort((a, b) => b.daysOverdue - a.daysOverdue) : filtered
  }, [all, sedeFilter, stateFilter, sedeName])

  const toggleState = (s: PatientPaymentState) => setStateFilter(current => (current === s ? 'todas' : s))
  const count = (s: PatientPaymentState) => all.filter(r => r.state === s).length
  const totalOwed = all.reduce((sum, r) => sum + r.totalOwedCLP, 0)

  const Head = ({ label }: { label: string }) => (
    <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 14px 12px' }}>{label}</th>
  )

  const pagePad = { padding: isNarrow ? '16px 12px 28px' : 32, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const }
  const card = { background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }

  if (isLoading) {
    return (
      <div style={pagePad}>
        <p role="status" style={{ ...card, margin: 0, padding: 32, textAlign: 'center', fontSize: 14, color: 'var(--fg2)' }}>Cargando el estado de pago de tus pacientes…</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div style={pagePad}>
        <div role="alert" style={{ ...card, padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--fg1)' }}>No pudimos cargar el estado de pago. Revisa tu conexión y vuelve a intentarlo.</p>
          <button onClick={() => refetch()} disabled={isFetching}
            style={{ height: 40, padding: '0 20px', borderRadius: 9999, border: 'none', background: 'var(--primary)', color: 'var(--fg-on-primary)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {isFetching ? 'Reintentando…' : 'Reintentar'}
          </button>
        </div>
      </div>
    )
  }

  // CA3: sin ningún pago registrado se explica por qué no hay tabla, en vez de mostrarla vacía.
  if (all.length === 0) {
    return (
      <div style={pagePad}>
        <div style={{ ...card, padding: isNarrow ? '32px 20px' : '48px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WIcon name="wallet" size={26} color="var(--primary-text)" />
          </div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Aún no hay pagos registrados</h2>
          <p style={{ margin: 0, maxWidth: 460, fontSize: 14, lineHeight: 1.55, color: 'var(--fg2)' }}>
            Cuando a tus pacientes se les genere su primera mensualidad, vas a ver aquí cuánto deben, cuándo vence y si están al día.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={pagePad}>
      {/* auto-fit: ver la nota en OverviewPage.tsx — un número fijo de columnas cortaba la
          última tarjeta contra el borde en laptops más chicas. */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: isNarrow ? 10 : 16, marginBottom: isNarrow ? 16 : 24 }}>
        <FilterCard state="up_to_date" active={stateFilter === 'up_to_date'} onToggle={() => toggleState('up_to_date')}>
          <MetricCard icon="circle-check" label="Al día" value={count('up_to_date')} tone="sage" important
            sub={stateFilter === 'up_to_date' ? 'Filtrando · toca para quitar' : 'pagaron hasta este mes'} />
        </FilterCard>
        <FilterCard state="pending" active={stateFilter === 'pending'} onToggle={() => toggleState('pending')}>
          <MetricCard icon="clock" label="Pendientes" value={count('pending')} tone="amber" important
            sub={stateFilter === 'pending' ? 'Filtrando · toca para quitar' : 'cuota del mes por pagar'} />
        </FilterCard>
        <FilterCard state="overdue" active={stateFilter === 'overdue'} onToggle={() => toggleState('overdue')}>
          <MetricCard icon="circle-alert" label="Vencidos" value={count('overdue')} tone="red" important
            sub={stateFilter === 'overdue' ? 'Filtrando · toca para quitar' : 'requieren seguimiento'} />
        </FilterCard>
        <MetricCard icon="wallet" label="Total adeudado" value={fmtCLP(totalOwed)} tone="teal" important
          sub="vencido y del mes en curso" />
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Estado de pago</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {stateFilter !== 'todas' && (
              <button type="button" onClick={() => setStateFilter('todas')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: '6px 4px', fontSize: 12.5, fontWeight: 600, color: 'var(--primary-text)', cursor: 'pointer' }}>
                <WIcon name="x" size={13} /> Quitar filtro
              </button>
            )}
            {sedeOptions.length > 1 && (
              <div style={{ position: 'relative' }}>
                <select value={sedeFilter} onChange={e => setSedeFilter(e.target.value)} aria-label="Filtrar por sede"
                  style={{ appearance: 'none', background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '7px 28px 7px 10px', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--primary)', cursor: 'pointer', outline: 'none' }}>
                  <option value="todas">Todas las sedes</option>
                  {sedeOptions.map(s => <option key={s} value={s}>Sede: {s}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--primary-text)' }}>
                  <WIcon name="chevron-down" size={13} />
                </span>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <select value={stateFilter} onChange={e => setStateFilter(e.target.value as StateFilter)} aria-label="Filtrar por estado de pago"
                style={{ appearance: 'none', background: 'var(--bg)', color: 'var(--fg2)', borderRadius: 8, padding: '7px 28px 7px 10px', fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer', outline: 'none' }}>
                <option value="todas">Todos los estados</option>
                <option value="up_to_date">Al día</option>
                <option value="pending">Pendiente</option>
                <option value="overdue">Vencido</option>
              </select>
              <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--fg2)' }}>
                <WIcon name="chevron-down" size={13} />
              </span>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <p style={{ margin: 0, padding: '28px 24px', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 13.5, color: 'var(--fg2)' }}>
            {stateFilter === 'overdue' ? 'Ningún paciente tiene cuotas vencidas.' : 'Ningún paciente coincide con este filtro.'}
          </p>
        ) : isNarrow ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map(r => {
              const overdue = r.state === 'overdue'
              return (
                <div key={r.patientId} style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '14px 20px', borderTop: '1px solid var(--border)', background: overdue ? 'var(--red-50)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12.5 }}>{initials(r)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, color: 'var(--fg1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.firstName} {r.lastName}</div>
                      <div style={{ fontSize: 12, color: overdue ? 'var(--danger-text)' : 'var(--fg2)', fontWeight: overdue ? 600 : 400 }}>
                        {dueText(r)}{overdue ? ` · ${delayText(r.daysOverdue)} de atraso` : ''}
                      </div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--fg1)', flexShrink: 0 }}>{fmtCLP(r.totalOwedCLP)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <PayStatusChip state={r.state} />
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap', background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{sedeName(r)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup><col /><col style={{ width: 140 }} /><col style={{ width: 120 }} /><col style={{ width: 200 }} /><col style={{ width: 100 }} /><col style={{ width: 130 }} /></colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <Head label="Paciente" /><Head label="Sede" /><Head label="Adeudado" /><Head label="Vencimiento" /><Head label="Atraso" /><Head label="Estado" />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const overdue = r.state === 'overdue'
                  return (
                    <tr key={r.patientId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '13px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12 }}>{initials(r)}</div>
                          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13.5, color: 'var(--fg1)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${r.firstName} ${r.lastName}`}>{r.firstName} {r.lastName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '13px 14px' }}>
                        <span style={{ display: 'inline-block', whiteSpace: 'nowrap', background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{sedeName(r)}</span>
                      </td>
                      <td style={{ padding: '13px 14px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--fg1)' }}>{fmtCLP(r.totalOwedCLP)}</td>
                      <td style={{ padding: '13px 14px', fontSize: 13, color: overdue ? 'var(--danger-text)' : 'var(--fg2)', fontWeight: overdue ? 600 : 400 }}>{dueText(r)}</td>
                      <td style={{ padding: '13px 14px', fontSize: 13, color: overdue ? 'var(--danger-text)' : 'var(--fg2)', fontWeight: overdue ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>{delayText(r.daysOverdue)}</td>
                      <td style={{ padding: '13px 14px' }}><PayStatusChip state={r.state} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
