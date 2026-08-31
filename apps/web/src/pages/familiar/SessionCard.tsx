import { WIcon } from '../../components/WIcon'
import type { FamilySession } from '../../services/api'

const DATE_FMT = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

// hour12 explícito: sin esto el navegador del teléfono renderiza "07:00 p. m."
// y el sufijo "h" quedaba pegado detrás. En Chile la hora va en formato 24.
const TIME_FMT = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Reemplaza al enlace "Cambiar respuesta": el estado y la acción de cambiarlo son
// la misma cosa, así que un interruptor los une en un solo control en vez de
// obligar a leer una insignia y buscar un enlace aparte.
function AttendanceToggle({
  confirmed,
  onToggle,
  isPending,
}: {
  confirmed: boolean
  onToggle: () => void
  isPending: boolean
}) {
  const accent = confirmed ? 'var(--secondary)' : 'var(--fg2)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <button
        type="button"
        role="switch"
        aria-checked={confirmed}
        aria-label="Confirmar asistencia a la sesión"
        onClick={onToggle}
        disabled={isPending}
        style={{
          position: 'relative',
          width: 52,
          height: 30,
          flexShrink: 0,
          borderRadius: 999,
          border: `1px solid ${confirmed ? 'var(--secondary)' : 'var(--border)'}`,
          background: confirmed ? 'var(--secondary)' : 'var(--surface-alt)',
          cursor: isPending ? 'wait' : 'pointer',
          opacity: isPending ? 0.6 : 1,
          padding: 0,
          transition: 'background .18s ease, border-color .18s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: confirmed ? 24 : 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,.28)',
            display: 'grid',
            placeItems: 'center',
            color: accent,
            transition: 'left .18s ease',
          }}
        >
          <WIcon name={confirmed ? 'check' : 'x'} size={13} />
        </span>
      </button>

      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: accent }}>
          {confirmed ? 'Asistiré' : 'No podré ir'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg2)' }}>
          {isPending ? 'Guardando…' : 'Toca para cambiar tu respuesta'}
        </div>
      </div>
    </div>
  )
}

export function SessionCard({
  session,
  onRespond,
  isPending,
}: {
  session: FamilySession
  onRespond: (confirmed: boolean) => void
  isPending: boolean
}) {
  const date = new Date(session.sessionDate)
  const answered = session.userAttends !== null

  return (
    <article
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-soft)',
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            flexShrink: 0,
            width: 54,
            textAlign: 'center',
            background: 'var(--surface-alt)',
            borderRadius: 12,
            padding: '8px 0',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--fg2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {new Intl.DateTimeFormat('es-CL', { month: 'short' }).format(date).replace('.', '')}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, color: 'var(--fg1)', lineHeight: 1.1 }}>
            {date.getDate()}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, color: 'var(--fg1)' }}>
            {session.title}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 7, fontSize: 13.5, color: 'var(--fg2)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <WIcon name="calendar" size={14} />
              {capitalize(DATE_FMT.format(date))}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <WIcon name="clock" size={14} />
              {TIME_FMT.format(date)} h
            </span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 13.5, color: 'var(--fg2)' }}>
            <WIcon name={session.isOnline ? 'message-circle' : 'map-pin'} size={14} />
            {session.isOnline ? `Online - ${session.location}` : session.location}
          </div>
        </div>
      </div>

      {answered ? (
        <AttendanceToggle
          confirmed={session.userAttends === true}
          onToggle={() => onRespond(!session.userAttends)}
          isPending={isPending}
        />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            onClick={() => onRespond(true)}
            disabled={isPending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: isPending ? 'wait' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <WIcon name="check" size={16} />
            Confirmar asistencia
          </button>
          {/* Sin --danger: la regla clínica lo reserva para el botón de pánico */}
          <button
            onClick={() => onRespond(false)}
            disabled={isPending}
            style={{
              background: 'transparent',
              color: 'var(--fg2)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: isPending ? 'wait' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            No podré ir
          </button>
        </div>
      )}
    </article>
  )
}
