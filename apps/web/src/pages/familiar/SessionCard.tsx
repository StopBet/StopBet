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

type AttendanceState = 'yes' | 'no' | 'unanswered'

// El estado y la acción de cambiarlo son la misma cosa, así que un interruptor los
// une en un solo control. Tiene tres apariencias, no dos: "sin responder" NO se
// dibuja como un rechazo. Si se dibujaran igual, el psicólogo vería como "avisó que
// no viene" a un familiar que todavía no abrió el portal.
function AttendanceToggle({
  state,
  onToggle,
  isPending,
}: {
  state: AttendanceState
  onToggle: () => void
  isPending: boolean
}) {
  const confirmed = state === 'yes'
  const pendingAnswer = state === 'unanswered'

  const accent = confirmed ? 'var(--secondary)' : 'var(--fg2)'
  const label = confirmed ? 'Asistiré' : pendingAnswer ? 'Sin responder' : 'No podré ir'
  const hint = pendingAnswer ? 'Toca para confirmar tu asistencia' : 'Toca para cambiar tu respuesta'

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <button
        type="button"
        role="switch"
        // "mixed" es el valor ARIA para un interruptor que todavía no tiene respuesta:
        // un lector de pantalla no debe anunciarlo como desactivado.
        aria-checked={pendingAnswer ? 'mixed' : confirmed}
        aria-label="Confirmar asistencia a la sesión"
        onClick={onToggle}
        disabled={isPending}
        style={{
          position: 'relative',
          width: 52,
          height: 30,
          flexShrink: 0,
          borderRadius: 999,
          border: confirmed
            ? '1px solid var(--secondary)'
            : pendingAnswer
              ? '1px dashed var(--fg2)'
              : '1px solid var(--border)',
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
            // Sin responder: el botón queda al medio, para no confundirse con el "no".
            left: confirmed ? 24 : pendingAnswer ? 14 : 3,
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
          <WIcon name={confirmed ? 'check' : pendingAnswer ? 'clock' : 'x'} size={13} />
        </span>
      </button>

      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: accent }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--fg2)' }}>{isPending ? 'Guardando…' : hint}</div>
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
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 9 }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, color: 'var(--fg1)' }}>
              {session.title}
            </h3>
            {session.isMandatory && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'var(--surface-alt)',
                  color: 'var(--primary)',
                  border: '1px solid var(--primary)',
                  borderRadius: 999,
                  padding: '2px 10px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                  whiteSpace: 'nowrap',
                }}
              >
                <WIcon name="flag" size={11} />
                Obligatoria
              </span>
            )}
          </div>
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

      <AttendanceToggle
        state={session.userAttends === null ? 'unanswered' : session.userAttends ? 'yes' : 'no'}
        onToggle={() => onRespond(session.userAttends !== true)}
        isPending={isPending}
      />

      {/* Sin --danger: la regla clínica lo reserva para el botón de pánico, así que
          el aviso de una obligatoria rechazada va en el azul de marca. */}
      {session.isMandatory && (
        <div
          style={{
            display: 'flex',
            gap: 9,
            alignItems: 'flex-start',
            background: 'var(--surface-alt)',
            borderRadius: 12,
            padding: '11px 13px',
          }}
        >
          <span style={{ flexShrink: 0, color: 'var(--primary)', marginTop: 1 }}>
            <WIcon name="circle-alert" size={15} />
          </span>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)', lineHeight: 1.55 }}>
            {session.userAttends === false
              ? 'Esta sesión es parte del tratamiento de tu familiar. Le avisamos a su profesional que no podrás asistir.'
              : 'Esta sesión es parte del tratamiento de tu familiar, así que te corresponde asistir. Si no puedes, avísanos con tiempo.'}
          </p>
        </div>
      )}
    </article>
  )
}
