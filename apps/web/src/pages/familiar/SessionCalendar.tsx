import { useMemo, useState } from 'react'
import { WIcon } from '../../components/WIcon'
import type { FamilySession } from '../../services/api'

const MONTH_FMT = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' })

const TIME_FMT = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const LONG_DATE_FMT = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

// La inicial sola se repite entre martes y miércoles, así que el nombre completo
// va en el title para que un lector de pantalla no lea dos "M" seguidas.
const WEEKDAYS = [
  { short: 'L', long: 'lunes' },
  { short: 'M', long: 'martes' },
  { short: 'M', long: 'miércoles' },
  { short: 'J', long: 'jueves' },
  { short: 'V', long: 'viernes' },
  { short: 'S', long: 'sábado' },
  { short: 'D', long: 'domingo' },
]

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

export function SessionCalendar({ sessions }: { sessions: FamilySession[] }) {
  const today = new Date()

  // Se abre en el mes de la próxima sesión confirmada, no en el mes actual: si la
  // única sesión es en tres semanas y cae en el mes siguiente, abrir en el actual
  // muestra un calendario vacío y parece que no hubiera nada.
  const initialMonth = useMemo(() => {
    const upcoming = sessions
      .map((s) => new Date(s.sessionDate))
      .filter((d) => d.getTime() >= today.getTime())
      .sort((a, b) => a.getTime() - b.getTime())[0]
    const anchor = upcoming ?? (sessions.length > 0 ? new Date(sessions[0].sessionDate) : today)
    return new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    // Se calcula una sola vez: recalcularlo al cambiar de mes revertiría la navegación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [cursor, setCursor] = useState(initialMonth)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  // Día de la semana de la primera fecha, corrido para que la semana parta en lunes.
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const sessionsOfMonth = useMemo(
    () =>
      sessions
        .map((s) => ({ session: s, date: new Date(s.sessionDate) }))
        .filter((x) => x.date.getFullYear() === year && x.date.getMonth() === month)
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [sessions, year, month],
  )

  // Solo llegan acá las confirmadas y las obligatorias, así que un `false` implica
  // una obligatoria rechazada. La leyenda de ese caso se muestra solo si existe.
  const hasDeclinedMandatory = sessionsOfMonth.some((x) => x.session.userAttends === false)

  const byDay = useMemo(() => {
    const map = new Map<number, typeof sessionsOfMonth>()
    for (const item of sessionsOfMonth) {
      const day = item.date.getDate()
      map.set(day, [...(map.get(day) ?? []), item])
    }
    return map
  }, [sessionsOfMonth])

  const cells: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const shiftMonth = (delta: number) => setCursor(new Date(year, month + delta, 1))

  const navButton = (label: string, icon: 'chevron-left' | 'chevron-right', delta: number) => (
    <button
      type="button"
      onClick={() => shiftMonth(delta)}
      aria-label={label}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--fg2)',
        cursor: 'pointer',
      }}
    >
      <WIcon name={icon} size={16} />
    </button>
  )

  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-soft)',
        padding: 22,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h3
          aria-live="polite"
          style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--fg1)' }}
        >
          {capitalize(MONTH_FMT.format(cursor))}
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {navButton('Mes anterior', 'chevron-left', -1)}
          {navButton('Mes siguiente', 'chevron-right', 1)}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          Sesiones que confirmaste en {MONTH_FMT.format(cursor)}
        </caption>
        <thead>
          <tr>
            {WEEKDAYS.map((d, i) => (
              <th
                key={i}
                scope="col"
                style={{
                  padding: '0 0 10px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--fg2)',
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                }}
              >
                <abbr title={d.long} style={{ textDecoration: 'none' }}>
                  {d.short}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (day === null) return <td key={di} style={{ padding: 2 }} />

                const dayDate = new Date(year, month, day)
                const items = byDay.get(day)
                const hasSession = items !== undefined
                // Verde relleno solo si confirmó. Una obligatoria sin confirmar sigue
                // ocupando el día, pero se distingue en contorno para no dar a entender
                // que ya respondió que sí.
                const anyConfirmed = items?.some((x) => x.session.userAttends === true) ?? false
                const anyPending = items?.some((x) => x.session.userAttends === null) ?? false
                const isToday = sameDay(dayDate, today)

                // Relleno verde = voy. Relleno azul = obligatoria, me corresponde igual.
                // Contorno azul = obligatoria que rechacé. Hoy va en gris relleno y nunca
                // en contorno, para no confundirse con la obligatoria rechazada.
                const tone: 'confirmed' | 'mandatory' | 'declined' | 'today' | 'plain' = anyConfirmed
                  ? 'confirmed'
                  : hasSession && anyPending
                    ? 'mandatory'
                    : hasSession
                      ? 'declined'
                      : isToday
                        ? 'today'
                        : 'plain'

                const background =
                  tone === 'confirmed'
                    ? 'var(--secondary)'
                    : tone === 'mandatory'
                      ? 'var(--primary)'
                      : tone === 'today'
                        ? 'var(--surface-alt)'
                        : 'transparent'
                const color =
                  tone === 'confirmed' || tone === 'mandatory'
                    ? '#fff'
                    : tone === 'declined'
                      ? 'var(--primary)'
                      : 'var(--fg1)'
                const border =
                  tone === 'declined' ? '1px solid var(--primary)' : '1px solid transparent'

                return (
                  <td key={di} style={{ padding: 2, textAlign: 'center' }}>
                    <div
                      title={hasSession ? items.map((x) => x.session.title).join(' · ') : undefined}
                      style={{
                        margin: '0 auto',
                        width: 34,
                        height: 34,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '50%',
                        fontSize: 13.5,
                        fontWeight: hasSession ? 700 : 500,
                        background,
                        color,
                        border,
                      }}
                    >
                      {day}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: 14, fontSize: 12, color: 'var(--fg2)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--secondary)' }} />
          Confirmaste asistencia
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--primary)' }} />
          Obligatoria sin responder
        </span>
        {hasDeclinedMandatory && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid var(--primary)' }} />
            Obligatoria, avisaste que no irás
          </span>
        )}
      </div>

      <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        {sessionsOfMonth.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--fg2)' }}>
            No confirmaste sesiones en este mes.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {sessionsOfMonth.map(({ session, date }) => (
              <li key={session.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    flexShrink: 0,
                    color: session.userAttends === true ? 'var(--secondary)' : 'var(--primary)',
                    marginTop: 2,
                  }}
                >
                  <WIcon name={session.userAttends === true ? 'circle-check' : 'flag'} size={18} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--fg1)' }}>{session.title}</span>
                    {session.isMandatory && (
                      <span
                        style={{
                          color: 'var(--primary)',
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '.05em',
                        }}
                      >
                        Obligatoria
                      </span>
                    )}
                  </div>
                  {session.userAttends !== true && (
                    <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--fg2)', fontStyle: 'italic' }}>
                      {session.userAttends === false
                        ? 'Avisaste que no podrás asistir'
                        : 'Todavía no respondes'}
                    </div>
                  )}
                  <div style={{ marginTop: 3, fontSize: 13, color: 'var(--fg2)' }}>
                    {capitalize(LONG_DATE_FMT.format(date))} · {TIME_FMT.format(date)} h
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 13,
                      color: 'var(--fg2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <WIcon name={session.isOnline ? 'message-circle' : 'map-pin'} size={13} />
                    {session.isOnline ? `Online - ${session.location}` : session.location}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
