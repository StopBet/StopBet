import { useState, type CSSProperties, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { WIcon } from './WIcon'
import { useDialog } from '../hooks/useDialog'
import { api, type ApiError, type GroupSessionPayload, type SedeFamilySession, type SessionAudience } from '../services/api'

const inputStyle: CSSProperties = {
  height: 40, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)',
  padding: '0 12px', fontSize: 13, color: 'var(--fg1)', width: '100%', boxSizing: 'border-box',
}
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg2)', marginBottom: 5 }

const AUDIENCES: { value: SessionAudience; label: string; hint: string }[] = [
  { value: 'patients', label: 'Pacientes', hint: 'La ven solo los pacientes de la sede.' },
  { value: 'family', label: 'Familiares', hint: 'La ven los pacientes en la app y sus familiares en la web.' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

// Nest manda un texto, o una lista cuando falla la validación del DTO.
function backendMessage(err: unknown, fallback: string): string {
  const raw = (err as ApiError).body?.message
  const message = Array.isArray(raw) ? raw[0] : raw
  return typeof message === 'string' ? message : fallback
}

// HdU14 CA1 y CA2 — crear o editar una sesión grupal. La fecha y la hora se piden por separado
// (como en el resto del dashboard) y se juntan en la hora local. Al editar, la sede y el tipo
// quedan fijos: el backend no los acepta, porque cambiarían a quiénes está invitada.
export function SessionFormDialog({
  session,
  onClose,
  onSaved,
}: {
  session?: SedeFamilySession
  onClose: () => void
  onSaved: () => void
}) {
  const editing = !!session
  const initialDate = session ? new Date(session.sessionDate) : null
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const { data: sedes } = useQuery({
    queryKey: ['family', 'session-sedes'],
    queryFn: api.getSessionSedes,
    enabled: !editing,
  })

  const [title, setTitle] = useState(session?.title ?? '')
  const [sedeId, setSedeId] = useState('')
  const [date, setDate] = useState(initialDate ? ymd(initialDate) : '')
  const [time, setTime] = useState(initialDate ? hm(initialDate) : '19:00')
  const [capacity, setCapacity] = useState(String(session?.capacity ?? 15))
  const [audience, setAudience] = useState<SessionAudience | ''>(session?.audience ?? '')
  const [isOnline, setIsOnline] = useState(session?.isOnline ?? false)
  const [location, setLocation] = useState(session && !session.isOnline ? session.location : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Con una sola sede no hay nada que elegir: se usa esa y el selector no se muestra.
  const sede = sedes?.length === 1 ? sedes[0].id : sedeId
  const when = date && time ? new Date(`${date}T${time}`) : null
  const cupo = Number(capacity)

  const problema =
    !title.trim() ? 'Escribe el nombre de la sesión.'
    : !editing && !sede ? 'Elige la sede.'
    : !when ? 'Indica la fecha y la hora.'
    : when <= new Date() ? 'La sesión tiene que ser en el futuro.'
    : !Number.isInteger(cupo) || cupo < 1 || cupo > 500 ? 'El cupo va de 1 a 500 personas.'
    : editing && cupo < session.confirmedCount ? `Ya confirmaron ${session.confirmedCount} personas: el cupo no puede ser menor.`
    : !audience ? 'Elige si la sesión es de pacientes o de familiares.'
    : !isOnline && !location.trim() ? 'Indica el lugar de la sesión.'
    : null

  // Lo mismo que decide el backend para avisar (family.service → updateSession).
  const avisara =
    editing && session.confirmedCount > 0 && !!when &&
    (when.getTime() !== initialDate!.getTime() || cupo !== session.capacity)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (problema || !when || !audience) return
    setSaving(true)
    setError(null)
    const common = {
      title: title.trim(),
      sessionDate: when.toISOString(),
      capacity: cupo,
      isOnline,
      location: isOnline ? 'Online' : location.trim(),
    }
    try {
      if (editing) {
        await api.updateGroupSession(session.id, common)
      } else {
        const payload: GroupSessionPayload = { ...common, sedeId: sede, audience }
        await api.createGroupSession(payload)
      }
      onSaved()
    } catch (err) {
      setError(backendMessage(err, editing ? 'No se pudieron guardar los cambios. Intenta nuevamente.' : 'No se pudo crear la sesión. Intenta nuevamente.'))
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button
        aria-label="Cerrar"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', border: 'none', padding: 0, cursor: 'pointer' }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-sesion-titulo"
        tabIndex={-1}
        style={{
          position: 'relative', background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-strong)',
          width: 460, maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto', padding: 24, zIndex: 1, boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <h2 id="sb-sesion-titulo" style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, color: 'var(--fg1)' }}>
              {editing ? 'Editar sesión' : 'Crear sesión'}
            </h2>
            {editing && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg2)' }}>
                Sede {session.sedeName} · {session.audience === 'patients' ? 'Pacientes' : 'Familiares'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar formulario"
            style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <WIcon name="x" size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="sb-sesion-nombre" style={labelStyle}>Nombre</label>
            <input id="sb-sesion-nombre" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Grupo de apoyo de los martes" style={inputStyle} />
          </div>

          {!editing && sedes && sedes.length > 1 && (
            <div>
              <label htmlFor="sb-sesion-sede" style={labelStyle}>Sede</label>
              <select id="sb-sesion-sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)} style={inputStyle}>
                <option value="">Elige una sede</option>
                {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 150px' }}>
              <label htmlFor="sb-sesion-fecha" style={labelStyle}>Fecha</label>
              <input id="sb-sesion-fecha" type="date" value={date} min={ymd(new Date())} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <label htmlFor="sb-sesion-hora" style={labelStyle}>Hora</label>
              <input id="sb-sesion-hora" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: '1 1 90px' }}>
              <label htmlFor="sb-sesion-cupo" style={labelStyle}>Cupo</label>
              <input id="sb-sesion-cupo" type="number" min={1} max={500} value={capacity} onChange={(e) => setCapacity(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {!editing && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={labelStyle}>Tipo de sesión</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {AUDIENCES.map((a) => (
                  <label
                    key={a.value}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${audience === a.value ? 'var(--primary)' : 'var(--border)'}`,
                    }}
                  >
                    <input type="radio" name="sb-sesion-tipo" value={a.value} checked={audience === a.value} onChange={() => setAudience(a.value)} style={{ marginTop: 2 }} />
                    <span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--fg1)' }}>{a.label}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--fg2)' }}>{a.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--fg1)', cursor: 'pointer' }}>
            <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
            Sesión online
          </label>

          {!isOnline && (
            <div>
              <label htmlFor="sb-sesion-lugar" style={labelStyle}>Lugar</label>
              <input id="sb-sesion-lugar" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Sala 2, segundo piso" style={inputStyle} />
            </div>
          )}

          {avisara && (
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: 'var(--surface-alt)', borderRadius: 10, padding: '10px 12px' }}>
              <WIcon name="bell" size={15} style={{ color: 'var(--primary-text)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)' }}>
                Avisaremos del cambio a {session!.confirmedCount === 1 ? 'la persona que confirmó' : `las ${session!.confirmedCount} personas que confirmaron`}.
              </p>
            </div>
          )}

          {error && (
            <div role="alert" style={{ background: 'var(--red-50)', color: 'var(--danger-text)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <p style={{ margin: 0, minHeight: 17, fontSize: 12, color: 'var(--fg2)' }}>{problema ?? ' '}</p>

          <button
            type="submit"
            disabled={!!problema || saving}
            style={{
              width: '100%', height: 46, borderRadius: 9999, border: 'none',
              background: problema ? 'var(--border)' : 'var(--primary)',
              color: problema ? 'var(--fg2)' : 'var(--fg-on-primary)',
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15,
              cursor: problema || saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
