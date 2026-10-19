import { useState, type CSSProperties } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import { SessionFormDialog } from '../components/SessionFormDialog'
import { api, type ApiError, type GroupSessionDetail, type SedeFamilySession, type SessionParticipant } from '../services/api'

type Scope = 'upcoming' | 'past'

const SESSIONS_KEY = ['family', 'sede-sessions'] as const

const primaryBtnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 22px', borderRadius: 9999, border: 'none',
  background: 'var(--primary)', color: 'var(--fg-on-primary)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14,
  cursor: 'pointer',
}

const ghostBtnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--border)',
  borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: 'var(--primary-text)', cursor: 'pointer',
}

function CreateButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={primaryBtnStyle}>
      <WIcon name="plus" size={17} />
      Crear sesión
    </button>
  )
}

const DATE_FMT = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
// hour12 explícito: sin esto algunos navegadores renderizan "07:00 p. m." y el
// sufijo "h" queda pegado detrás. En Chile la hora va en formato 24.
const TIME_FMT = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function Count({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <WIcon name={icon} size={16} style={{ color }} />
      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--fg1)' }}>{value}</span>
      <span style={{ fontSize: 13, color: 'var(--fg2)' }}>{label}</span>
    </div>
  )
}

// ── Detalle: tres listas y, si la sesión ya empezó, pasar lista (HdU14 CA3 y CA4) ──────────

