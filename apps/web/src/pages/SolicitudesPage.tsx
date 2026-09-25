import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import { type RegistrationRequest } from '../data/mockData'
import { api } from '../services/api'
import type { FlaggedPost } from '../services/api'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { useDialog } from '../hooks/useDialog'

// El backend no envía iniciales para los posts reportados, así que el avatar salía
// siempre vacío. Se derivan del nombre del autor.
function initialsOf(name: string | null): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

/* ── Approve Modal ───────────────────────────────────── */
function ApproveModal({ req, onClose, onConfirm }: { req: RegistrationRequest; onClose: () => void; onConfirm: (assignedPsychologistId: string) => void }) {
  const [psico, setPsico] = useState('')
  const dialogRef = useDialog<HTMLDivElement>(onClose)

  const { data: psicologos = [], isLoading: cargandoPsicologos } = useQuery({
    queryKey: ['psychologists'],
    queryFn: api.getPsychologists,
  })

  // Solo psicólogos activos que atienden la sede del solicitante: el backend rechaza con 403
  // una asignación fuera de sede, y ofrecerla aquí sería prometer algo que va a fallar.
  const disponibles = psicologos.filter(
    p => p.accountStatus === 'active' && p.sedes.some(sede => sede.id === req.sedeId),
  )
  // El `select` no puede quedar sin valor mientras carga: si el estado sigue vacío, vale el
  // primero de la lista, que es lo que el usuario está viendo seleccionado.
  const psicoElegido = psico || disponibles[0]?.id || ''

  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 6 } as const
  const selectStyle = { appearance: 'none', height: 42, width: '100%', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', padding: '0 36px 0 12px', fontSize: 13.5, color: 'var(--fg1)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' } as const
  const chevronStyle = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--fg2)' } as const

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', animation: 'sb-scrim-in 0.18s ease' }} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="sb-aprobar-titulo" tabIndex={-1} style={{ position: 'relative', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-strong)', width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', animation: 'sb-modal-in 0.28s var(--ease-calm)', zIndex: 1 }}>
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 }}>
            <div>
              <h2 id="sb-aprobar-titulo" style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 21, color: 'var(--fg1)' }}>Aprobar solicitud</h2>
              <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--fg2)' }}>Elige el psicólogo que va a acompañar a <strong>{req.name}</strong>.</p>
            </div>
            <button onClick={onClose} aria-label="Cerrar" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WIcon name="x" size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--teal-50)', borderRadius: 12, padding: '13px 16px', marginBottom: 22 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--primary)', color: 'var(--fg-on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{req.initials}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15.5, color: 'var(--fg1)' }}>{req.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--fg2)', display: 'flex', gap: 12 }}>
                <span>{req.email}</span>
                <span>Sede: {req.sede}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="sb-aprobar-psicologo" style={labelStyle}>Psicólogo asignado</label>
              {cargandoPsicologos ? (
                <div style={{ fontSize: 13, color: 'var(--fg2)', padding: '11px 0' }}>Cargando psicólogos…</div>
              ) : disponibles.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--danger-text)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.45 }}>
                  No hay psicólogos activos en la sede {req.sede}. Asigna uno desde <strong>Equipo</strong> antes de aprobar esta solicitud.
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <select id="sb-aprobar-psicologo" value={psicoElegido} onChange={e => setPsico(e.target.value)} style={selectStyle}>
                    {disponibles.map(p => (
                      <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                    ))}
                  </select>
                  <span style={chevronStyle}>
                    <WIcon name="chevron-down" size={15} />
                  </span>
                </div>
              )}
            </div>
            {/* Acá se pedían padrino (de una lista de ejemplo), fecha de inicio y notas clínicas,
                pero el backend solo recibe el psicólogo: las notas que el profesional escribía
                se perdían sin aviso. Se quitaron hasta que la aprobación pueda guardarlas. */}
          </div>
        </div>

        <div style={{ padding: '20px 28px 28px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 46, padding: '0 22px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={() => onConfirm(psicoElegido)} disabled={!psicoElegido}
            style={{ height: 46, padding: '0 26px', borderRadius: 9999, border: 'none', background: psicoElegido ? 'var(--primary)' : 'var(--border)', color: 'var(--fg-on-primary)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, cursor: psicoElegido ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}>
            <WIcon name="circle-check" size={17} color="var(--fg-on-primary)" /> Confirmar aprobación
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Reject Modal ────────────────────────────────────── */
function RejectModal({ req, onClose, onConfirm }: { req: RegistrationRequest; onClose: () => void; onConfirm: () => void }) {
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', animation: 'sb-scrim-in 0.18s ease' }} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="sb-rechazar-titulo" tabIndex={-1} style={{ position: 'relative', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-strong)', width: 480, maxWidth: '95vw', animation: 'sb-modal-in 0.28s var(--ease-calm)', zIndex: 1 }}>
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 }}>
            <div>
              <h2 id="sb-rechazar-titulo" style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 21, color: 'var(--danger-text)' }}>Rechazar solicitud</h2>
              <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--fg2)' }}>Vas a rechazar la solicitud de <strong>{req.name}</strong>.</p>
            </div>
            <button onClick={onClose} aria-label="Cerrar" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <WIcon name="x" size={16} />
            </button>
          </div>

          {/* Había que elegir un motivo y se podía escribir un mensaje, pero el rechazo no envía
              nada al backend, y la promesa de "reembolso automático" no la cumple ningún
              servicio. Queda solo lo que de verdad pasa. */}
          <p style={{ margin: '0 0 4px', fontSize: 13.5, color: 'var(--fg1)', lineHeight: 1.5 }}>
            La solicitud queda rechazada y deja de aparecer en esta lista.
          </p>
        </div>

        <div style={{ padding: '18px 28px 28px', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 46, padding: '0 22px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={onConfirm}
            style={{ height: 46, padding: '0 26px', borderRadius: 9999, border: 'none', background: 'var(--danger)', color: 'var(--fg-on-primary)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <WIcon name="x" size={16} color="var(--fg-on-primary)" /> Confirmar rechazo
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Delete Post Confirm Modal ───────────────────────── */
function DeletePostModal({ post, onClose, onConfirm, loading }: { post: FlaggedPost; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', animation: 'sb-scrim-in 0.18s ease' }} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="sb-eliminar-titulo" tabIndex={-1} style={{ position: 'relative', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-strong)', width: 460, maxWidth: '95vw', animation: 'sb-modal-in 0.28s var(--ease-calm)', zIndex: 1, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: 'var(--danger-text)' }} id="sb-eliminar-titulo">Eliminar publicación</h2>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--fg2)' }}>Esta acción es permanente y no se puede deshacer.</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <WIcon name="x" size={16} />
          </button>
        </div>

        <div style={{ background: 'var(--red-50)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--danger)', color: 'var(--fg-on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initialsOf(post.authorName)}</div>
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
          <button onClick={onConfirm} disabled={loading} style={{ height: 44, padding: '0 24px', borderRadius: 9999, border: 'none', background: 'var(--danger)', color: 'var(--fg-on-primary)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}>
            <WIcon name="trash-2" size={15} color="var(--fg-on-primary)" /> {loading ? 'Eliminando…' : 'Eliminar publicación'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Flagged Posts Section ───────────────────────────── */
function FlaggedPostsSection() {
  const isNarrow = useIsNarrow()
  const qc = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<FlaggedPost | null>(null)

  const { data: flagged = [], isLoading } = useQuery({
    queryKey: ['flagged-posts'],
    queryFn: () => api.getFlaggedPosts(),
  })

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => api.deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flagged-posts'] })
      setDeleteTarget(null)
    },
  })

  // Antes «Ocultar» vivía en memoria: la publicación volvía al recargar y el Resumen la seguía
  // contando. Ahora el descarte queda en el servidor, para todo el equipo.
  const dismissMutation = useMutation({
    mutationFn: (postId: string) => api.dismissReports(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flagged-posts'] }),
  })

  const visible = flagged

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
            <WIcon name="flag" size={18} color="var(--danger-text)" />
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Posts reportados</h2>
          </div>
          <span style={{ background: 'var(--red-50)', color: 'var(--danger-text)', borderRadius: 9999, padding: '4px 14px', fontSize: 13, fontWeight: 700 }}>
            {visible.length} pendiente{visible.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p style={{ margin: '-6px 24px 14px', fontSize: 12.5, color: 'var(--fg2)', lineHeight: 1.5 }}>
          «Descartar» deja la publicación en la comunidad y la saca de esta lista para todo el equipo.
          Si alguien la vuelve a reportar, aparece de nuevo.
        </p>
        {dismissMutation.isError && (
          <p role="alert" style={{ margin: '-6px 24px 14px', fontSize: 12.5, color: 'var(--danger-text)', fontWeight: 600 }}>
            No pudimos descartar los reportes. Vuelve a intentarlo.
          </p>
        )}

        {isLoading ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--fg2)', fontSize: 13 }}>Cargando posts reportados…</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg2)' }}>
            <WIcon name="circle-check" size={38} color="var(--secondary-text)" />
            <div style={{ marginTop: 12, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Sin posts reportados</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>La comunidad está en orden.</div>
          </div>
        ) : (
          isNarrow ? (
            /* Los anchos fijos de las otras columnas aplastaban la del contenido a
               casi nada y el texto del post salía una palabra por línea. */
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visible.map(p => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'var(--red-50)', color: 'var(--danger-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{initialsOf(p.authorName)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--fg1)' }}>{p.authorName ?? 'Usuario'}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{relTime(p.createdAt)}</div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--red-50)', color: 'var(--danger-text)', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      <WIcon name="flag" size={12} /> {p.reportCount}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>{p.body ?? '-'}</div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap', background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{p.sede}</span>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <button onClick={() => setDeleteTarget(p)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 9999, border: 'none', background: 'var(--danger)', color: 'var(--fg-on-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <WIcon name="trash-2" size={13} color="var(--fg-on-primary)" /> Eliminar
                      </button>
                      <button onClick={() => dismissMutation.mutate(p.id)} disabled={dismissMutation.isPending}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {dismissMutation.isPending && dismissMutation.variables === p.id ? 'Descartando…' : 'Descartar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col /><col style={{ width: 132 }} /><col style={{ width: 80 }} />
              <col style={{ width: 130 }} /><col style={{ width: 220 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Autor / Contenido', 'Sede', 'Reportes', 'Fecha', 'Acciones'].map(l => (
                  <th key={l} style={{ textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 14px 12px' }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'var(--red-50)', color: 'var(--danger-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13 }}>{initialsOf(p.authorName)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13.5, color: 'var(--fg1)' }}>{p.authorName ?? 'Usuario'}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--fg2)', marginTop: 3, lineHeight: 1.5 }}>
                          {p.body ?? '-'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap', background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{p.sede}</span>
                  </td>
                  <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--red-50)', color: 'var(--danger-text)', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700 }}>
                      <WIcon name="flag" size={12} /> {p.reportCount}
                    </span>
                  </td>
                  <td style={{ padding: '14px 14px', fontSize: 12.5, color: 'var(--fg2)', verticalAlign: 'middle' }}>
                    {relTime(p.createdAt)}
                  </td>
                  <td style={{ padding: '14px 14px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setDeleteTarget(p)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 9999, border: 'none', background: 'var(--danger)', color: 'var(--fg-on-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <WIcon name="trash-2" size={13} color="var(--fg-on-primary)" /> Eliminar
                      </button>
                      <button onClick={() => dismissMutation.mutate(p.id)} disabled={dismissMutation.isPending}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {dismissMutation.isPending && dismissMutation.variables === p.id ? 'Descartando…' : 'Descartar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )
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
  onApprove: (id: string, assignedPsychologistId?: string) => void
  onReject: (id: string) => void
}

export function SolicitudesPage({ requests, onApprove, onReject }: SolicitudesPageProps) {
  const isNarrow = useIsNarrow()
  const [approveReq, setApproveReq] = useState<RegistrationRequest | null>(null)
  const [rejectReq, setRejectReq]   = useState<RegistrationRequest | null>(null)

  const Head = ({ label }: { label: string }) => (
    <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 14px 12px' }}>{label}</th>
  )

  return (
    <div style={{ padding: isNarrow ? '16px 12px 28px' : 32, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Intro banner */}
      <div style={{ background: 'var(--amber-50)', border: '1px solid var(--accent)', borderRadius: 16, padding: '18px 22px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <WIcon name="inbox" size={22} color="var(--primary-text)" />
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15.5, color: 'var(--fg1)', marginBottom: 3 }}>
            Tienes {requests.length} solicitud{requests.length !== 1 ? 'es' : ''} de admisión pendiente{requests.length !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>
            Revisa los datos del solicitante y elige su psicólogo antes de aprobar.
          </div>
        </div>
      </div>

      {/* Solicitudes de ingreso */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>Solicitudes de ingreso</h2>
          <span style={{ background: 'var(--amber-50)', color: 'var(--primary-text)', borderRadius: 9999, padding: '4px 14px', fontSize: 13, fontWeight: 700 }}>
            {requests.length} pendiente{requests.length !== 1 ? 's' : ''}
          </span>
        </div>

        {requests.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg2)' }}>
            <WIcon name="circle-check" size={40} color="var(--secondary-text)" />
            <div style={{ marginTop: 12, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Sin solicitudes pendientes</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>Todas las solicitudes han sido procesadas.</div>
          </div>
        ) : (
          isNarrow ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {requests.map(r => (
                <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'var(--amber-50)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>{r.initials}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, color: 'var(--fg1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--primary-text)', flexShrink: 0 }}>{r.amount}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap', background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{r.sede}</span>
                    <span style={{ fontSize: 12, color: 'var(--fg2)' }}>{r.date} · {r.rel}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setApproveReq(r)}
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 9999, border: 'none', background: 'var(--primary)', color: 'var(--fg-on-primary)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                      <WIcon name="circle-check" size={14} color="var(--fg-on-primary)" /> Aprobar
                    </button>
                    <button onClick={() => setRejectReq(r)}
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 9999, border: '1.5px solid var(--danger)', background: 'var(--surface)', color: 'var(--danger-text)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                      <WIcon name="x" size={14} /> Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col /><col style={{ width: 132 }} /><col style={{ width: 155 }} /><col style={{ width: 85 }} /><col style={{ width: 260 }} /></colgroup>
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
                      <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'var(--amber-50)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>{r.initials}</div>
                      {/* Sin acotar, con tableLayout fijo el nombre se desborda de la
                          celda y la columna siguiente le queda encima. */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--fg1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 14px' }}>
                    <span style={{ display: 'inline-block', whiteSpace: 'nowrap', background: 'var(--teal-50)', color: 'var(--primary-text)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{r.sede}</span>
                  </td>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ fontSize: 13, color: 'var(--fg1)' }}>{r.date}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{r.rel}</div>
                  </td>
                  <td style={{ padding: '14px 14px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--primary-text)' }}>{r.amount}</td>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setApproveReq(r)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 9999, border: 'none', background: 'var(--primary)', color: 'var(--fg-on-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <WIcon name="circle-check" size={14} color="var(--fg-on-primary)" /> Aprobar
                      </button>
                      <button onClick={() => setRejectReq(r)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 9999, border: '1.5px solid var(--danger)', background: 'var(--surface)', color: 'var(--danger-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <WIcon name="x" size={14} /> Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )
        )}
      </div>

      {/* Posts reportados */}
      <FlaggedPostsSection />

      {approveReq && (
        <ApproveModal
          req={approveReq}
          onClose={() => setApproveReq(null)}
          onConfirm={assignedPsychologistId => { onApprove(approveReq.id, assignedPsychologistId); setApproveReq(null) }}
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
