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

function AttendanceBadge({ confirmed }: { confirmed: boolean }) {
  const color = confirmed ? 'var(--secondary)' : 'var(--fg2)'
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: confirmed ? 'var(--sage-50, #EDF3ED)' : 'var(--bg)',
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: '5px 12px',
        fontSize: 12.5,
        fontWeight: 600,
        color,
      }}
    >
      <WIcon name={confirmed ? 'circle-check' : 'x'} size={14} />
      {confirmed ? 'Confirmaste tu asistencia' : 'Avisaste que no puedes ir'}
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
            {session.isOnline ? `Online — ${session.location}` : session.location}
          </div>
        </div>
      </div>

      {answered ? (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <AttendanceBadge confirmed={session.userAttends === true} />
          <button
            onClick={() => onRespond(!session.userAttends)}
            disabled={isPending}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: isPending ? 'wait' : 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Cambiar respuesta
          </button>
        </div>
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