function PresenceToggle({
  name,
  value,
  onChange,
}: {
  name: string
  value: boolean | null
  onChange: (attended: boolean) => void
}) {
  const option = (attended: boolean, label: string) => {
    const active = value === attended
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${name}: ${label}`}
        onClick={() => onChange(attended)}
        style={{
          padding: '5px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', borderRadius: 999,
          border: `1px solid ${active ? (attended ? 'var(--secondary-text)' : 'var(--fg2)') : 'var(--border)'}`,
          background: active ? 'var(--surface-alt)' : 'transparent',
          color: active ? (attended ? 'var(--secondary-text)' : 'var(--fg1)') : 'var(--fg2)',
        }}
      >
        {label}
      </button>
    )
  }
  return (
    <div role="group" aria-label={`Asistencia de ${name}`} style={{ display: 'inline-flex', gap: 6 }}>
      {option(true, 'Asistió')}
      {option(false, 'No asistió')}
    </div>
  )
}

function ParticipantGroup({
  title,
  icon,
  color,
  people,
  emptyText,
  presence,
}: {
  title: string
  icon: string
  color: string
  people: SessionParticipant[]
  emptyText: string
  presence: { draft: Map<string, boolean>; set: (userId: string, attended: boolean) => void } | null
}) {
  return (
    <section style={{ minWidth: 0 }}>
      <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: 'var(--fg1)' }}>
        <WIcon name={icon} size={15} style={{ color }} />
        {title} <span style={{ color: 'var(--fg2)', fontWeight: 600 }}>({people.length})</span>
      </h4>
      {people.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)' }}>{emptyText}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: presence ? 0 : 8 }}>
          {people.map((p) => (
            <li
              key={p.userId}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 14,
                ...(presence && { padding: '8px 0', borderBottom: '1px solid var(--border)' }),
              }}
            >
              <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                <span style={{ color: 'var(--fg1)' }}>{p.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--fg2)' }}>
                  {p.kind === 'family' ? (p.patientName ? `Familiar de ${p.patientName}` : 'Familiar') : 'Paciente'}
                </span>
              </span>
              {presence && (
                <PresenceToggle
                  name={p.name}
                  value={presence.draft.get(p.userId) ?? p.attended}
                  onChange={(attended) => presence.set(p.userId, attended)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SessionDetail({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient()
  const detailKey = ['family', 'session-detail', sessionId]
  const { data, isLoading, isError } = useQuery({
    queryKey: detailKey,
    queryFn: () => api.getGroupSessionDetail(sessionId),
  })
  // Lo que el psicólogo marcó y todavía no guarda; lo guardado viene en `attended`.
  const [draft, setDraft] = useState<Map<string, boolean>>(new Map())
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: () => api.markSessionPresence(sessionId, [...draft].map(([userId, attended]) => ({ userId, attended }))),
    onSuccess: (detail: GroupSessionDetail) => {
      qc.setQueryData(detailKey, detail)
      setDraft(new Map())
      setSaved(true)
    },
  })

  if (isLoading) return <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)' }}>Cargando invitados…</p>
  if (isError || !data) return <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)' }}>No pudimos cargar el detalle. Vuelve a intentarlo.</p>

  const presence = data.canMarkPresence
    ? {
        draft,
        set: (userId: string, attended: boolean) => {
          setSaved(false)
          setDraft((prev) => new Map(prev).set(userId, attended))
        },
      }
    : null

  const everyone = [...data.confirmed, ...data.declined, ...data.pending]
  const sinMarcar = everyone.filter((p) => (draft.get(p.userId) ?? p.attended) === null).length
  const saveError = save.isError
    ? ((save.error as ApiError).body?.message as string | undefined) ?? 'No se pudo guardar la asistencia. Intenta nuevamente.'
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {presence && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)' }}>
          La sesión ya ocurrió: marca quién asistió de verdad.
          {sinMarcar > 0 && ` Faltan ${sinMarcar} ${sinMarcar === 1 ? 'persona' : 'personas'} por marcar.`}
        </p>
      )}

      {/* Al pasar lista cada persona lleva sus botones: en tres columnas quedaban apretados,
          así que las listas van una debajo de otra, con el nombre y los botones en una fila. */}
      <div style={{ display: 'grid', gridTemplateColumns: presence ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 22 }}>
        <ParticipantGroup title="Confirmados" icon="circle-check" color="var(--secondary-text)" people={data.confirmed} emptyText="Nadie ha confirmado todavía." presence={presence} />
        <ParticipantGroup title="No asistirán" icon="x" color="var(--fg2)" people={data.declined} emptyText="Nadie avisó que no puede ir." presence={presence} />
        <ParticipantGroup title="Sin respuesta" icon="clock" color="var(--fg2)" people={data.pending} emptyText="Todos los invitados respondieron." presence={presence} />
      </div>

      {presence && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => save.mutate()}
            disabled={draft.size === 0 || save.isPending}
            style={{ ...primaryBtnStyle, opacity: draft.size === 0 ? 0.5 : 1, cursor: draft.size === 0 ? 'not-allowed' : 'pointer' }}
          >
            <WIcon name="check" size={16} />
            {save.isPending ? 'Guardando…' : 'Guardar asistencia'}
          </button>
          {saved && draft.size === 0 && (
            <span role="status" style={{ fontSize: 13, color: 'var(--secondary-text)' }}>Asistencia guardada.</span>
          )}
          {saveError && <span role="alert" style={{ fontSize: 13, color: 'var(--danger-text)' }}>{saveError}</span>}
        </div>
      )}
    </div>
  )
}

// ── Fila de cada sesión ────────────────────────────────────────────────────────

function SessionRow({ session, scope, onEdit }: { session: SedeFamilySession; scope: Scope; onEdit: () => void }) {
  const [open, setOpen] = useState(false)
  const date = new Date(session.sessionDate)
  const detailId = `sb-sesion-detalle-${session.id}`

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-soft)' }}>
      <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16.5, color: 'var(--fg1)' }}>
            {session.title}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 16px', marginTop: 6, fontSize: 13, color: 'var(--fg2)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <WIcon name="calendar" size={14} />
              {capitalize(DATE_FMT.format(date))}, {TIME_FMT.format(date)} h
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <WIcon name={session.isOnline ? 'message-circle' : 'map-pin'} size={14} />
              {session.isOnline ? 'Online' : session.location}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <WIcon name="users" size={14} />
              {session.audience === 'patients' ? 'Pacientes' : 'Familiares'}
              {session.capacity !== null && ` · cupo ${session.capacity}`}
            </span>
            <span>Sede {session.sedeName}</span>
          </div>
        </div>

        {/* Envuelve en pantallas angostas: si no, los botones se salen por la derecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Count icon="circle-check" value={session.confirmedCount} label="confirman" color="var(--secondary-text)" />
          <Count icon="x" value={session.declinedCount} label="no asisten" color="var(--fg2)" />
          {scope === 'upcoming' && (
            <button onClick={onEdit} style={ghostBtnStyle}>
              <WIcon name="notebook-pen" size={14} />
              Editar
            </button>
          )}
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={detailId} style={ghostBtnStyle}>
            {open ? 'Ocultar' : scope === 'past' ? 'Pasar lista' : 'Ver invitados'}
            <WIcon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
          </button>
        </div>
      </div>

      {open && (
        <div id={detailId} style={{ borderTop: '1px solid var(--border)', padding: '16px 22px 20px' }}>
          <SessionDetail sessionId={session.id} />
        </div>
      )}
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────────

function ScopeTabs({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  const tab = (value: Scope, label: string) => {
    const active = scope === value
    return (
      <button
        role="tab"
        aria-selected={active}
        onClick={() => onChange(value)}
        style={{
          padding: '8px 16px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
          background: active ? 'var(--primary)' : 'transparent',
          color: active ? 'var(--fg-on-primary)' : 'var(--fg2)',
        }}
      >
        {label}
      </button>
    )
  }
  return (
    <div role="tablist" aria-label="Sesiones" style={{ display: 'inline-flex', gap: 8 }}>
      {tab('upcoming', 'Próximas')}
      {tab('past', 'Pasadas')}
    </div>
  )
}

export function SesionesFamiliaresPage() {
  const qc = useQueryClient()
  const [scope, setScope] = useState<Scope>('upcoming')
  // undefined = cerrado; null = crear; una sesión = editarla
  const [form, setForm] = useState<SedeFamilySession | null | undefined>(undefined)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...SESSIONS_KEY, scope],
    queryFn: () => api.getSedeFamilySessions(scope),
  })

  const dialog = form !== undefined && (
    <SessionFormDialog
      session={form ?? undefined}
      onClose={() => setForm(undefined)}
      onSaved={() => {
        setForm(undefined)
        void qc.invalidateQueries({ queryKey: SESSIONS_KEY })
        void qc.invalidateQueries({ queryKey: ['family', 'session-detail'] })
      }}
    />
  )

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '0 0 20px' }}>
      <ScopeTabs scope={scope} onChange={setScope} />
      <CreateButton onClick={() => setForm(null)} />
    </div>
  )

  let body
  if (isLoading) {
    body = <div style={{ padding: '24px 0', color: 'var(--fg2)' }}>Cargando sesiones de tu sede…</div>
  } else if (isError) {
    // 422 = la cuenta clínica no tiene sede asignada, que se arregla en Configuración
    const noSede = (error as { status?: number })?.status === 422
    body = (
      <div style={{ padding: '24px 0', color: 'var(--fg2)' }}>
        {noSede
          ? 'Tu cuenta no tiene una sede asignada, así que no podemos mostrar sus sesiones.'
          : 'No pudimos cargar las sesiones. Vuelve a intentarlo.'}
      </div>
    )
  } else if (!data || data.length === 0) {
    // HdU14 CA5 — sin sesiones próximas: el mensaje y el botón para crear la primera.
    body = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280 }}>
        <div style={{ textAlign: 'center', color: 'var(--fg2)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: 'var(--fg1)', marginBottom: 6 }}>
            {scope === 'upcoming' ? 'No hay sesiones próximas' : 'Sin sesiones pasadas'}
          </div>
          <div style={{ fontSize: 14, marginBottom: scope === 'upcoming' ? 18 : 0 }}>
            {scope === 'upcoming'
              ? 'Tu sede no tiene sesiones grupales agendadas.'
              : 'En los últimos 90 días tu sede no tuvo sesiones grupales.'}
          </div>
          {scope === 'upcoming' && <CreateButton onClick={() => setForm(null)} />}
        </div>
      </div>
    )
  } else {
    const totalConfirmed = data.reduce((sum, s) => sum + s.confirmedCount, 0)
    body = (
      <>
        <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--fg2)' }}>
          {scope === 'upcoming'
            ? `${data.length === 1 ? '1 sesión próxima' : `${data.length} sesiones próximas`} en tu sede`
            : `${data.length === 1 ? '1 sesión' : `${data.length} sesiones`} en los últimos 90 días`}
          {scope === 'upcoming' && totalConfirmed > 0 && ` · ${totalConfirmed} confirmaciones`}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.map((s) => (
            <SessionRow key={s.id} session={s} scope={scope} onEdit={() => setForm(s)} />
          ))}
        </div>
      </>
    )
  }

  return (
    <div style={{ padding: '26px 32px 48px' }}>
      {header}
      {body}
      {dialog}
    </div>
  )
}
