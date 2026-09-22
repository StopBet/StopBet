import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import { api, type ApiError, type FamilyLinkListItem } from '../services/api'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { useDialog } from '../hooks/useDialog'

const PENDING_KEY = ['family', 'links', 'pending']
const ACTIVE_KEY = ['family', 'links', 'active']

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function errorMessage(err: unknown, fallback: string): string {
  const apiErr = err as ApiError
  return (apiErr?.body?.message as string | undefined) ?? fallback
}

/* ── Modal genérico de confirmación ─────────────────────────────────── */
function ActionModal({
  titleId, title, description, confirmLabel, confirmTone = 'primary', isPending, error, onClose, onConfirm,
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
            disabled={isPending}
            style={{
              height: 46, padding: '0 26px', borderRadius: 9999, border: confirmTone === 'danger' ? '1.5px solid var(--danger)' : 'none',
              background: confirmTone === 'danger' ? 'var(--surface)' : 'var(--primary)',
              color: confirmTone === 'danger' ? 'var(--danger-text)' : 'var(--fg-on-primary)',
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5,
              cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1,
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
function LinkRow({
  link, isNarrow, actions,
}: { link: FamilyLinkListItem; isNarrow: boolean; actions: React.ReactNode }) {
  if (isNarrow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, color: 'var(--fg1)' }}>{link.familyName}</div>
          <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{link.familyEmail}</div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--fg2)' }}>
          Paciente: <strong style={{ color: 'var(--fg1)' }}>{link.patientName}</strong> · {fecha(link.createdAt)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{actions}</div>
      </div>
    )
  }
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '14px 14px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--fg1)' }}>{link.familyName}</div>
        <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{link.familyEmail}</div>
      </td>
      <td style={{ padding: '14px 14px', fontSize: 13.5, color: 'var(--fg1)' }}>{link.patientName}</td>
      <td style={{ padding: '14px 14px', fontSize: 13, color: 'var(--fg2)' }}>{fecha(link.createdAt)}</td>
      <td style={{ padding: '14px 14px' }}>
        <div style={{ display: 'flex', gap: 8 }}>{actions}</div>
      </td>
    </tr>
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
  const qc = useQueryClient()

  const { data: pending = [], isLoading: loadingPending } = useQuery({ queryKey: PENDING_KEY, queryFn: api.getPendingFamilyLinks })
  const { data: active = [], isLoading: loadingActive } = useQuery({ queryKey: ACTIVE_KEY, queryFn: api.getActiveFamilyLinks })

  const [confirmTarget, setConfirmTarget] = useState<FamilyLinkListItem | null>(null)
  const [rejectTarget, setRejectTarget] = useState<FamilyLinkListItem | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<FamilyLinkListItem | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: PENDING_KEY })
    qc.invalidateQueries({ queryKey: ACTIVE_KEY })
  }

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.confirmFamilyLink(id),
    onSuccess: () => { invalidateAll(); setConfirmTarget(null); setModalError(null) },
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
          <span style={{ background: 'var(--amber-50)', color: 'var(--primary-text)', borderRadius: 9999, padding: '4px 14px', fontSize: 13, fontWeight: 700 }}>
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
        ) : isNarrow ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pending.map((l) => (
              <LinkRow key={l.id} link={l} isNarrow actions={<>
                <button onClick={() => setConfirmTarget(l)} style={{ ...pillBtn('primary'), flex: 1 }}><WIcon name="circle-check" size={14} color="var(--fg-on-primary)" /> Confirmar</button>
                <button onClick={() => setRejectTarget(l)} style={{ ...pillBtn('danger'), flex: 1 }}><WIcon name="x" size={14} /> Rechazar</button>
              </>} />
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', maxWidth: 880, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col /><col style={{ width: 200 }} /><col style={{ width: 120 }} /><col style={{ width: 220 }} /></colgroup>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}><Head label="Familiar" /><Head label="Paciente declarado" /><Head label="Fecha" /><Head label="Acciones" /></tr></thead>
            <tbody>
              {pending.map((l) => (
                <LinkRow key={l.id} link={l} isNarrow={false} actions={<>
                  <button onClick={() => setConfirmTarget(l)} style={pillBtn('primary')}><WIcon name="circle-check" size={14} color="var(--fg-on-primary)" /> Confirmar</button>
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
        ) : isNarrow ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {active.map((l) => (
              <LinkRow key={l.id} link={l} isNarrow actions={
                <button onClick={() => setRevokeTarget(l)} style={{ ...pillBtn('danger'), flex: 1 }}><WIcon name="x" size={14} /> Revocar</button>
              } />
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', maxWidth: 720, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col /><col style={{ width: 200 }} /><col style={{ width: 120 }} /><col style={{ width: 140 }} /></colgroup>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}><Head label="Familiar" /><Head label="Paciente" /><Head label="Fecha" /><Head label="Acciones" /></tr></thead>
            <tbody>
              {active.map((l) => (
                <LinkRow key={l.id} link={l} isNarrow={false} actions={
                  <button onClick={() => setRevokeTarget(l)} style={pillBtn('danger')}><WIcon name="x" size={14} /> Revocar</button>
                } />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmTarget && (
        <ActionModal
          titleId="sb-confirmar-vinculo"
          title="Confirmar vínculo"
          description={<>Vas a confirmar que <strong>{confirmTarget.familyName}</strong> es familiar de <strong>{confirmTarget.patientName}</strong>. Se le habilitará el acceso a las sesiones grupales y se notificará a ambos.</>}
          confirmLabel="Confirmar vínculo"
          isPending={confirmMutation.isPending}
          error={modalError}
          onClose={() => { setConfirmTarget(null); setModalError(null) }}
          onConfirm={() => confirmMutation.mutate(confirmTarget.id)}
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
    </div>
  )
}
