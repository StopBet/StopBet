import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import { PSICOLOGOS, PADRINOS, REJECT_REASONS, type RegistrationRequest } from '../data/mockData'
import { api } from '../services/api'
import type { FlaggedPost } from '../services/api'

/* ── Approve Modal ───────────────────────────────────── */
function ApproveModal({ req, onClose, onConfirm }: { req: RegistrationRequest; onClose: () => void; onConfirm: () => void }) {
  const [psico, setPsico]     = useState(PSICOLOGOS[0])
  const [padrino, setPadrino] = useState('')
  const [startDate, setStartDate] = useState('2026-06-10')
  const [notes, setNotes]     = useState('')

  const padrinos = PADRINOS[req.sede] ?? PADRINOS['Santiago']

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,45,44,0.32)', animation: 'sb-scrim-in 0.18s ease' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-strong)', width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', animation: 'sb-modal-in 0.28s cubic-bezier(0.34,1.56,0.64,1)', zIndex: 1 }}>
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 21, color: 'var(--fg1)' }}>Aprobar solicitud</h2>
              <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--fg2)' }}>Asigna los recursos clínicos para <strong>{req.name}</strong>.</p>
            </div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WIcon name="x" size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--teal-50)', borderRadius: 12, padding: '13px 16px', marginBottom: 22 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{req.initials}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15.5, color: 'var(--fg1)' }}>{req.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg2)', display: 'flex', gap: 12 }}>
                <span>{req.email}</span>
                <span>Sede: {req.sede}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Psicólogo asignado', value: psico, set: setPsico, opts: PSICOLOGOS },
              { label: 'Padrino de seguimiento', value: padrino, set: setPadrino, opts: padrinos },
            ].map(({ label, value, set, opts }) => (
              <div key={label}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 6 }}>{label}</label>
                <div style={{ position: 'relative' }}>
                  <select value={value} onChange={e => set(e.target.value)}
                    style={{ appearance: 'none', height: 42, width: '100%', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', padding: '0 36px 0 12px', fontSize: 13.5, color: 'var(--fg1)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--fg2)' }}>
                    <WIcon name="chevron-down" size={15} />
                  </span>
                </div>
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 6 }}>Fecha de inicio</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ height: 42, width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', padding: '0 12px', fontSize: 13.5, color: 'var(--fg1)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 6 }}>Notas clínicas <span style={{ color: 'var(--fg2)', fontWeight: 400 }}>(opcional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Observaciones iniciales del psicólogo…"
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', padding: '10px 12px', fontSize: 13.5, color: 'var(--fg1)', outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 28px 28px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 46, padding: '0 22px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={onConfirm} style={{ height: 46, padding: '0 26px', borderRadius: 9999, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <WIcon name="circle-check" size={17} color="#fff" /> Confirmar aprobación
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Reject Modal ────────────────────────────────────── */
function RejectModal({ req, onClose, onConfirm }: { req: RegistrationRequest; onClose: () => void; onConfirm: () => void }) {
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,45,44,0.32)', animation: 'sb-scrim-in 0.18s ease' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-strong)', width: 480, maxWidth: '95vw', animation: 'sb-modal-in 0.28s cubic-bezier(0.34,1.56,0.64,1)', zIndex: 1 }}>
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 21, color: 'var(--danger)' }}>Rechazar solicitud</h2>
              <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--fg2)' }}>Indica el motivo del rechazo para <strong>{req.name}</strong>.</p>
            </div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WIcon name="x" size={16} />
            </button>
          </div>

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 10 }}>Motivo del rechazo</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {REJECT_REASONS.map(r => (
              <button key={r} onClick={() => setReason(r)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: reason === r ? 'var(--red-50)' : 'var(--bg)', border: `1.5px solid ${reason === r ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 10, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${reason === r ? 'var(--danger)' : 'var(--border)'}`, background: reason === r ? 'var(--danger)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {reason === r && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'block' }} />}
                </span>
                <span style={{ fontSize: 13.5, color: 'var(--fg1)', fontWeight: reason === r ? 600 : 400 }}>{r}</span>
              </button>
            ))}
          </div>

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 6 }}>Mensaje al solicitante <span style={{ fontWeight: 400 }}>(opcional)</span></label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Explica brevemente el motivo…"
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', padding: '10px 12px', fontSize: 13.5, color: 'var(--fg1)', outline: 'none', resize: 'vertical', lineHeight: 1.5, marginBottom: 6 }} />
          <p style={{ margin: '0 0 4px', fontSize: 11.5, color: 'var(--fg2)' }}>Si se pagó el arancel, se iniciará el reembolso automáticamente.</p>
        </div>

        <div style={{ padding: '18px 28px 28px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 46, padding: '0 22px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={!reason}
            style={{ height: 46, padding: '0 26px', borderRadius: 9999, border: 'none', background: reason ? 'var(--danger)' : 'var(--border)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, cursor: reason ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}>
            <WIcon name="x" size={16} color="#fff" /> Confirmar rechazo
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Delete Post Confirm Modal ───────────────────────── */
function DeletePostModal({ post, onClose, onConfirm, loading }: { post: FlaggedPost; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(30,45,44,0.32)', animation: 'sb-scrim-in 0.18s ease' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-strong)', width: 460, maxWidth: '95vw', animation: 'sb-modal-in 0.28s cubic-bezier(0.34,1.56,0.64,1)', zIndex: 1, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: 'var(--danger)' }}>Eliminar publicación</h2>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--fg2)' }}>Esta acción es permanente y no se puede deshacer.</p>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <WIcon name="x" size={16} />
          </button>
        </div>

        <div style={{ background: 'var(--red-50)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{post.authorInitials}</div>
            <div>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5, color: 'var(--fg1)' }}>{post.authorName ?? 'Usuario'}</span>
              <span style={{ fontSize: 12, color: 'var(--fg2)', marginLeft: 8 }}>Sede {post.sede}</span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg1)', lineHeight: 1.5, fontStyle: 'italic' }}>
            "{(post.body ?? '').length > 160 ? (post.body ?? '').slice(0, 160) + '…' : (post.body ?? '')}"
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={loading} style={{ height: 44, padding: '0 20px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} style={{ height: 44, padding: '0 24px', borderRadius: 9999, border: 'none', background: 'var(--danger)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}>
            <WIcon name="trash-2" size={15} color="#fff" /> {loading ? 'Eliminando…' : 'Eliminar publicación'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Flagged Posts Section ───────────────────────────── */
function FlaggedPostsSection({ psychId }: { psychId: string }) {
  const qc = useQueryClient()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<FlaggedPost | null>(null)

  const { data: flagged = [], isLoading } = useQuery({
    queryKey: ['flagged-posts'],
    queryFn: () => api.getFlaggedPosts(psychId),
  })

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => api.deletePost(postId, psychId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flagged-posts'] })
      setDeleteTarget(null)
    },
  })

  const visible = flagged.filter(p => !dismissed.has(p.id))

  function relTime(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    if (mins < 60) return `hace ${mins} min`
    const h = Math.floor(mins / 60)
    if (h < 48) return `hace ${h}h`
    return `hace ${Math.floor(h / 24)} días`
  }

  return (
    <>
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--danger)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden', marginTop: 24 }}>
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <WIcon name="flag" size={18} color="var(--danger)" />
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Posts reportados</h2>
          </div>
          <span style={{ background: 'var(--red-50)', color: 'var(--danger)', borderRadius: 9999, padding: '4px 14px', fontSize: 13, fontWeight: 700 }}>
            {visible.length} pendiente{visible.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--fg2)', fontSize: 13 }}>Cargando posts reportados…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg2)' }}>
            <WIcon name="circle-check" size={38} color="var(--sage-500)" />
            <div style={{ marginTop: 12, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Sin posts reportados</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>La comunidad está en orden.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col /><col style={{ width: 100 }} /><col style={{ width: 80 }} />
              <col style={{ width: 130 }} /><col style={{ width: 220 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Autor / Contenido', 'Sede', 'Reportes', 'Fecha', 'Acciones'].map(l => (
                  <th key={l} style={{ textAlign: 'left', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 14px 12px' }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'var(--red-50)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{p.authorInitials}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13.5, color: 'var(--fg1)' }}>{p.authorName ?? 'Usuario'}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--fg2)', marginTop: 3, lineHeight: 1.5 }}>
                          {p.body ?? '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
                    <span style={{ background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{p.sede}</span>
                  </td>
                  <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--red-50)', color: 'var(--danger)', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>
                      <WIcon name="flag" size={12} /> {p.reportCount}
                    </span>
                  </td>
                  <td style={{ padding: '14px 14px', fontSize: 12.5, color: 'var(--fg2)', verticalAlign: 'middle' }}>
                    {relTime(p.createdAt)}
                  </td>
                  <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setDeleteTarget(p)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 9999, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <WIcon name="trash-2" size={13} color="#fff" /> Eliminar
                      </button>
                      <button onClick={() => setDismissed(prev => new Set([...prev, p.id]))}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Ignorar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteTarget && (
        <DeletePostModal
          post={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          loading={deleteMutation.isPending}
        />
      )}
    </>
  )
}

/* ── Solicitudes Page ────────────────────────────────── */
interface SolicitudesPageProps {
  requests: RegistrationRequest[]
  psychId: string
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

export function SolicitudesPage({ requests, psychId, onApprove, onReject }: SolicitudesPageProps) {
  const [approveReq, setApproveReq] = useState<RegistrationRequest | null>(null)
  const [rejectReq, setRejectReq]   = useState<RegistrationRequest | null>(null)

  const Head = ({ label }: { label: string }) => (
    <th style={{ textAlign: 'left', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 14px 12px' }}>{label}</th>
  )

  return (
    <div style={{ padding: 32, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Intro banner */}
      <div style={{ background: 'var(--amber-50)', border: '1px solid var(--accent)', borderRadius: 16, padding: '18px 22px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <WIcon name="inbox" size={22} color="var(--accent)" />
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15.5, color: 'var(--fg1)', marginBottom: 3 }}>
            Tienes {requests.length} solicitud{requests.length !== 1 ? 'es' : ''} de admisión pendiente{requests.length !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>
            Revisa los datos del solicitante y asigna psicólogo y padrino antes de aprobar. Las solicitudes rechazadas notifican automáticamente al solicitante.
          </div>
        </div>
      </div>

      {/* Solicitudes de ingreso */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Solicitudes de ingreso</h2>
          <span style={{ background: 'var(--amber-50)', color: 'var(--accent)', borderRadius: 9999, padding: '4px 14px', fontSize: 13, fontWeight: 700 }}>
            {requests.length} pendiente{requests.length !== 1 ? 's' : ''}
          </span>
        </div>

        {requests.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg2)' }}>
            <WIcon name="circle-check" size={40} color="var(--sage-500)" />
            <div style={{ marginTop: 12, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Sin solicitudes pendientes</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>Todas las solicitudes han sido procesadas.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col /><col style={{ width: 110 }} /><col style={{ width: 155 }} /><col style={{ width: 85 }} /><col style={{ width: 260 }} /></colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <Head label="Solicitante" /><Head label="Sede" /><Head label="Fecha solicitud" /><Head label="Arancel" /><Head label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'var(--amber-50)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>{r.initials}</div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--fg1)' }}>{r.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 14px' }}>
                    <span style={{ background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{r.sede}</span>
                  </td>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ fontSize: 13, color: 'var(--fg1)' }}>{r.date}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{r.rel}</div>
                  </td>
                  <td style={{ padding: '14px 14px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>{r.amount}</td>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setApproveReq(r)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 9999, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <WIcon name="circle-check" size={14} color="#fff" /> Aprobar
                      </button>
                      <button onClick={() => setRejectReq(r)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 9999, border: '1.5px solid var(--danger)', background: 'var(--surface)', color: 'var(--danger)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <WIcon name="x" size={14} /> Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Posts reportados */}
      <FlaggedPostsSection psychId={psychId} />

      {approveReq && (
        <ApproveModal
          req={approveReq}
          onClose={() => setApproveReq(null)}
          onConfirm={() => { onApprove(approveReq.id); setApproveReq(null) }}
        />
      )}
      {rejectReq && (
        <RejectModal
          req={rejectReq}
          onClose={() => setRejectReq(null)}
          onConfirm={() => { onReject(rejectReq.id); setRejectReq(null) }}
        />
      )}
    </div>
  )
}
