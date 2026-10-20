import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { WIcon } from '../../components/WIcon'
import {
  api,
  chargeFamilyInvoices,
  deleteFamilyCard,
  finishFamilyInscription,
  getFamilyCard,
  startFamilyInscription,
  type AuthUser,
  type FamilyPaymentResult,
  type InscriptionOutcome,
  type StartedInscription,
} from '../../services/api'
import { Notice, Shell } from './Shell'
import { primaryButton } from './BillingCard'
import {
  BILLING_KEY,
  defaultSelection,
  formatCLP,
  formatDueDate,
  formatMonth,
  formatPaidDate,
  formatPaidTime,
  unpaidInvoices,
} from './billing'

const CARD_KEY = ['family', 'card']
// La selección sobrevive al viaje a Transbank y de vuelta: la página se recarga entera.
const SELECTION_STORAGE = 'sb-pago-seleccion'

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

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: 'var(--surface-alt)',
  color: 'var(--primary-text)',
  border: '1px solid var(--border)',
}

const linkButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--primary-text)',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  textDecoration: 'underline',
}

const INSCRIPTION_MESSAGES: Record<InscriptionOutcome, { ok: boolean; text: string }> = {
  ok: { ok: true, text: 'Tarjeta inscrita. Ya puedes pagar.' },
  rechazada: { ok: false, text: 'Transbank no aprobó la tarjeta. Prueba con otra.' },
  anulada: { ok: false, text: 'Cancelaste la inscripción de la tarjeta. No se guardó nada.' },
  error: { ok: false, text: 'No pudimos completar la inscripción de la tarjeta. Vuelve a intentarlo.' },
}

// Transbank espera que el NAVEGADOR le haga un POST con el token: no se puede pedir por fetch.
function goToWebpay({ token, urlWebpay }: StartedInscription) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = urlWebpay
  const field = document.createElement('input')
  field.type = 'hidden'
  field.name = 'TBK_TOKEN'
  field.value = token
  form.appendChild(field)
  document.body.appendChild(form)
  form.submit()
}

