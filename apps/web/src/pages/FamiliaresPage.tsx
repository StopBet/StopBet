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

/* ── Pestañas y filas ─────────────────────────────────────────────────── */
type Tab = 'pending' | 'active' | 'revoked' | 'rejected'

// Qué se hizo con el vínculo en cada pestaña. En «pendientes» no hay verbo: un familiar que vuelve a
// declarar a un paciente rechazado reabre el mismo vínculo sin registrar un veredicto, así que ahí
// decir «Devuelto por X» sería falso.
const TABS: { id: Tab; label: string; verbo?: string; ayuda: string; vacio: { icono: string; titulo: string; texto: string } }[] = [
  {
    id: 'pending', label: 'Pendientes',
    ayuda: 'Confirma el vínculo si el paciente declarado corresponde, o recházalo si se equivocó de paciente.',
    vacio: { icono: 'circle-check', titulo: 'Sin familiares pendientes', texto: 'Todas las solicitudes fueron revisadas.' },
  },
  {
    id: 'active', label: 'Vinculados', verbo: 'Confirmado',
    ayuda: 'Tienen acceso a las sesiones grupales y a los pagos de su paciente. Si alguno ya no debe tenerlo, revócalo.',
    vacio: { icono: 'users', titulo: 'Todavía no hay familiares vinculados', texto: 'Cuando confirmes un vínculo, aparecerá aquí.' },
  },
  {
    id: 'revoked', label: 'Revocados', verbo: 'Revocado',
    ayuda: 'Si alguno se revocó por error, devuélvelo a revisión: vuelve a Pendientes y se le pregunta de nuevo al paciente.',
    vacio: { icono: 'inbox', titulo: 'Ningún vínculo revocado', texto: 'Los accesos que retires aparecerán aquí.' },
  },
  {
    id: 'rejected', label: 'Rechazados', verbo: 'Rechazado',
    ayuda: 'Si el familiar vuelve a declarar al paciente desde su portal, la solicitud vuelve a Pendientes.',
    vacio: { icono: 'inbox', titulo: 'Ninguna solicitud rechazada', texto: 'Las solicitudes que rechaces aparecerán aquí.' },
  },
]

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

function Avatar({ nombre }: { nombre: string }) {
  return (
    <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'var(--surface-alt)', color: 'var(--primary-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5 }}>
      {iniciales(nombre)}
    </span>
  )
}

const celda: React.CSSProperties = { padding: '16px 20px', verticalAlign: 'middle' }

const boton = (tono: 'primary' | 'neutral'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  height: 34, padding: '0 14px', borderRadius: 9999, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
  border: tono === 'neutral' ? '1.5px solid var(--border)' : '1.5px solid transparent',
  background: tono === 'neutral' ? 'var(--surface)' : 'var(--primary)',
  color: tono === 'neutral' ? 'var(--fg1)' : 'var(--fg-on-primary)',
})

function Familiar({ link }: { link: FamilyLinkListItem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <Avatar nombre={link.familyName} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, color: 'var(--fg1)', overflowWrap: 'anywhere' }}>{link.familyName}</div>
        <div style={{ fontSize: 12.5, color: 'var(--fg2)', overflowWrap: 'anywhere' }}>{link.familyEmail}</div>
      </div>
    </div>
  )
}

function Paciente({ link, enPendientes }: { link: FamilyLinkListItem; enPendientes: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', minWidth: 0 }}>
      <span style={{ fontSize: 14, color: 'var(--fg1)', fontWeight: 500, overflowWrap: 'anywhere' }}>{link.patientName}</span>
      {link.verification && <VerificationChip verification={link.verification} />}
      {enPendientes && <PatientResponseChip link={link} />}
      {enPendientes && link.patientResponse === 'denied' && <DeniedHint />}
    </div>
  )
}

