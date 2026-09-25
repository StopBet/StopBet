import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { WIcon } from '../../components/WIcon'
import { api } from '../../services/api'
import { BILLING_KEY, amountDue, formatCLP, formatDueDate } from './billing'

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  boxShadow: 'var(--shadow-soft)',
  padding: 22,
}

export const primaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: 'var(--primary)',
  color: 'var(--fg-on-primary)',
  border: 'none',
  borderRadius: 999,
  padding: '11px 20px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}

export function BillingCard() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: BILLING_KEY,
    queryFn: api.getFamilyBilling,
  })

  if (isLoading) {
    return (
      <div style={cardStyle}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--fg2)' }}>Cargando la mensualidad…</p>
      </div>
    )
  }

  // La mensualidad es un agregado del portal: si falla, las sesiones tienen que seguir
  // viéndose, así que el error se queda dentro de la tarjeta.
  if (isError || !data) {
    return (
      <div style={cardStyle}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6 }}>
          No pudimos cargar la mensualidad.{' '}
          <button
            onClick={() => refetch()}
            style={{ background: 'none', border: 'none', color: 'var(--primary-text)', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 14 }}
          >
            Reintentar
          </button>
        </p>
      </div>
    )
  }

  if (data.linkStatus !== 'active') return null

  const { items, total } = amountDue(data)
  const overdueCount = data.overdueInvoices.length
  const name = data.patientFirstName ?? 'tu familiar'

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'var(--surface-alt)',
            color: 'var(--primary-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <WIcon name="wallet" size={19} />
        </span>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, color: 'var(--fg1)' }}>
            Mensualidad
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--fg2)' }}>Tratamiento de {name}</p>
        </div>
      </div>

      {overdueCount > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--fg2)' }}>
            {overdueCount === 1 ? '1 cuota por pagar' : `${overdueCount} cuotas por pagar`}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, color: 'var(--fg1)', marginTop: 2 }}>
            {formatCLP(total)}
          </div>
        </div>
      ) : data.nextInvoice ? (
        <div style={{ marginTop: 16 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'var(--sage-50)',
              color: 'var(--secondary-text)',
              borderRadius: 999,
              padding: '3px 10px',
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            <WIcon name="circle-check" size={14} />
            Al día
          </span>
          <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6 }}>
            Próxima cuota: <strong style={{ color: 'var(--fg1)' }}>{formatCLP(data.nextInvoice.amountCLP)}</strong>,
            vence el {formatDueDate(data.nextInvoice.dueDate)}.
          </p>
        </div>
      ) : (
        <p style={{ margin: '16px 0 0', fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6 }}>
          No hay cuotas pendientes.
        </p>
      )}

      {data.accountStatus === 'suspended' && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--fg2)', lineHeight: 1.55 }}>
          El acceso de {name} a la app está pausado. Se reactiva cuando las cuotas quedan al día.
        </p>
      )}

      {items.length > 0 && (
        <button onClick={() => navigate('/familiar/pago')} style={{ ...primaryButton, marginTop: 18, width: '100%' }}>
          {overdueCount > 0 ? 'Pagar cuotas' : 'Pagar por adelantado'}
          <WIcon name="arrow-right" size={16} />
        </button>
      )}
    </div>
  )
}
