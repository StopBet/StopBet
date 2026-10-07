import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import {
  api, type ApiError, type FamilyLinkListItem, type FamilyLinkReviewItem, type FamilyLinkVerdict,
  type FamilyLinkVerification,
} from '../services/api'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useDialog } from '../hooks/useDialog'
import { fechaCorta as fecha, fechaHora } from '../utils/fecha'

// Todas comparten el prefijo ['family', 'links']: invalidarlo refresca las listas y los historiales.
const LINKS_KEY = ['family', 'links']
const PENDING_KEY = [...LINKS_KEY, 'pending']
const ACTIVE_KEY = [...LINKS_KEY, 'active']
const REVOKED_KEY = [...LINKS_KEY, 'revoked']
const REJECTED_KEY = [...LINKS_KEY, 'rejected']
const historyKey = (linkId: string) => [...LINKS_KEY, 'history', linkId]

const VERIFICATION_LABEL: Record<FamilyLinkVerification, string> = {
  patient_consulted: 'Confirmado por el paciente',
  in_person: 'Verificado en persona',
}

function errorMessage(err: unknown, fallback: string): string {
  const apiErr = err as ApiError
  return (apiErr?.body?.message as string | undefined) ?? fallback
}

/* ── Modal genérico de confirmación ─────────────────────────────────── */
function ActionModal({
  titleId, title, description, confirmLabel, confirmTone = 'primary', isPending, error, onClose, onConfirm,
  confirmDisabled = false,
}: {
  titleId: string
  title: string
  description: React.ReactNode
  confirmLabel: string
  confirmTone?: 'primary' | 'danger'
  isPending: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
  confirmDisabled?: boolean
}) {
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', animation: 'sb-scrim-in 0.18s ease' }} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={{ position: 'relative', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-strong)', width: 480, maxWidth: '95vw', animation: 'sb-modal-in 0.28s var(--ease-calm)', zIndex: 1 }}>
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <h2 id={titleId} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 21, color: 'var(--fg1)' }}>{title}</h2>
            <button onClick={onClose} aria-label="Cerrar" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WIcon name="x" size={16} />
            </button>
          </div>
          <div style={{ fontSize: 14, color: 'var(--fg2)', lineHeight: 1.55 }}>{description}</div>
          {error && (
            <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--danger-text)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ padding: '22px 28px 28px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 46, padding: '0 22px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending || confirmDisabled}
            style={{
              height: 46, padding: '0 26px', borderRadius: 9999, border: confirmTone === 'danger' ? '1.5px solid var(--danger)' : 'none',
              background: confirmTone === 'danger' ? 'var(--surface)' : 'var(--primary)',
              color: confirmTone === 'danger' ? 'var(--danger-text)' : 'var(--fg-on-primary)',
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5,
              cursor: isPending || confirmDisabled ? 'not-allowed' : 'pointer', opacity: isPending || confirmDisabled ? 0.55 : 1,
            }}
          >
            {isPending ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Fila / tarjeta de un vínculo ────────────────────────────────────── */
// `card` cuando la tabla no cabe. Los datos van a la izquierda y los botones a la derecha, y con
// flex-wrap los botones bajan solos en el teléfono: el mismo componente sirve para los dos anchos.
// `reviewLabel` es lo que se hizo («Confirmado», «Rechazado»…) y lo fija la sección, no el vínculo.
// En pendientes no se pasa: un familiar que vuelve a declarar a un paciente rechazado reabre el
// mismo vínculo sin registrar un veredicto, así que ahí decir «Devuelto por X» sería falso.
// Sin `actions` (rechazados: solo lectura) no se dibuja la columna.
function LinkRow({
  link, card, actions, showPatientResponse = false, reviewLabel, onHistory,
}: {
  link: FamilyLinkListItem
  card: boolean
  actions?: React.ReactNode
  showPatientResponse?: boolean
  reviewLabel?: string
  onHistory: (link: FamilyLinkListItem) => void
}) {
  const review = <ReviewLine link={link} label={reviewLabel} onHistory={onHistory} />
  if (card) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 20px', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, color: 'var(--fg1)' }}>{link.familyName}</div>
            <div style={{ fontSize: 12, color: 'var(--fg2)', overflowWrap: 'anywhere' }}>{link.familyEmail}</div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--fg2)' }}>
            Paciente: <strong style={{ color: 'var(--fg1)' }}>{link.patientName}</strong> · {fecha(link.createdAt)}
          </div>
          {link.verification && <VerificationChip verification={link.verification} />}
          {showPatientResponse && <PatientResponseChip link={link} />}
          {showPatientResponse && link.patientResponse === 'denied' && <DeniedHint />}
          {review}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flex: '1 1 auto', justifyContent: 'flex-end', maxWidth: 340 }}>{actions}</div>}
      </div>
    )
  }
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '14px 14px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--fg1)' }}>{link.familyName}</div>
        <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{link.familyEmail}</div>
      </td>
      <td style={{ padding: '14px 14px', fontSize: 13.5, color: 'var(--fg1)' }}>
        {link.patientName}
        {link.verification && <div style={{ marginTop: 6 }}><VerificationChip verification={link.verification} /></div>}
        {showPatientResponse && <div style={{ marginTop: 6 }}><PatientResponseChip link={link} /></div>}
        {showPatientResponse && link.patientResponse === 'denied' && <div style={{ marginTop: 4 }}><DeniedHint /></div>}
        {link.lastReviewedAt && <div style={{ marginTop: 6 }}>{review}</div>}
      </td>
      <td style={{ padding: '14px 14px', fontSize: 13, color: 'var(--fg2)' }}>{fecha(link.createdAt)}</td>
      {actions && (
        <td style={{ padding: '14px 14px' }}>
          <div style={{ display: 'flex', gap: 8 }}>{actions}</div>
        </td>
      )}
    </tr>
  )
}