// HDU 23 CA6 — quién decidió y cuándo, a la vista; el resto, en el historial.
function Decision({
  link, verbo, onHistory,
}: { link: FamilyLinkListItem; verbo?: string; onHistory: (link: FamilyLinkListItem) => void }) {
  if (!link.lastReviewedAt) {
    return (
      <span
        title={verbo ? 'Este vínculo no pasó por una revisión registrada (por ejemplo, datos de ejemplo del seed).' : undefined}
        style={{ fontSize: 13, color: 'var(--fg2)' }}
      >
        {verbo ? 'Sin decisión registrada' : '—'}
      </span>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start', minWidth: 0 }}>
      {verbo ? (
        <>
          <span style={{ fontSize: 13.5, color: 'var(--fg1)' }}>
            {verbo} por <strong style={{ fontWeight: 600 }}>{link.lastReviewedByName ?? 'un usuario eliminado'}</strong>
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--fg2)', fontVariantNumeric: 'tabular-nums' }}>{fechaHora(link.lastReviewedAt)}</span>
        </>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--fg2)' }}>Revisado antes</span>
      )}
      <button
        onClick={() => onHistory(link)}
        aria-label={`Ver el historial de decisiones del vínculo de ${link.familyName}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0, marginTop: 2, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-text)', fontSize: 12.5, fontWeight: 700 }}
      >
        <WIcon name="clock" size={13} /> Ver historial
      </button>
    </div>
  )
}

function Etiqueta({ texto, children }: { texto: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--fg2)' }}>{texto}</span>
      {children}
    </div>
  )
}

/* ── Vista de tabla (pantallas anchas) ───────────────────────────────── */
function Tabla({
  links, tab, acciones, onHistory,
}: {
  links: FamilyLinkListItem[]
  tab: (typeof TABS)[number]
  acciones: (l: FamilyLinkListItem) => React.ReactNode
  onHistory: (link: FamilyLinkListItem) => void
}) {
  const conAcciones = tab.id !== 'rejected'
  const cabecera = (texto: string, alinear: 'left' | 'right' = 'left') => (
    <th scope="col" style={{ ...celda, padding: '12px 20px', textAlign: alinear, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--fg2)', background: 'var(--surface-alt)' }}>{texto}</th>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '25%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: 118 }} />
          <col />
          {conAcciones && <col style={{ width: tab.id === 'pending' ? 290 : tab.id === 'revoked' ? 200 : 160 }} />}
        </colgroup>
        <thead>
          <tr>
            {cabecera('Familiar')}
            {cabecera('Paciente declarado')}
            {cabecera('Solicitud')}
            {cabecera('Última decisión')}
            {conAcciones && cabecera('Acciones', 'right')}
          </tr>
        </thead>
        <tbody>
          {links.map((l, i) => (
            <tr key={l.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <td style={celda}><Familiar link={l} /></td>
              <td style={celda}><Paciente link={l} enPendientes={tab.id === 'pending'} /></td>
              <td style={{ ...celda, fontSize: 13.5, color: 'var(--fg2)', fontVariantNumeric: 'tabular-nums' }}>{fecha(l.createdAt)}</td>
              <td style={celda}><Decision link={l} verbo={tab.verbo} onHistory={onHistory} /></td>
              {conAcciones && (
                <td style={{ ...celda, textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 8, justifyContent: 'flex-end' }}>{acciones(l)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Vista de tarjetas (cuando la tabla no cabe) ──────────────────────── */
function Tarjetas({
  links, tab, acciones, onHistory,
}: {
  links: FamilyLinkListItem[]
  tab: (typeof TABS)[number]
  acciones: (l: FamilyLinkListItem) => React.ReactNode
  onHistory: (link: FamilyLinkListItem) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {links.map((l, i) => (
        <article key={l.id} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
          <Familiar link={l} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px 20px' }}>
            <Etiqueta texto="Paciente declarado"><Paciente link={l} enPendientes={tab.id === 'pending'} /></Etiqueta>
            <Etiqueta texto="Solicitud"><span style={{ fontSize: 14, color: 'var(--fg1)', fontVariantNumeric: 'tabular-nums' }}>{fecha(l.createdAt)}</span></Etiqueta>
            <Etiqueta texto="Última decisión"><Decision link={l} verbo={tab.verbo} onHistory={onHistory} /></Etiqueta>
          </div>
          {tab.id !== 'rejected' && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{acciones(l)}</div>}
        </article>
      ))}
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

export function FamiliaresPage() {
  const isNarrow = useIsNarrow()
  // Con cinco columnas la tabla necesita más ancho que antes: bajo este punto se pasa a tarjetas en
  // vez de apretar o desplazar la tabla (con la tipografía de AJUTER, más ancha, los botones se cortaban).
  const cards = useMediaQuery('(max-width: 1320px)')
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

  // La pestaña se elige sola mientras nadie toque nada: Pendientes si hay algo que revisar y, si no,
  // Vinculados. Cuando el psicólogo elige una, se respeta.
  const [elegida, setElegida] = useState<Tab | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const cargando = loadingPending || loadingActive
  const porTab: Record<Tab, FamilyLinkListItem[]> = { pending, active, revoked, rejected }
  const tabId: Tab = elegida ?? (pending.length > 0 || cargando ? 'pending' : 'active')
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0]

  const consulta = normalizar(busqueda.trim())
  const visibles = consulta
    ? porTab[tabId].filter((l) => normalizar(`${l.familyName} ${l.familyEmail} ${l.patientName}`).includes(consulta))
    : porTab[tabId]

  const acciones = (l: FamilyLinkListItem): React.ReactNode => {
    switch (tabId) {
      case 'pending':
        return (
          <>
            {l.patientResponse !== 'denied' && (
              <button onClick={() => openConfirm(l)} style={boton('primary')}><WIcon name="circle-check" size={14} color="var(--fg-on-primary)" /> Confirmar</button>
            )}
            <button onClick={() => setRejectTarget(l)} style={boton('neutral')}><WIcon name="x" size={14} /> Rechazar</button>
          </>
        )
      case 'active':
        return <button onClick={() => setRevokeTarget(l)} style={boton('neutral')}><WIcon name="x" size={14} /> Revocar</button>
      case 'revoked':
        return <button onClick={() => setReopenTarget(l)} style={boton('primary')}><WIcon name="clock" size={14} color="var(--fg-on-primary)" /> Volver a revisar</button>
      default:
        return null
    }
  }

  return (
    <div style={{ padding: isNarrow ? '16px 12px 28px' : 32, maxWidth: 1280, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <section style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
        {/* Pestañas con conteo y buscador */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px 20px', padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
          <div role="tablist" aria-label="Estado de los vínculos" style={{ display: 'flex', gap: 24, overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%', scrollbarWidth: 'none' }}>
            {TABS.map((t) => {
              const seleccionada = t.id === tabId
              const n = porTab[t.id].length
              const urgente = t.id === 'pending' && n > 0
              return (
                <button
                  key={t.id}
                  role="tab"
                  id={`sb-fam-tab-${t.id}`}
                  aria-selected={seleccionada}
                  aria-controls="sb-fam-panel"
                  onClick={() => { setElegida(t.id); setBusqueda('') }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '18px 2px 14px', background: 'none', cursor: 'pointer',
                    border: 'none', borderBottom: `2.5px solid ${seleccionada ? 'var(--primary)' : 'transparent'}`,
                    fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap',
                    color: seleccionada ? 'var(--primary-text)' : 'var(--fg2)',
                  }}
                >
                  {t.label}
                  <span style={{
                    minWidth: 24, height: 22, padding: '0 8px', borderRadius: 9999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    background: seleccionada || urgente ? 'var(--amber-50)' : 'var(--surface-alt)',
                    color: seleccionada || urgente ? 'var(--primary-text)' : 'var(--fg2)',
                  }}>{n}</span>
                </button>
              )
            })}
          </div>

          <label style={{ position: 'relative', display: 'block', width: isNarrow ? '100%' : 260, margin: '10px 0' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: 'var(--fg2)', pointerEvents: 'none' }}>
              <WIcon name="search" size={16} />
            </span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar familiar o paciente"
              aria-label="Buscar familiar o paciente"
              style={{ width: '100%', height: 38, boxSizing: 'border-box', padding: '0 14px 0 36px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg1)', fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none' }}
            />
          </label>
        </div>

        <p style={{ margin: 0, padding: '14px 20px', fontSize: 13.5, color: 'var(--fg2)', lineHeight: 1.5, borderBottom: '1px solid var(--border)' }}>
          {tab.ayuda}
        </p>

        <div role="tabpanel" id="sb-fam-panel" aria-labelledby={`sb-fam-tab-${tabId}`}>
          {cargando && porTab[tabId].length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg2)', fontSize: 14 }}>Cargando…</div>
          ) : porTab[tabId].length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--fg2)' }}>
              <WIcon name={tab.vacio.icono} size={40} color="var(--secondary-text)" />
              <div style={{ marginTop: 12, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>{tab.vacio.titulo}</div>
              <div style={{ marginTop: 4, fontSize: 13.5 }}>{tab.vacio.texto}</div>
            </div>
          ) : visibles.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg2)', fontSize: 14 }}>
              Ningún resultado para «{busqueda.trim()}» en {tab.label.toLowerCase()}.
            </div>
          ) : cards ? (
            <Tarjetas links={visibles} tab={tab} acciones={acciones} onHistory={setHistoryTarget} />
          ) : (
            <Tabla links={visibles} tab={tab} acciones={acciones} onHistory={setHistoryTarget} />
          )}
        </div>
      </section>

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
