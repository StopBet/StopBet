import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { WIcon } from '../../components/WIcon'
import { api, type AuthUser } from '../../services/api'
import { Notice, Shell } from './Shell'
import { primaryButton } from './BillingCard'
import { BILLING_KEY, amountDue, formatCLP, formatDueDate, formatMonth } from './billing'

type Method = 'card' | 'transfer'

// Genéricos a propósito: los medios concretos (Webpay, Mercado Pago, Khipu…) dependen de la
// pasarela que se elija con el cliente (ASUNCIONES-PENDIENTES, punto 4).
const METHODS: { id: Method; icon: string; label: string; hint: string }[] = [
  { id: 'card', icon: 'credit-card', label: 'Tarjeta', hint: 'Débito, crédito o prepago' },
  { id: 'transfer', icon: 'landmark', label: 'Transferencia bancaria', hint: 'Desde la cuenta de tu banco' },
]

const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  boxShadow: 'var(--shadow-soft)',
  padding: 22,
}

const sectionTitle: React.CSSProperties = {
  margin: '0 0 14px',
  fontFamily: 'var(--font-heading)',
  fontWeight: 700,
  fontSize: 16,
  color: 'var(--fg1)',
}

export function PaymentPage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const navigate = useNavigate()
  const [method, setMethod] = useState<Method>('card')
  const [submitted, setSubmitted] = useState(false)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: BILLING_KEY,
    queryFn: api.getFamilyBilling,
  })

  const back = (
    <button
      onClick={() => navigate('/familiar')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, marginBottom: 18, color: 'var(--primary-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
    >
      <WIcon name="chevron-left" size={17} />
      Volver al portal
    </button>
  )

  if (isLoading) {
    return (
      <Shell user={user} onLogout={onLogout}>
        <p style={{ color: 'var(--fg2)' }}>Cargando la mensualidad…</p>
      </Shell>
    )
  }

  if (isError || !data) {
    return (
      <Shell user={user} onLogout={onLogout}>
        {back}
        <Notice icon="circle-alert" title="No pudimos cargar la mensualidad">
          Revisa tu conexión y vuelve a intentarlo.{' '}
          <button
            onClick={() => refetch()}
            style={{ background: 'none', border: 'none', color: 'var(--primary-text)', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 14 }}
          >
            Reintentar
          </button>
        </Notice>
      </Shell>
    )
  }

  // Sin vínculo activo el portal ya explica por qué no hay nada que ver; esta ruta no aplica.
  if (data.linkStatus !== 'active') return <Navigate to="/familiar" replace />

  const { items, total } = amountDue(data)
  const name = data.patientFirstName ?? 'tu familiar'

  if (items.length === 0) {
    return (
      <Shell user={user} onLogout={onLogout}>
        {back}
        <Notice icon="calendar" title="No hay cuotas por pagar">
          La mensualidad de {name} está al día y todavía no se generó la próxima cuota.
        </Notice>
      </Shell>
    )
  }

  const isOverdue = data.overdueInvoices.length > 0

  return (
    <Shell user={user} onLogout={onLogout}>
      {back}

      <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, color: 'var(--fg1)' }}>
        Pagar mensualidad
      </h2>
      <p style={{ margin: '4px 0 20px', fontSize: 14, color: 'var(--fg2)' }}>
        {isOverdue ? `Cuotas por pagar del tratamiento de ${name}.` : `Próxima cuota del tratamiento de ${name}.`}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section style={sectionStyle} aria-labelledby="pago-detalle">
          <h3 id="pago-detalle" style={sectionTitle}>Detalle</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((i) => (
              <li
                key={i.month}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}
              >
                <div>
                  <div style={{ fontSize: 14.5, color: 'var(--fg1)', fontWeight: 600 }}>
                    {formatMonth(i.month)}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg2)', marginTop: 2 }}>Vence el {formatDueDate(i.dueDate)}</div>
                </div>
                <span style={{ fontSize: 14.5, color: 'var(--fg1)', fontVariantNumeric: 'tabular-nums' }}>{formatCLP(i.amountCLP)}</span>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg1)' }}>Total</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, color: 'var(--fg1)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCLP(total)}
            </span>
          </div>
        </section>

        <fieldset style={{ ...sectionStyle, margin: 0, minWidth: 0 }} disabled={submitted}>
          <legend style={{ ...sectionTitle, float: 'left', width: '100%' }}>Método de pago</legend>
          <div style={{ clear: 'both', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {METHODS.map((m) => {
              const selected = method === m.id
              return (
                <label
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '13px 15px',
                    borderRadius: 12,
                    border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
                    // El borde de 2px empujaría el contenido; se compensa con el margen.
                    margin: selected ? 0 : 1,
                    background: selected ? 'var(--surface-alt)' : 'var(--surface)',
                    cursor: submitted ? 'default' : 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    value={m.id}
                    checked={selected}
                    onChange={() => setMethod(m.id)}
                    style={{ accentColor: 'var(--primary)', width: 17, height: 17, margin: 0 }}
                  />
                  <span style={{ color: 'var(--primary-text)' }}>
                    <WIcon name={m.icon} size={20} />
                  </span>
                  <span>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--fg1)' }}>{m.label}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--fg2)', marginTop: 1 }}>{m.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {submitted ? (
          <div role="status">
            <Notice icon="clock" title="El pago en línea todavía no está disponible">
              Estamos habilitando la pasarela de pago. Cuando esté lista, este paso te llevará a
              pagar de forma segura. Mientras tanto, coordina el pago de {name} directamente con
              su sede. No se hizo ningún cobro.
            </Notice>
            <button
              onClick={() => navigate('/familiar')}
              style={{ ...primaryButton, marginTop: 16, width: '100%', background: 'var(--surface-alt)', color: 'var(--primary-text)', border: '1px solid var(--border)' }}
            >
              Volver al portal
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => setSubmitted(true)} style={{ ...primaryButton, width: '100%', padding: '13px 20px', fontSize: 15 }}>
              Pagar {formatCLP(total)}
            </button>
            <p style={{ margin: '-4px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12.5, color: 'var(--fg2)' }}>
              <WIcon name="shield" size={14} />
              El pago se procesa en la pasarela; StopBet no guarda datos de tu tarjeta.
            </p>
          </>
        )}
      </div>
    </Shell>
  )
}