// HDU 23 CA6 — quién decidió y cuándo, a la vista; el resto, en el historial. No se dibuja si el
// vínculo nunca fue revisado por un psicólogo.
function ReviewLine({
  link, label, onHistory,
}: { link: FamilyLinkListItem; label?: string; onHistory: (link: FamilyLinkListItem) => void }) {
  if (!link.lastReviewedAt) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 12px', fontSize: 12.5, color: 'var(--fg2)' }}>
      {label && (
        <span>
          {label} por <strong style={{ color: 'var(--fg1)', fontWeight: 600 }}>{link.lastReviewedByName ?? 'un usuario eliminado'}</strong> · {fechaHora(link.lastReviewedAt)}
        </span>
      )}
      <button
        onClick={() => onHistory(link)}
        aria-label={`Ver el historial de decisiones del vínculo de ${link.familyName}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-text)', fontSize: 12.5, fontWeight: 700, textDecoration: 'underline' }}
      >
        <WIcon name="clock" size={13} /> Historial
      </button>
    </div>
  )
}

function VerificationChip({ verification }: { verification: FamilyLinkVerification }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--sage-50)', color: 'var(--secondary-text)', borderRadius: 9999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
      <WIcon name={verification === 'in_person' ? 'users' : 'message-circle'} size={13} />
      {VERIFICATION_LABEL[verification]}
    </span>
  )
}

// HDU 23 CA4 — al familiar se le pregunta al paciente desde la app. Mientras no responde, el
// psicólogo solo puede confirmar verificándolo en persona; si dijo que no, solo rechazar.
function PatientResponseChip({ link }: { link: FamilyLinkListItem }) {
  const tone = link.patientResponse === 'accepted'
    ? { bg: 'var(--sage-50)', fg: 'var(--secondary-text)', icon: 'circle-check', text: 'El paciente confirmó en la app' }
    : link.patientResponse === 'denied'
      ? { bg: 'var(--amber-50)', fg: 'var(--primary-text)', icon: 'circle-alert', text: 'El paciente dijo que no' }
      : { bg: 'var(--surface-alt)', fg: 'var(--fg2)', icon: 'clock', text: 'Sin respuesta del paciente' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: tone.bg, color: tone.fg, borderRadius: 9999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
      <WIcon name={tone.icon} size={13} />
      {tone.text}
    </span>
  )
}

// Sin el botón "Confirmar" la fila podía leerse como un error: se dice por qué.
function DeniedHint() {
  return (
    <span style={{ fontSize: 12, color: 'var(--fg2)', lineHeight: 1.4 }}>
      Respondió desde la app que no es su familiar: solo puedes rechazar.
    </span>
  )
}

function VerificationChoice({
  value, onChange, patientResponse, respondedAt,
}: {
  value: FamilyLinkVerification | null
  onChange: (v: FamilyLinkVerification) => void
  patientResponse: FamilyLinkListItem['patientResponse']
  respondedAt: string | null
}) {
  const patientSaidYes = patientResponse === 'accepted'
  const options: { id: FamilyLinkVerification; title: string; hint: string; disabled: boolean }[] = [
    {
      id: 'patient_consulted',
      title: 'El paciente lo confirmó en la app',
      hint: patientSaidYes && respondedAt
        ? `Respondió que sí el ${fecha(respondedAt)}.`
        : 'Disponible cuando el paciente responda que sí desde su app.',
      disabled: !patientSaidYes,
    },
    { id: 'in_person', title: 'Lo verifiqué en persona', hint: 'Conozco al familiar o lo verifiqué presencialmente en la sede.', disabled: false },
  ]
  return (
    <fieldset style={{ border: 'none', margin: '18px 0 0', padding: 0 }}>
      <legend style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)', marginBottom: 10, padding: 0 }}>¿Cómo verificaste el vínculo?</legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map(o => {
          const selected = value === o.id
          return (
            <label
              key={o.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12,
                cursor: o.disabled ? 'not-allowed' : 'pointer', opacity: o.disabled ? 0.6 : 1,
                border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                background: selected ? 'color-mix(in srgb, var(--primary) 6%, var(--surface))' : 'var(--surface)',
              }}
            >
              <input
                type="radio"
                name="sb-verificacion-vinculo"
                checked={selected}
                disabled={o.disabled}
                onChange={() => onChange(o.id)}
                style={{ marginTop: 3, accentColor: 'var(--primary)' }}
              />
              <span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--fg1)' }}>{o.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--fg2)', marginTop: 2 }}>{o.hint}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/* ── Historial de decisiones (HDU 23 CA6) ────────────────────────────── */
// El rojo se reserva para pánico: rechazar o revocar es una decisión clínica normal, no una alerta.
const VERDICT_META: Record<FamilyLinkVerdict, { label: string; text: string; dot: string }> = {
  confirmed: { label: 'Confirmó el vínculo', text: 'var(--secondary-text)', dot: 'var(--secondary)' },
  rejected: { label: 'Rechazó la solicitud', text: 'var(--fg1)', dot: 'var(--fg2)' },
  revoked: { label: 'Revocó el acceso', text: 'var(--fg1)', dot: 'var(--fg2)' },
  reopened: { label: 'Devolvió a revisión', text: 'var(--primary-text)', dot: 'var(--primary)' },
}

function HistoryEntry({ item, last }: { item: FamilyLinkReviewItem; last: boolean }) {
  const meta = VERDICT_META[item.verdict]
  return (
    <li style={{ display: 'flex', gap: 14 }}>
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: meta.dot, marginTop: 4 }} />
        {!last && <span style={{ flex: 1, width: 2, background: 'var(--border)', marginTop: 4 }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 18, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, color: meta.text }}>{meta.label}</div>
        <div style={{ fontSize: 12.5, color: 'var(--fg2)', marginTop: 2 }}>
          {item.reviewedByName ?? 'Un usuario eliminado'} · {fechaHora(item.reviewedAt)}
        </div>
        {item.verification && <div style={{ marginTop: 6 }}><VerificationChip verification={item.verification} /></div>}
      </div>
    </li>
  )
}

function HistoryModal({ link, onClose }: { link: FamilyLinkListItem; onClose: () => void }) {
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: historyKey(link.id),
    queryFn: () => api.getFamilyLinkHistory(link.id),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', animation: 'sb-scrim-in 0.18s ease' }} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="sb-historial-vinculo" tabIndex={-1} style={{ position: 'relative', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-strong)', width: 480, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'sb-modal-in 0.28s var(--ease-calm)', zIndex: 1 }}>
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2 id="sb-historial-vinculo" style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 21, color: 'var(--fg1)' }}>Historial del vínculo</h2>
              <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--fg2)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                <strong style={{ color: 'var(--fg1)' }}>{link.familyName}</strong> y su paciente declarado, <strong style={{ color: 'var(--fg1)' }}>{link.patientName}</strong>.
              </p>
            </div>
            <button onClick={onClose} aria-label="Cerrar" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WIcon name="x" size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 28px 0', overflowY: 'auto', minHeight: 0 }}>
          {isLoading ? (
            <div style={{ color: 'var(--fg2)', fontSize: 13.5 }}>Cargando…</div>
          ) : isError ? (
            <div role="alert" style={{ fontSize: 13, color: 'var(--danger-text)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
              No pudimos cargar el historial.{' '}
              <button onClick={() => refetch()} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary-text)', fontWeight: 700, textDecoration: 'underline', fontSize: 13 }}>Reintentar</button>
            </div>
          ) : !data || data.length === 0 ? (
            <div style={{ color: 'var(--fg2)', fontSize: 13.5 }}>Este vínculo todavía no tiene decisiones registradas.</div>
          ) : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {data.map((item, i) => <HistoryEntry key={item.id} item={item} last={i === data.length - 1} />)}
            </ol>
          )}
        </div>

        <div style={{ padding: '18px 28px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--fg2)', flex: '1 1 180px' }}>Este historial no se puede editar ni borrar.</span>
          <button onClick={onClose} style={{ height: 46, padding: '0 22px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

const pillBtn = (tone: 'primary' | 'danger'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: 36, padding: '0 16px', borderRadius: 9999, cursor: 'pointer', fontSize: 13, fontWeight: 700,
  whiteSpace: 'nowrap',
  border: tone === 'danger' ? '1.5px solid var(--danger)' : 'none',
  background: tone === 'danger' ? 'var(--surface)' : 'var(--primary)',
  color: tone === 'danger' ? 'var(--danger-text)' : 'var(--fg-on-primary)',
})

export function FamiliaresPage() {
  const isNarrow = useIsNarrow()
  // Bajo este ancho las cuatro columnas no caben (y con la tipografía de AJUTER, más ancha,
  // "Rechazar" quedaba cortado): se pasa a tarjetas en vez de apretar o desplazar la tabla.
  const cards = useMediaQuery('(max-width: 1180px)')
  const stretch: React.CSSProperties = isNarrow ? { flex: 1 } : {}
  const qc = useQueryClient()

  const { data: pending = [], isLoading: loadingPending } = useQuery({ queryKey: PENDING_KEY, queryFn: api.getPendingFamilyLinks })
  const { data: active = [], isLoading: loadingActive } = useQuery({ queryKey: ACTIVE_KEY, queryFn: api.getActiveFamilyLinks })
  const { data: revoked = [] } = useQuery({ queryKey: REVOKED_KEY, queryFn: api.getRevokedFamilyLinks })
  const { data: rejected = [] } = useQuery({ queryKey: REJECTED_KEY, queryFn: api.getRejectedFamilyLinks })

  const [historyTarget, setHistoryTarget] = useState<FamilyLinkListItem | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<FamilyLinkListItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<FamilyLinkListItem | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<FamilyLinkListItem | null>(null)
  const [reopenTarget, setReopenTarget] = useState<FamilyLinkListItem | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [verification, setVerification] = useState<FamilyLinkVerification | null>(null)

  // Si el paciente ya dijo que sí en la app, esa es la verificación más fuerte: viene marcada.
  const openConfirm = (l: FamilyLinkListItem) => {
    setVerification(l.patientResponse === 'accepted' ? 'patient_consulted' : null)
    setConfirmTarget(l)
  }

  // Por el prefijo: refresca las cuatro listas y también cualquier historial ya cargado.
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: LINKS_KEY })
  }

  const confirmMutation = useMutation({
    mutationFn: ({ id, verification }: { id: string; verification: FamilyLinkVerification }) =>
      api.confirmFamilyLink(id, verification),
    onSuccess: () => { invalidateAll(); setConfirmTarget(null); setModalError(null); setVerification(null) },
    onError: (err) => setModalError(errorMessage(err, 'No pudimos confirmar el vínculo.')),
  })
  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.rejectFamilyLink(id),
    onSuccess: () => { invalidateAll(); setRejectTarget(null); setModalError(null) },
    onError: (err) => setModalError(errorMessage(err, 'No pudimos rechazar el vínculo.')),
  })
  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeFamilyLink(id),
    onSuccess: () => { invalidateAll(); setRevokeTarget(null); setModalError(null) },
    onError: (err) => setModalError(errorMessage(err, 'No pudimos revocar el vínculo.')),
  })
  const reopenMutation = useMutation({
    mutationFn: (id: string) => api.reopenFamilyLink(id),
    onSuccess: () => { invalidateAll(); setReopenTarget(null); setModalError(null) },
    onError: (err) => setModalError(errorMessage(err, 'No pudimos devolver el vínculo a revisión.')),
  })

  const Head = ({ label }: { label: string }) => (
    <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 14px 12px' }}>{label}</th>
  )

  return (
    <div style={{ padding: isNarrow ? '16px 12px 28px' : 32, maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Intro banner */}
      <div style={{ background: 'var(--amber-50)', border: '1px solid var(--accent)', borderRadius: 16, padding: '18px 22px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <WIcon name="heart-handshake" size={22} color="var(--primary-text)" />
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15.5, color: 'var(--fg1)', marginBottom: 3 }}>
            Tienes {pending.length} familiar{pending.length !== 1 ? 'es' : ''} pendiente{pending.length !== 1 ? 's' : ''} de vinculación
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>
            Confirma el vínculo si el paciente declarado corresponde, o recházalo si se equivocó de paciente.
          </div>
        </div>
      </div>

      {/* Pendientes */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Familiares pendientes</h2>
          <span style={{ background: 'var(--amber-50)', color: 'var(--primary-text)', borderRadius: 9999, padding: '4px 14px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loadingPending ? (
          <div style={{ padding: '32px 24px', color: 'var(--fg2)', fontSize: 13.5 }}>Cargando…</div>
        ) : pending.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg2)' }}>
            <WIcon name="circle-check" size={40} color="var(--secondary-text)" />
            <div style={{ marginTop: 12, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Sin familiares pendientes</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>Todas las solicitudes fueron revisadas.</div>
          </div>
        ) : cards ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pending.map((l) => (
              <LinkRow key={l.id} link={l} onHistory={setHistoryTarget} card showPatientResponse actions={<>
                {l.patientResponse !== 'denied' && <button onClick={() => openConfirm(l)} style={{ ...pillBtn('primary'), ...stretch }}><WIcon name="circle-check" size={14} color="var(--fg-on-primary)" /> Confirmar</button>}
                <button onClick={() => setRejectTarget(l)} style={{ ...pillBtn('danger'), ...stretch }}><WIcon name="x" size={14} /> Rechazar</button>
              </>} />
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', maxWidth: 1000, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col /><col style={{ width: 250 }} /><col style={{ width: 110 }} /><col style={{ width: 260 }} /></colgroup>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}><Head label="Familiar" /><Head label="Paciente declarado" /><Head label="Fecha" /><Head label="Acciones" /></tr></thead>
            <tbody>
              {pending.map((l) => (
                <LinkRow key={l.id} link={l} onHistory={setHistoryTarget} card={false} showPatientResponse actions={<>
                  {l.patientResponse !== 'denied' && <button onClick={() => openConfirm(l)} style={pillBtn('primary')}><WIcon name="circle-check" size={14} color="var(--fg-on-primary)" /> Confirmar</button>}
                  <button onClick={() => setRejectTarget(l)} style={pillBtn('danger')}><WIcon name="x" size={14} /> Rechazar</button>
                </>} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Vinculados */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Familiares vinculados</h2>
        </div>

        {loadingActive ? (
          <div style={{ padding: '32px 24px', color: 'var(--fg2)', fontSize: 13.5 }}>Cargando…</div>
        ) : active.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--fg2)', fontSize: 13.5 }}>
            Todavía no hay familiares vinculados en tu sede.
          </div>
        ) : cards ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {active.map((l) => (
              <LinkRow key={l.id} link={l} reviewLabel="Confirmado" onHistory={setHistoryTarget} card actions={
                <button onClick={() => setRevokeTarget(l)} style={{ ...pillBtn('danger'), ...stretch }}><WIcon name="x" size={14} /> Revocar</button>
              } />
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', maxWidth: 780, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col /><col style={{ width: 250 }} /><col style={{ width: 120 }} /><col style={{ width: 140 }} /></colgroup>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}><Head label="Familiar" /><Head label="Paciente" /><Head label="Fecha" /><Head label="Acciones" /></tr></thead>
            <tbody>
              {active.map((l) => (
                <LinkRow key={l.id} link={l} reviewLabel="Confirmado" onHistory={setHistoryTarget} card={false} actions={
                  <button onClick={() => setRevokeTarget(l)} style={pillBtn('danger')}><WIcon name="x" size={14} /> Revocar</button>
                } />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Revocados: solo aparece si hay alguno. Sin ella, un vínculo revocado por error no tenía
          vuelta atrás desde el panel. */}
      {revoked.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: '20px 24px 16px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Familiares revocados</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg2)' }}>
              Si alguno se revocó por error, devuélvelo a revisión: vuelve a Pendientes y se le pregunta de nuevo al paciente.
            </p>
          </div>
          {cards ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {revoked.map((l) => (
                <LinkRow key={l.id} link={l} reviewLabel="Revocado" onHistory={setHistoryTarget} card actions={
                  <button onClick={() => setReopenTarget(l)} style={{ ...pillBtn('primary'), ...stretch }}><WIcon name="clock" size={14} color="var(--fg-on-primary)" /> Volver a revisar</button>
                } />
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', maxWidth: 820, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup><col /><col style={{ width: 250 }} /><col style={{ width: 120 }} /><col style={{ width: 180 }} /></colgroup>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}><Head label="Familiar" /><Head label="Paciente" /><Head label="Fecha" /><Head label="Acciones" /></tr></thead>
              <tbody>
                {revoked.map((l) => (
                  <LinkRow key={l.id} link={l} reviewLabel="Revocado" onHistory={setHistoryTarget} card={false} actions={
                    <button onClick={() => setReopenTarget(l)} style={pillBtn('primary')}><WIcon name="clock" size={14} color="var(--fg-on-primary)" /> Volver a revisar</button>
                  } />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Rechazados (HDU 23 CA6): solo lectura. Sin esta lista el veredicto «rechazado» no se veía en
          ninguna parte del panel. Si el familiar vuelve a declarar al paciente desde su portal, la
          solicitud reaparece en Pendientes. */}
      {rejected.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: '20px 24px 16px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Familiares rechazados</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg2)' }}>
              Si el familiar vuelve a declarar al paciente desde su portal, la solicitud vuelve a Pendientes.
            </p>
          </div>
          {cards ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {rejected.map((l) => (
                <LinkRow key={l.id} link={l} reviewLabel="Rechazado" onHistory={setHistoryTarget} card />
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', maxWidth: 640, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup><col /><col style={{ width: 250 }} /><col style={{ width: 120 }} /></colgroup>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}><Head label="Familiar" /><Head label="Paciente declarado" /><Head label="Solicitud" /></tr></thead>
              <tbody>
                {rejected.map((l) => (
                  <LinkRow key={l.id} link={l} reviewLabel="Rechazado" onHistory={setHistoryTarget} card={false} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {historyTarget && <HistoryModal link={historyTarget} onClose={() => setHistoryTarget(null)} />}

      {confirmTarget && (
        <ActionModal
          titleId="sb-confirmar-vinculo"
          title="Confirmar vínculo"
          description={<>
            Vas a confirmar que <strong>{confirmTarget.familyName}</strong> es familiar de <strong>{confirmTarget.patientName}</strong>. Se le habilitará el acceso a las sesiones grupales y se notificará a ambos.
            <VerificationChoice
              value={verification}
              onChange={setVerification}
              patientResponse={confirmTarget.patientResponse}
              respondedAt={confirmTarget.patientRespondedAt}
            />
          </>}
          confirmLabel="Confirmar vínculo"
          confirmDisabled={!verification}
          isPending={confirmMutation.isPending}
          error={modalError}
          onClose={() => { setConfirmTarget(null); setModalError(null); setVerification(null) }}
          onConfirm={() => { if (verification) confirmMutation.mutate({ id: confirmTarget.id, verification }) }}
        />
      )}

      {rejectTarget && (
        <ActionModal
          titleId="sb-rechazar-vinculo"
          title="Rechazar vínculo"
          description={<>El familiar <strong>{rejectTarget.familyName}</strong> no fue confirmado como vínculo de <strong>{rejectTarget.patientName}</strong>. Se le notificará que su solicitud no fue aprobada.</>}
          confirmLabel="Rechazar vínculo"
          confirmTone="danger"
          isPending={rejectMutation.isPending}
          error={modalError}
          onClose={() => { setRejectTarget(null); setModalError(null) }}
          onConfirm={() => rejectMutation.mutate(rejectTarget.id)}
        />
      )}

      {revokeTarget && (
        <ActionModal
          titleId="sb-revocar-vinculo"
          title="Revocar vínculo"
          description={<>Vas a retirarle a <strong>{revokeTarget.familyName}</strong> el acceso a las sesiones grupales de <strong>{revokeTarget.patientName}</strong> de inmediato. Se notificará a ambos.</>}
          confirmLabel="Revocar vínculo"
          confirmTone="danger"
          isPending={revokeMutation.isPending}
          error={modalError}
          onClose={() => { setRevokeTarget(null); setModalError(null) }}
          onConfirm={() => revokeMutation.mutate(revokeTarget.id)}
        />
      )}

      {reopenTarget && (
        <ActionModal
          titleId="sb-reabrir-vinculo"
          title="Volver a revisar el vínculo"
          description={<>La solicitud de <strong>{reopenTarget.familyName}</strong> vuelve a <strong>Familiares pendientes</strong> y a <strong>{reopenTarget.patientName}</strong> se le pregunta de nuevo en la app. El acceso no se restaura todavía: lo confirmas como cualquier otra solicitud.</>}
          confirmLabel="Volver a revisar"
          isPending={reopenMutation.isPending}
          error={modalError}
          onClose={() => { setReopenTarget(null); setModalError(null) }}
          onConfirm={() => reopenMutation.mutate(reopenTarget.id)}
        />
      )}
    </div>
  )
}
