import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WIcon } from '../../components/WIcon'
import { api, type AuthUser, type FamilySessionsResponse } from '../../services/api'
import { SessionCard } from './SessionCard'
import { SessionCalendar } from './SessionCalendar'

const SESSIONS_KEY = ['family', 'sessions']

function Shell({ user, onLogout, children }: { user: AuthUser; onLogout: () => void; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--ajuter-gradient)', padding: '26px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, color: '#fff' }}>
              Hola, {user.firstName}
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'rgba(255,255,255,0.88)' }}>
              Portal de familiares de AJUTER
            </p>
          </div>
          <button
            onClick={onLogout}
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.45)',
              color: '#fff',
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px 64px' }}>{children}</main>
    </div>
  )
}

function Notice({
  icon,
  title,
  children,
}: {
  icon: 'clock' | 'circle-alert' | 'calendar'
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-soft)',
        padding: '28px 26px',
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: 'var(--surface-alt)',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <WIcon name={icon} size={20} />
      </div>
      <div>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, color: 'var(--fg1)' }}>
          {title}
        </h2>
        <p style={{ margin: '7px 0 0', fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6 }}>{children}</p>
      </div>
    </div>
  )
}

export function FamiliarPortal({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: api.getFamilySessions,
  })

  const respond = useMutation({
    mutationFn: ({ sessionId, confirmed }: { sessionId: string; confirmed: boolean }) =>
      api.confirmAttendance(sessionId, confirmed),
    // Se pinta al instante: el criterio pide que la tarjeta refleje la respuesta
    // en menos de 3 s y la confirmación real tarda ~70 ms.
    onMutate: async ({ sessionId, confirmed }) => {
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY })
      const previous = queryClient.getQueryData<FamilySessionsResponse>(SESSIONS_KEY)
      if (previous) {
        queryClient.setQueryData<FamilySessionsResponse>(SESSIONS_KEY, {
          ...previous,
          sessions: previous.sessions.map((s) =>
            s.id === sessionId ? { ...s, userAttends: confirmed } : s,
          ),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(SESSIONS_KEY, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY })
    },
  })

  if (isLoading) {
    return (
      <Shell user={user} onLogout={onLogout}>
        <p style={{ color: 'var(--fg2)' }}>Cargando tus sesiones…</p>
      </Shell>
    )
  }

  if (isError || !data) {
    return (
      <Shell user={user} onLogout={onLogout}>
        <Notice icon="circle-alert" title="No pudimos cargar tus sesiones">
          Revisa tu conexión y vuelve a intentarlo.{' '}
          <button
            onClick={() => refetch()}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 14 }}
          >
            Reintentar
          </button>
        </Notice>
      </Shell>
    )
  }

  // CA 11.6 — la cuenta existe pero todavía no está asociada a un paciente
  if (data.linkStatus === 'pending') {
    return (
      <Shell user={user} onLogout={onLogout}>
        <Notice icon="clock" title="Tu cuenta está pendiente de vinculación">
          Un profesional de AJUTER debe aprobar tu vínculo con el paciente. Cuando lo haga verás aquí
          las sesiones grupales de su sede.
        </Notice>
      </Shell>
    )
  }

  if (data.linkStatus === 'unlinked') {
    return (
      <Shell user={user} onLogout={onLogout}>
        <Notice icon="circle-alert" title="Todavía no estás vinculado a un paciente">
          Pídele a tu profesional de AJUTER que registre el vínculo con tu correo. Sin esa
          vinculación no podemos mostrarte las sesiones.
        </Notice>
      </Shell>
    )
  }

  // CA 11.5 — sin ninguna sesión dentro de las próximas 4 semanas
  if (!data.hasUpcoming) {
    return (
      <Shell user={user} onLogout={onLogout}>
        <Notice icon="calendar" title="No hay sesiones programadas próximamente">
          Tu sede no tiene sesiones grupales de familiares en las próximas 4 semanas. Te avisaremos
          apenas se agende una.
        </Notice>

        {data.sessions.length > 0 && (
          <>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--fg2)', margin: '32px 0 14px' }}>
              Más adelante
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  isPending={respond.isPending && respond.variables?.sessionId === s.id}
                  onRespond={(confirmed) => respond.mutate({ sessionId: s.id, confirmed })}
                />
              ))}
            </div>
          </>
        )}
      </Shell>
    )
  }

  // CA 11.1 + 11.3 + 11.4 — sesiones de la sede, ordenadas por proximidad.
  // Se muestran en dos bloques: arriba la agenda de la sede, donde se responde;
  // abajo, en calendario, la agenda propia del familiar. Las obligatorias entran
  // aunque no haya respondido: le corresponden igual, esa es la diferencia.
  const agenda = data.sessions.filter((s) => s.userAttends === true || s.isMandatory)

  return (
    <Shell user={user} onLogout={onLogout}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, color: 'var(--fg1)' }}>
          Próximas sesiones
        </h2>
        <span style={{ fontSize: 13, color: 'var(--fg2)' }}>
          {data.sessions.length === 1 ? '1 sesión' : `${data.sessions.length} sesiones`}
        </span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--fg2)' }}>
        Sesiones grupales de tu sede. Confirma si vas a asistir.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            isPending={respond.isPending && respond.variables?.sessionId === s.id}
            onRespond={(confirmed) => respond.mutate({ sessionId: s.id, confirmed })}
          />
        ))}
      </div>

      {respond.isError && (
        <p style={{ marginTop: 16, fontSize: 13.5, color: 'var(--fg2)' }}>
          No pudimos guardar tu respuesta. Vuelve a intentarlo.
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, margin: '38px 0 6px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, color: 'var(--fg1)' }}>
          Mis sesiones
        </h2>
        <span style={{ fontSize: 13, color: 'var(--fg2)' }}>
          {agenda.length === 1 ? '1 sesión' : `${agenda.length} sesiones`}
        </span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--fg2)' }}>
        Tu calendario: las sesiones que confirmaste y las obligatorias del tratamiento de tu familiar.
      </p>

      {agenda.length > 0 ? (
        <SessionCalendar sessions={agenda} />
      ) : (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-soft)',
            padding: '24px 22px',
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
          }}
        >
          <span style={{ flexShrink: 0, color: 'var(--primary)', marginTop: 1 }}>
            <WIcon name="calendar" size={20} />
          </span>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6 }}>
            Todavía no confirmaste tu asistencia a ninguna sesión. Cuando lo hagas, aparecerán acá en
            tu calendario.
          </p>
        </div>
      )}
    </Shell>
  )
}