const readSelection = (): string[] | null => {
  try {
    const raw = sessionStorage.getItem(SELECTION_STORAGE)
    sessionStorage.removeItem(SELECTION_STORAGE)
    return raw ? (JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

const saveSelection = (ids: string[]) => {
  try {
    sessionStorage.setItem(SELECTION_STORAGE, JSON.stringify(ids))
  } catch {
    // Sin almacenamiento solo se pierde la selección: al volver se marca la de siempre.
  }
}

function messageForChargeError(err: unknown): string {
  const status = (err as { status?: number }).status
  if (status === 409) return 'Alguna de las cuotas ya está pagada o tiene un cobro en curso. Revisa la lista e inténtalo de nuevo.'
  if (status === 403) return 'Tu vínculo con el paciente no está activo, así que no puedes pagar por él.'
  if (status === 503) return 'Los pagos en línea no están disponibles por ahora. No se hizo ningún cobro.'
  if (status === 429) return 'Hiciste demasiados intentos seguidos. Espera un minuto y vuelve a probar.'
  return 'No pudimos procesar el pago. Revisa tu conexión: si el problema sigue, consulta antes de reintentar, porque el cobro podría haberse hecho.'
}

export function PaymentPage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const billing = useQuery({ queryKey: BILLING_KEY, queryFn: api.getFamilyBilling })
  const card = useQuery({ queryKey: CARD_KEY, queryFn: getFamilyCard })

  // null = la selección por omisión del backend (vencidas, o la próxima por adelantado).
  const [selected, setSelected] = useState<string[] | null>(null)
  const [result, setResult] = useState<FamilyPaymentResult | null>(null)
  const [cardNotice, setCardNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [returning, setReturning] = useState(() => {
    const qs = new URLSearchParams(window.location.search)
    return qs.has('TBK_TOKEN') || qs.has('inscripcion')
  })
  const handledReturn = useRef(false)

  // Al volver de Transbank la URL trae TBK_TOKEN. El retorno público no cierra nada: acá se cierra
  // la inscripción con la sesión del familiar (si no fuera suya, el backend responde «error»).
  useEffect(() => {
    if (!returning || handledReturn.current) return
    handledReturn.current = true
    const qs = new URLSearchParams(window.location.search)
    const token = qs.get('TBK_TOKEN')
    const restored = readSelection()
    if (restored) setSelected(restored)

    const done = (outcome: InscriptionOutcome) => {
      setCardNotice(INSCRIPTION_MESSAGES[outcome])
      navigate('/familiar/pago', { replace: true })
      queryClient.invalidateQueries({ queryKey: CARD_KEY })
      setReturning(false)
    }
    if (!token) {
      done('error')
      return
    }
    finishFamilyInscription({
      token,
      abortedBuyOrder: qs.get('TBK_ORDEN_COMPRA') ?? undefined,
      abortedSessionId: qs.get('TBK_ID_SESION') ?? undefined,
    })
      .then((r) => done(r.outcome))
      .catch(() => done('error'))
  }, [returning, navigate, queryClient])

  const inscribe = useMutation({
    mutationFn: async (replace: boolean) => {
      if (replace) await deleteFamilyCard()
      return startFamilyInscription()
    },
    onSuccess: (started) => {
      saveSelection(selected ?? (billing.data ? defaultSelection(billing.data) : []))
      goToWebpay(started)
    },
    onError: (err) => {
      const status = (err as { status?: number }).status
      setCardNotice({
        ok: false,
        text:
          status === 503
            ? 'Los pagos en línea no están disponibles por ahora.'
            : status === 409
              ? 'Ya tienes una tarjeta inscrita. Recarga la página.'
              : 'No pudimos abrir el formulario de la tarjeta. Vuelve a intentarlo.',
      })
      queryClient.invalidateQueries({ queryKey: CARD_KEY })
    },
  })

  const pay = useMutation({
    mutationFn: (ids: string[]) => chargeFamilyInvoices(ids),
    onMutate: () => setError(null),
    onSuccess: (r) => {
      setResult(r)
      setSelected(null)
    },
    onError: (err) => {
      setError(messageForChargeError(err))
      queryClient.invalidateQueries({ queryKey: BILLING_KEY })
    },
    // Aunque falle, la lista tiene que reflejar lo que de verdad quedó pagado.
    onSettled: () => queryClient.invalidateQueries({ queryKey: BILLING_KEY }),
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

  if (billing.isLoading || card.isLoading || returning) {
    return (
      <Shell user={user} onLogout={onLogout}>
        <p style={{ color: 'var(--fg2)' }} role="status">
          {returning ? 'Confirmando tu tarjeta con Transbank…' : 'Cargando la mensualidad…'}
        </p>
      </Shell>
    )
  }

  const data = billing.data
  if (billing.isError || !data) {
    return (
      <Shell user={user} onLogout={onLogout}>
        {back}
        <Notice icon="circle-alert" title="No pudimos cargar la mensualidad">
          Revisa tu conexión y vuelve a intentarlo.{' '}
          <button onClick={() => billing.refetch()} style={linkButton}>Reintentar</button>
        </Notice>
      </Shell>
    )
  }

  // Sin vínculo activo el portal ya explica por qué no hay nada que ver; esta ruta no aplica.
  if (data.linkStatus !== 'active') return <Navigate to="/familiar" replace />

  const name = data.patientFirstName ?? 'tu familiar'

  // CA6 — el pago salió bien (todo o en parte): comprobante.
  if (result && (result.status === 'paid' || result.status === 'partial')) {
    return (
      <Shell user={user} onLogout={onLogout}>
        <Confirmation
          result={result}
          name={name}
          onBack={() => navigate('/familiar')}
          onRetry={() => setResult(null)}
        />
      </Shell>
    )
  }

  const unpaid = unpaidInvoices(data)
  const paidRows = data.invoices.filter((i) => i.status === 'paid')
  const hasOverdue = unpaid.some((i) => i.status === 'overdue')
  const unpaidIds = new Set(unpaid.map((i) => i.id))
  // Una selección vieja puede incluir cuotas que ya se pagaron en otra pestaña.
  const chosen = (selected ?? defaultSelection(data)).filter((id) => unpaidIds.has(id))
  const total = unpaid.filter((i) => chosen.includes(i.id)).reduce((sum, i) => sum + i.amountCLP, 0)
  const busy = pay.isPending || inscribe.isPending
  const savedCard = card.data

  const toggle = (id: string) =>
    setSelected(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])

  return (
    <Shell user={user} onLogout={onLogout}>
      {back}

      <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, color: 'var(--fg1)' }}>
        Pagar mensualidad
      </h2>
      <p style={{ margin: '4px 0 20px', fontSize: 14, color: 'var(--fg2)' }}>
        Cuotas del tratamiento de {name}.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!hasOverdue && (
          <div role="status">
            <Notice icon="circle-check" title="Todas las cuotas están al día">
              {data.nextBillingDate
                ? `El próximo cobro de ${name} vence el ${formatDueDate(data.nextBillingDate)}. Si quieres, puedes pagarlo por adelantado.`
                : `Todavía no se genera la próxima cuota de ${name}.`}
            </Notice>
          </div>
        )}

        {result && (result.status === 'rejected' || result.status === 'error') && (
          <div role="alert">
            <Notice icon="circle-alert" title="El pago no se realizó">
              Tu banco o Transbank rechazó el cobro. No se cambió nada en la mensualidad de {name}. Puedes volver a
              intentarlo o usar otra tarjeta.
            </Notice>
          </div>
        )}
        {result?.status === 'processing' && (
          <div role="alert">
            <Notice icon="clock" title="Tu pago sigue en proceso">
              Transbank todavía no confirma el cobro. No vuelvas a pagar: revisa el estado en unos minutos.
            </Notice>
          </div>
        )}
        {error && (
          <div role="alert">
            <Notice icon="circle-alert" title="No se pudo completar el pago">{error}</Notice>
          </div>
        )}

        <section style={sectionStyle} aria-labelledby="pago-cuotas">
          <h3 id="pago-cuotas" style={sectionTitle}>Cuotas</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {[...unpaid, ...paidRows.reverse()].map((i) => {
              const isPaid = i.status === 'paid'
              const checked = chosen.includes(i.id)
              return (
                <li key={i.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', cursor: isPaid || busy ? 'default' : 'pointer', opacity: isPaid ? 0.85 : 1 }}
                  >
                    {isPaid ? (
                      <span style={{ width: 18, display: 'flex', justifyContent: 'center', color: 'var(--secondary-text)' }}>
                        <WIcon name="circle-check" size={18} />
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggle(i.id)}
                        style={{ accentColor: 'var(--primary)', width: 18, height: 18, margin: 0 }}
                      />
                    )}
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--fg1)' }}>
                        {formatMonth(i.month)}
                      </span>
                      <span style={{ display: 'block', fontSize: 12.5, color: isPaid ? 'var(--secondary-text)' : 'var(--fg2)', marginTop: 2 }}>
                        {isPaid
                          ? i.paidAt
                            ? `Pagada · ${formatPaidDate(i.paidAt)}`
                            : 'Pagada'
                          : i.status === 'overdue'
                            ? `Vencida · venció el ${formatDueDate(i.dueDate)}`
                            : `Vence el ${formatDueDate(i.dueDate)}`}
                      </span>
                    </span>
                    <span style={{ fontSize: 14.5, color: 'var(--fg1)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCLP(i.amountCLP)}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {unpaid.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg1)' }}>Total a pagar</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, color: 'var(--fg1)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCLP(total)}
              </span>
            </div>
          )}
        </section>

        {unpaid.length > 0 && (
          <section style={sectionStyle} aria-labelledby="pago-medio">
            <h3 id="pago-medio" style={sectionTitle}>Medio de pago</h3>

            {cardNotice && (
              <p
                role="status"
                style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.5, color: cardNotice.ok ? 'var(--secondary-text)' : 'var(--fg1)', fontWeight: 600 }}
              >
                {cardNotice.text}
              </p>
            )}

            {savedCard ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--primary-text)' }}><WIcon name="credit-card" size={22} /></span>
                <span style={{ flex: 1, minWidth: 140 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--fg1)' }}>
                    {savedCard.cardType ?? 'Tarjeta'} terminada en {savedCard.cardLast4 ?? '····'}
                  </span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--fg2)', marginTop: 1 }}>Webpay Oneclick</span>
                </span>
                <button onClick={() => inscribe.mutate(true)} disabled={busy} style={{ ...linkButton, opacity: busy ? 0.6 : 1 }}>
                  Usar otra tarjeta
                </button>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6 }}>
                  Para pagar, primero inscribe una tarjeta de débito, crédito o prepago. Te llevamos al formulario seguro de
                  Transbank y vuelves aquí.
                </p>
                <button onClick={() => inscribe.mutate(false)} disabled={busy} style={{ ...secondaryButton, opacity: busy ? 0.6 : 1 }}>
                  <WIcon name="credit-card" size={17} />
                  {inscribe.isPending ? 'Abriendo Transbank…' : 'Inscribir tarjeta'}
                </button>
              </div>
            )}
          </section>
        )}

        {unpaid.length > 0 && (
          <>
            <button
              onClick={() => pay.mutate(chosen)}
              disabled={busy || !savedCard || chosen.length === 0}
              style={{
                ...primaryButton,
                width: '100%',
                padding: '13px 20px',
                fontSize: 15,
                opacity: busy || !savedCard || chosen.length === 0 ? 0.55 : 1,
                cursor: busy || !savedCard || chosen.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {pay.isPending ? 'Procesando el pago…' : chosen.length === 0 ? 'Elige al menos una cuota' : `Pagar ${formatCLP(total)}`}
            </button>
            <p style={{ margin: '-4px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12.5, color: 'var(--fg2)' }}>
              <WIcon name="shield" size={14} />
              El pago se procesa en Transbank; StopBet no guarda los datos de tu tarjeta.
            </p>
          </>
        )}
      </div>
    </Shell>
  )
}

function Confirmation({
  result,
  name,
  onBack,
  onRetry,
}: {
  result: FamilyPaymentResult
  name: string
  onBack: () => void
  onRetry: () => void
}) {
  const [downloadError, setDownloadError] = useState(false)
  const paid = result.items.filter((i) => i.status === 'authorized')
  const rows: [string, string][] = [
    ['Total pagado', formatCLP(result.totalPaidCLP)],
    ['Cuotas', paid.map((i) => formatMonth(i.month)).join(', ')],
  ]
  if (result.paidAt) {
    rows.push(['Fecha', formatPaidDate(result.paidAt)], ['Hora', `${formatPaidTime(result.paidAt)} h`])
  }
  if (result.card.cardLast4) {
    rows.push(['Tarjeta', `${result.card.cardType ?? 'Tarjeta'} terminada en ${result.card.cardLast4}`])
  }

  async function download() {
    setDownloadError(false)
    try {
      // jsPDF pesa: solo se baja cuando alguien pide el comprobante.
      const { generateReceiptPDF } = await import('../../utils/generateReceiptPDF')
      generateReceiptPDF(result, name)
    } catch {
      setDownloadError(true)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={sectionStyle} aria-labelledby="pago-ok" role="status">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <span style={{ flexShrink: 0, width: 46, height: 46, borderRadius: '50%', background: 'var(--sage-50)', color: 'var(--secondary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WIcon name="circle-check" size={24} />
          </span>
          <div>
            <h2 id="pago-ok" style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 21, color: 'var(--fg1)' }}>
              {result.status === 'paid' ? 'Pago realizado' : 'Pago realizado en parte'}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 14, color: 'var(--fg2)' }}>
              Mensualidad del tratamiento de {name}.
            </p>
          </div>
        </div>

        <dl style={{ margin: 0 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <dt style={{ fontSize: 14, color: 'var(--fg2)' }}>{label}</dt>
              <dd style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--fg1)', textAlign: 'right' }}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {result.status === 'partial' && (
        <div role="alert">
          <Notice icon="circle-alert" title="Quedaron cuotas sin pagar">
            Transbank no aprobó el cobro de las cuotas restantes y no se cobró nada por ellas. Puedes intentarlo de nuevo
            o usar otra tarjeta.
          </Notice>
        </div>
      )}

      {downloadError && (
        <p role="alert" style={{ margin: 0, fontSize: 13.5, color: 'var(--fg1)', fontWeight: 600 }}>
          No pudimos generar el comprobante. Vuelve a intentarlo.
        </p>
      )}

      <button onClick={download} style={{ ...secondaryButton, width: '100%', padding: '13px 20px', fontSize: 15 }}>
        <WIcon name="download" size={17} />
        Descargar comprobante
      </button>
      {result.status === 'partial' && (
        <button onClick={onRetry} style={{ ...secondaryButton, width: '100%', padding: '13px 20px', fontSize: 15 }}>
          Pagar las cuotas que faltan
        </button>
      )}
      <button onClick={onBack} style={{ ...primaryButton, width: '100%', padding: '13px 20px', fontSize: 15 }}>
        Volver al portal
      </button>
    </div>
  )
}
