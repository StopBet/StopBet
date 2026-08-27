import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import { api, type SedeFamilySession } from '../services/api'

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

function SessionRow({ session }: { session: SedeFamilySession }) {
  const [open, setOpen] = useState(false)
  const date = new Date(session.sessionDate)
  const total = session.confirmedCount + session.declinedCount

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
          </div>
        </div>

        {/* Envuelve en pantallas angostas: si no, el botón se sale por la derecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Count icon="circle-check" value={session.confirmedCount} label="confirman" color="var(--secondary)" />
          <Count icon="x" value={session.declinedCount} label="no asisten" color="var(--fg2)" />
          <button
            onClick={() => setOpen(!open)}
            disabled={total === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: total === 0 ? 'var(--fg2)' : 'var(--primary)',
              cursor: total === 0 ? 'default' : 'pointer',
              opacity: total === 0 ? 0.55 : 1,
            }}
          >
            {open ? 'Ocultar' : 'Ver quiénes'}
            <WIcon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
          </button>
        </div>
      </div>

      {open && total > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 22px 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {session.attendances.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <WIcon
                name={a.confirmed ? 'circle-check' : 'x'}
                size={15}
                style={{ color: a.confirmed ? 'var(--secondary)' : 'var(--fg2)' }}
              />
              <span style={{ color: 'var(--fg1)' }}>{a.familyUserName}</span>
              <span style={{ color: 'var(--fg2)', fontSize: 13 }}>
                {a.confirmed ? 'confirmó su asistencia' : 'avisó que no puede ir'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SesionesFamiliaresPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['family', 'sede-sessions'],
    queryFn: api.getSedeFamilySessions,
  })

  if (isLoading) {
    return <div style={{ padding: 32, color: 'var(--fg2)' }}>Cargando sesiones de tu sede…</div>
  }

  if (isError) {
    // 422 = la cuenta clínica no tiene sede asignada, que se arregla en Configuración
    const noSede = (error as { status?: number })?.status === 422
    return (
      <div style={{ padding: 32, color: 'var(--fg2)' }}>
        {noSede
          ? 'Tu cuenta no tiene una sede asignada, así que no podemos mostrar sus sesiones.'
          : 'No pudimos cargar las sesiones. Vuelve a intentarlo.'}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <div style={{ textAlign: 'center', color: 'var(--fg2)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: 'var(--fg1)', marginBottom: 6 }}>
            Sin sesiones agendadas
          </div>
          <div style={{ fontSize: 14 }}>Tu sede no tiene sesiones grupales de familiares próximas.</div>
        </div>
      </div>
    )
  }

  const totalConfirmed = data.reduce((sum, s) => sum + s.confirmedCount, 0)

  return (
    <div style={{ padding: '26px 32px 48px' }}>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--fg2)' }}>
        {data.length === 1 ? '1 sesión próxima' : `${data.length} sesiones próximas`} en tu sede
        {totalConfirmed > 0 && ` · ${totalConfirmed} confirmaciones de familiares`}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.map((s) => (
          <SessionRow key={s.id} session={s} />
        ))}
      </div>
    </div>
  )
}
