import { useState, type CSSProperties } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import { api } from '../services/api'
import type { ApiError, CreatePsychologistResponse, PsychologistListItem, Sede } from '../services/api'
import { useIsNarrow } from '../hooks/useIsNarrow'

const fieldStyle: CSSProperties = { height: 42, width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', padding: '0 12px', fontSize: 13.5, color: 'var(--fg1)', outline: 'none' }
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 5 }
const overlayStyle: CSSProperties = { position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const scrimStyle: CSSProperties = { position: 'absolute', inset: 0, background: 'rgba(30,45,44,0.32)', animation: 'sb-scrim-in 0.18s ease', border: 'none', padding: 0, cursor: 'pointer' }
const cardStyle: CSSProperties = { position: 'relative', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-strong)', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', animation: 'sb-modal-in 0.28s cubic-bezier(0.34,1.56,0.64,1)', zIndex: 1 }
const closeBtnStyle: CSSProperties = { width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const primaryBtnStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 26px', borderRadius: 9999, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }
const secondaryBtnStyle: CSSProperties = { height: 46, padding: '0 22px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer' }

// El scrim cierra el modal al hacer clic. Como <div> no lo alcanza el teclado ni lo anuncia
// un lector de pantalla, y era la unica via de cierre para quien no usa mouse.
function Scrim({ onClose }: { onClose: () => void }) {
  return <button type="button" aria-label="Cerrar" onClick={onClose} style={scrimStyle} />
}

function Head({ label }: { label: string }) {
  return <th style={{ textAlign: 'left', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg2)', padding: '0 14px 12px' }}>{label}</th>
}

function initialsOf(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function errorMessage(err: unknown, fallback: string): string {
  const apiErr = err as ApiError
  return apiErr.body?.message ?? fallback
}

// El backend rechaza cualquier destino que no atienda la sede de esos pacientes, así que
// ofrecerlo igual solo produce un error sin salida: se filtra antes de mostrarlo.
function targetsForSede(candidates: PsychologistListItem[], excludeId: string, sedeId: string) {
  return candidates.filter(
    (p) =>
      p.id !== excludeId &&
      p.accountStatus === 'active' &&
      p.sedes.some((s) => s.id === sedeId),
  )
}

/* ── Create Modal ────────────────────────────────────── */
function CreatePsychologistModal({ sedes, onClose, onDone }: { sedes: Sede[]; onClose: () => void; onDone: () => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [rut, setRut] = useState('')
  const [selectedSedes, setSelectedSedes] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatePsychologistResponse | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      api.createPsychologist({ firstName, lastName, email, rut, sedeIds: [...selectedSedes] }),
    onSuccess: (result) => {
      setCreated(result)
      setError(null)
    },
    onError: (err) => setError(errorMessage(err, 'No se pudo crear el psicólogo. Inténtalo de nuevo.')),
  })

  function toggleSede(id: string) {
    setSelectedSedes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (created) {
    return (
      <div style={overlayStyle}>
        <Scrim onClose={onDone} />
        <div style={{ ...cardStyle, width: 460, padding: 28 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: 'var(--fg1)' }}>Psicólogo creado</h2>
          <p style={{ margin: '5px 0 18px', fontSize: 13, color: 'var(--fg2)' }}>
            Entrégale estas credenciales: no se van a volver a mostrar.
          </p>
          <div style={{ background: 'var(--teal-50)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--fg2)', marginBottom: 4 }}>Correo</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--fg1)', marginBottom: 12 }}>
              {created.email}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg2)', marginBottom: 4 }}>Contraseña temporal</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: 'var(--primary)', letterSpacing: '0.03em' }}>
              {created.temporaryPassword}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onDone} style={primaryBtnStyle}>Entendido</button>
          </div>
        </div>
      </div>
    )
  }

  const canSubmit = firstName.trim() && lastName.trim() && email.trim() && rut.trim() && selectedSedes.size > 0

  return (
    <div style={overlayStyle}>
      <Scrim onClose={onClose} />
      <div style={{ ...cardStyle, width: 520, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 21, color: 'var(--fg1)' }}>Crear psicólogo</h2>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--fg2)' }}>Se genera una contraseña temporal que deberás entregarle.</p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <WIcon name="x" size={16} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'var(--red-50)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Nombre</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Fernanda" style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Apellido</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Fuentes" style={fieldStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Correo</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="fernanda.fuentes@ajuter.cl" style={fieldStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>RUT</label>
          <input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12.345.678-5" style={fieldStyle} />
        </div>
        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>Sedes</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sedes.map((s) => {
              const on = selectedSedes.has(s.id)
              return (
                <button key={s.id} type="button" onClick={() => toggleSede(s.id)}
                  style={{ height: 34, padding: '0 14px', borderRadius: 9999, border: on ? '1.5px solid var(--primary)' : '1.5px solid var(--border)', background: on ? 'var(--teal-50)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--fg2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={mutation.isPending} style={secondaryBtnStyle}>Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSubmit}
            style={{ ...primaryBtnStyle, opacity: mutation.isPending || !canSubmit ? 0.6 : 1, cursor: mutation.isPending || !canSubmit ? 'not-allowed' : 'pointer' }}>
            {mutation.isPending ? 'Creando…' : 'Crear psicólogo'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Deactivate Modal ────────────────────────────────── */
function DeactivateModal({
  psychologist, candidates, onClose, onDeactivated,
}: {
  psychologist: PsychologistListItem
  candidates: PsychologistListItem[]
  onClose: () => void
  onDeactivated: () => void
}) {
  // Un destino por sede: los pacientes de cada sede solo pueden pasar a alguien que la atienda.
  const [reassignments, setReassignments] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.deactivatePsychologistBySede(psychologist.id, reassignments),
    onSuccess: onDeactivated,
    onError: (err) => setError(errorMessage(err, 'No se pudo desactivar la cuenta. Inténtalo de nuevo.')),
  })

  const groups = psychologist.patientsBySede
  const blocked = groups.filter((g) => targetsForSede(candidates, psychologist.id, g.sedeId).length === 0)
  const allChosen = groups.every((g) => reassignments[g.sedeId])

  return (
    <div style={overlayStyle}>
      <Scrim onClose={onClose} />
      <div style={{ ...cardStyle, width: 480, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: 'var(--danger)' }}>Desactivar psicólogo</h2>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--fg2)' }}>
              {psychologist.firstName} {psychologist.lastName} · {psychologist.sedes.map(s => s.name).join(', ') || 'sin sedes'}
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <WIcon name="x" size={16} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'var(--red-50)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {groups.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {groups.map((g) => {
              const targets = targetsForSede(candidates, psychologist.id, g.sedeId)
              return (
                <div key={g.sedeId} style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>
                    {g.sedeName} — {g.count} paciente{g.count !== 1 ? 's' : ''}
                  </label>
                  {targets.length === 0 ? (
                    <div style={{ background: 'var(--red-50)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--danger)' }}>
                      Ningún psicólogo activo atiende {g.sedeName}. Asígnale esa sede a alguien
                      antes de dar de baja a {psychologist.firstName}.
                    </div>
                  ) : (
                    <select
                      value={reassignments[g.sedeId] ?? ''}
                      onChange={(e) => setReassignments((prev) => ({ ...prev, [g.sedeId]: e.target.value }))}
                      style={{ ...fieldStyle, cursor: 'pointer' }}
                    >
                      <option value="">Selecciona un psicólogo…</option>
                      {targets.map((p) => (
                        <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={mutation.isPending} style={secondaryBtnStyle}>Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || blocked.length > 0 || !allChosen}
            style={{ height: 46, padding: '0 24px', borderRadius: 9999, border: 'none', background: 'var(--danger)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: mutation.isPending || blocked.length > 0 || !allChosen ? 'not-allowed' : 'pointer', opacity: mutation.isPending || blocked.length > 0 || !allChosen ? 0.6 : 1 }}>
            {mutation.isPending ? 'Desactivando…' : 'Desactivar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Edit Sedes Modal ────────────────────────────────── */
function EditSedesModal({
  psychologist, allSedes, candidates, onClose, onDone,
}: {
  psychologist: PsychologistListItem
  allSedes: Sede[]
  candidates: PsychologistListItem[]
  onClose: () => void
  onDone: () => void
}) {
  const [selectedSedes, setSelectedSedes] = useState<Set<string>>(new Set(psychologist.sedes.map((s) => s.id)))
  const [reassignments, setReassignments] = useState<Record<string, string>>({})
  const [pendingSede, setPendingSede] = useState<{ sedeId: string; patientIds: string[] } | null>(null)
  const [reassignTarget, setReassignTarget] = useState('')
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // El backend rechaza de a una sede conflictiva por vez (409 con esa sedeId), así que el
  // flujo es iterativo: mandamos el set completo, si choca pedimos destino para esa sede
  // puntual, reintentamos con el mapa acumulado hasta que no queden conflictos.
  const mutation = useMutation({
    mutationFn: (nextReassignments: Record<string, string>) =>
      api.updatePsychologistSedes(psychologist.id, [...selectedSedes], nextReassignments),
    onSuccess: onDone,
    onError: (err) => {
      const apiErr = err as ApiError
      if (apiErr.status === 409 && typeof apiErr.body?.sedeId === 'string') {
        setPendingSede({
          sedeId: apiErr.body.sedeId,
          patientIds: Array.isArray(apiErr.body.patientIds) ? (apiErr.body.patientIds as string[]) : [],
        })
        setError(null)
      } else {
        // El destino recién elegido se guardaba antes de saber si el backend lo aceptaba: al
        // rechazarlo quedaba pegado en el mapa y cada reintento fallaba igual sin volver a
        // preguntar. Se descarta para que la sede vuelva a pedir destino.
        if (lastAdded) {
          setReassignments((prev) => {
            const next = { ...prev }
            delete next[lastAdded]
            return next
          })
          setLastAdded(null)
        }
        setError(errorMessage(err, 'No se pudieron actualizar las sedes. Inténtalo de nuevo.'))
      }
    },
  })

  function toggleSede(id: string) {
    setSelectedSedes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function confirmReassign() {
    if (!pendingSede || !reassignTarget) return
    const next = { ...reassignments, [pendingSede.sedeId]: reassignTarget }
    setReassignments(next)
    setLastAdded(pendingSede.sedeId)
    setPendingSede(null)
    setReassignTarget('')
    mutation.mutate(next)
  }

  if (pendingSede) {
    const pendingSedeName = allSedes.find((s) => s.id === pendingSede.sedeId)?.name ?? pendingSede.sedeId
    const eligibleTargets = targetsForSede(candidates, psychologist.id, pendingSede.sedeId)
    return (
      <div style={overlayStyle}>
        <Scrim onClose={onClose} />
        <div style={{ ...cardStyle, width: 440, padding: 28 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, color: 'var(--fg1)' }}>
            Reasignar pacientes de {pendingSedeName}
          </h2>
          <p style={{ margin: '8px 0 18px', fontSize: 13, color: 'var(--fg2)' }}>
            {pendingSede.patientIds.length} paciente{pendingSede.patientIds.length !== 1 ? 's' : ''} activo{pendingSede.patientIds.length !== 1 ? 's' : ''} en esa sede.
            Elige a quién se reasignan antes de quitarla.
          </p>
          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle}>Reasignar a</label>
            {eligibleTargets.length === 0 ? (
              <div style={{ background: 'var(--red-50)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--danger)' }}>
                Ningún otro psicólogo activo atiende {pendingSedeName}. Asígnale esa sede a
                alguien antes de quitársela a {psychologist.firstName}.
              </div>
            ) : (
              <select value={reassignTarget} onChange={(e) => setReassignTarget(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
                <option value="">Selecciona un psicólogo…</option>
                {eligibleTargets.map((p) => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={secondaryBtnStyle}>Cancelar</button>
            <button onClick={confirmReassign} disabled={!reassignTarget || mutation.isPending}
              style={{ ...primaryBtnStyle, opacity: !reassignTarget || mutation.isPending ? 0.6 : 1, cursor: !reassignTarget || mutation.isPending ? 'not-allowed' : 'pointer' }}>
              {mutation.isPending ? 'Guardando…' : 'Reasignar y continuar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle}>
      <Scrim onClose={onClose} />
      <div style={{ ...cardStyle, width: 460, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: 'var(--fg1)' }}>Editar sedes</h2>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--fg2)' }}>{psychologist.firstName} {psychologist.lastName}</p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <WIcon name="x" size={16} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'var(--red-50)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>Sedes</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allSedes.map((s) => {
              const on = selectedSedes.has(s.id)
              return (
                <button key={s.id} type="button" onClick={() => toggleSede(s.id)}
                  style={{ height: 34, padding: '0 14px', borderRadius: 9999, border: on ? '1.5px solid var(--primary)' : '1.5px solid var(--border)', background: on ? 'var(--teal-50)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--fg2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={mutation.isPending} style={secondaryBtnStyle}>Cancelar</button>
          <button onClick={() => mutation.mutate(reassignments)} disabled={mutation.isPending || selectedSedes.size === 0}
            style={{ ...primaryBtnStyle, opacity: mutation.isPending || selectedSedes.size === 0 ? 0.6 : 1, cursor: mutation.isPending || selectedSedes.size === 0 ? 'not-allowed' : 'pointer' }}>
            {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Equipo Page ─────────────────────────────────────── */
export function EquipoPage() {
  const isNarrow = useIsNarrow()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<PsychologistListItem | null>(null)
  const [editSedesTarget, setEditSedesTarget] = useState<PsychologistListItem | null>(null)

  const { data: psychologists = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['psychologists'],
    queryFn: api.getPsychologists,
  })
  const { data: sedes = [] } = useQuery({ queryKey: ['sedes'], queryFn: api.getSedes })

  function refresh() {
    qc.invalidateQueries({ queryKey: ['psychologists'] })
  }

  return (
    <div style={{ padding: isNarrow ? '16px 12px 28px' : 32, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', marginBottom: isNarrow ? 16 : 24, gap: 12, flexDirection: isNarrow ? 'column' : 'row' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 26, color: 'var(--fg1)' }}>Equipo</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--fg2)' }}>Cuentas de psicólogo y sus sedes asignadas.</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={primaryBtnStyle}>
          <WIcon name="users" size={16} color="#fff" /> Crear psicólogo
        </button>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg2)', fontSize: 14 }}>Cargando equipo…</div>
        ) : isError ? (
          /* Sin esta rama un 401 se veia igual que "no hay psicologos": el coordinador creia
             que la clinica estaba vacia en vez de que su sesion habia caducado. */
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg2)' }}>
            <WIcon name="triangle-alert" size={40} color="var(--danger)" />
            <div style={{ marginTop: 12, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>No se pudo cargar el equipo</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>{errorMessage(error, 'Revisa tu conexión o vuelve a iniciar sesión.')}</div>
            <button onClick={() => refetch()} style={{ ...secondaryBtnStyle, marginTop: 18 }}>Reintentar</button>
          </div>
        ) : psychologists.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg2)' }}>
            <WIcon name="users" size={40} color="var(--fg2)" />
            <div style={{ marginTop: 12, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 16, color: 'var(--fg1)' }}>Todavía no hay psicólogos</div>
            <div style={{ marginTop: 4, fontSize: 13 }}>Crea el primero con el botón de arriba.</div>
          </div>
        ) : (
          isNarrow ? (
            /* Cinco columnas de ancho fijo no caben en un teléfono: el nombre y el
               correo quedaban aplastados contra las etiquetas de sede. */
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {psychologists.map((p) => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>
                      {initialsOf(p.firstName, p.lastName)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14.5, color: 'var(--fg1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.firstName} {p.lastName}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                    </div>
                    <span style={{
                      flexShrink: 0,
                      background: p.accountStatus === 'active' ? 'var(--sage-50)' : 'var(--red-50)',
                      color: p.accountStatus === 'active' ? 'var(--sage-500)' : 'var(--danger)',
                      borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
                    }}>
                      {p.accountStatus === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {p.sedes.length === 0
                      ? <span style={{ fontSize: 12.5, color: 'var(--fg2)' }}>Sin sedes</span>
                      : p.sedes.map((s) => (
                          <span key={s.id} style={{ background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>{s.name}</span>
                        ))}
                  </div>

                  {p.accountStatus === 'active' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditSedesTarget(p)}
                        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                        <WIcon name="map-pin" size={14} /> Sedes
                      </button>
                      <button onClick={() => setDeactivateTarget(p)}
                        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 9999, border: '1.5px solid var(--danger)', background: 'var(--surface)', color: 'var(--danger)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                        <WIcon name="x" size={14} /> Desactivar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col /><col style={{ width: 110 }} /><col style={{ width: 190 }} /><col style={{ width: 110 }} /><col style={{ width: 220 }} /></colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <Head label="Psicólogo" /><Head label="Pacientes" /><Head label="Sedes" /><Head label="Estado" /><Head label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {psychologists.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'var(--teal-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>
                        {initialsOf(p.firstName, p.lastName)}
                      </div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--fg1)' }}>{p.firstName} {p.lastName}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--fg1)' }}>{p.patientCount}</div>
                    {/* Reasignar exige saber cuantos hay en cada sede, no solo el total. */}
                    {p.patientsBySede.length > 0 && (
                      <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--fg2)', lineHeight: 1.5 }}>
                        {p.patientsBySede.map((g) => (
                          <div key={g.sedeId}>{g.sedeName}: {g.count}</div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {p.sedes.map((s) => (
                        <span key={s.id} style={{ background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>{s.name}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '14px 14px' }}>
                    <span style={{
                      background: p.accountStatus === 'active' ? 'var(--sage-50)' : 'var(--red-50)',
                      color: p.accountStatus === 'active' ? 'var(--sage-500)' : 'var(--danger)',
                      borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600,
                    }}>
                      {p.accountStatus === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 14px' }}>
                    {p.accountStatus === 'active' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button onClick={() => setEditSedesTarget(p)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 9999, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <WIcon name="map-pin" size={14} /> Sedes
                        </button>
                        <button onClick={() => setDeactivateTarget(p)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 9999, border: '1.5px solid var(--danger)', background: 'var(--surface)', color: 'var(--danger)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <WIcon name="x" size={14} /> Desactivar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )
        )}
      </div>

      {showCreate && (
        <CreatePsychologistModal
          sedes={sedes}
          onClose={() => setShowCreate(false)}
          onDone={() => { refresh(); setShowCreate(false) }}
        />
      )}
      {deactivateTarget && (
        <DeactivateModal
          psychologist={deactivateTarget}
          candidates={psychologists}
          onClose={() => setDeactivateTarget(null)}
          onDeactivated={() => { refresh(); setDeactivateTarget(null) }}
        />
      )}
      {editSedesTarget && (
        <EditSedesModal
          psychologist={editSedesTarget}
          allSedes={sedes}
          candidates={psychologists}
          onClose={() => setEditSedesTarget(null)}
          onDone={() => { refresh(); setEditSedesTarget(null) }}
        />
      )}
    </div>
  )
}
