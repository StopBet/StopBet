import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { WIcon } from '../../components/WIcon'
import { api, type AuthUser, type FamilySessionsResponse } from '../../services/api'
import { BillingCard } from './BillingCard'
import { PaymentPage } from './PaymentPage'
import { SettingsPage } from './SettingsPage'
import { useBrandInShell } from '../../hooks/useBrandInShell'
import { Notice, Shell } from './Shell'
import { SessionCard } from './SessionCard'
import { SessionCalendar } from './SessionCalendar'
import { useIsWide } from './useIsWide'

const SESSIONS_KEY = ['family', 'sessions']

export function FamiliarPortal({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  useBrandInShell(user)
  return (
    <Routes>
      <Route index element={<SessionsHome user={user} onLogout={onLogout} />} />
      <Route path="pago" element={<PaymentPage user={user} onLogout={onLogout} />} />
      <Route path="ajustes" element={<SettingsPage user={user} onLogout={onLogout} />} />
      <Route path="*" element={<Navigate to="/familiar" replace />} />
    </Routes>
  )
}

function SessionsHome({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const queryClient = useQueryClient()
  const isWide = useIsWide()

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
            style={{ background: 'none', border: 'none', color: 'var(--primary-text)', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 14 }}
          >
            Reintentar
          </button>
        </Notice>
      </Shell>
    )
  }

  // CA 11.6 - la cuenta existe pero todavía no está asociada a un paciente
  if (data.linkStatus === 'pending') {
    return (
      <Shell user={user} onLogout={onLogout}>
        <Notice icon="clock" title="Tu cuenta está pendiente de vinculación">
          Un profesional del equipo clínico debe aprobar tu vínculo con el paciente. Cuando lo haga
          verás aquí las sesiones grupales de su sede.
        </Notice>
      </Shell>
    )
  }

  if (data.linkStatus === 'unlinked') {
    return (
      <Shell user={user} onLogout={onLogout}>
        <Notice icon="circle-alert" title="Todavía no estás vinculado a un paciente">
          Pídele al equipo clínico que registre el vínculo con tu correo. Sin esa
          vinculación no podemos mostrarte las sesiones.
        </Notice>
      </Shell>
    )
  }

  // HDU 23, CA3 - el psicólogo revisó la solicitud y no confirmó el vínculo declarado
  if (data.linkStatus === 'rejected') {
    return (
      <Shell user={user} onLogout={onLogout}>
        <Notice icon="circle-alert" title="Tu solicitud de vinculación no fue aprobada">
          El equipo clínico revisó tu solicitud y no pudo confirmar el vínculo con el paciente
          declarado. Si crees que esto es un error, contacta directamente al equipo clínico de tu sede.
        </Notice>
      </Shell>
    )
  }

  // HDU 23, CA5 - tenías acceso y el equipo clínico lo retiró
  if (data.linkStatus === 'revoked') {
    return (
      <Shell user={user} onLogout={onLogout}>
        <Notice icon="circle-alert" title="Tu acceso como familiar fue retirado">
          El equipo clínico retiró tu vínculo con el paciente. Si crees que esto es un error,
          contacta directamente al equipo clínico de tu sede.
        </Notice>
      </Shell>
    )
  }

  // CA 11.5 - sin ninguna sesión dentro de las próximas 4 semanas
  if (!data.hasUpcoming) {
    return (
      <Shell user={user} onLogout={onLogout}>
        <Notice icon="calendar" title="No hay sesiones programadas próximamente">
          Tu sede no tiene sesiones grupales de familiares en las próximas 4 semanas. Te avisaremos
          apenas se agende una.
        </Notice>

        <div style={{ marginTop: 20 }}>
          <BillingCard />
        </div>

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

  // CA 11.1 + 11.3 + 11.4 - sesiones de la sede, ordenadas por proximidad.
  // Se muestran en dos bloques: arriba la agenda de la sede, donde se responde;
  // abajo, en calendario, la agenda propia del familiar. Las obligatorias entran
  // aunque no haya respondido: le corresponden igual, esa es la diferencia.
  const agenda = data.sessions.filter((s) => s.userAttends === true || s.isMandatory)

  return (
    <Shell user={user} onLogout={onLogout} maxWidth={isWide ? 1140 : 720}>
      <div
        style={{
          display: 'grid',
          // En pantalla ancha van lado a lado; en teléfono el grid colapsa a una sola
          // columna y queda el mismo orden de lectura que antes.
          gridTemplateColumns: isWide ? 'minmax(0, 1fr) 372px' : '1fr',
          gap: isWide ? 32 : 38,
          alignItems: 'start',
        }}
      >
        <section>
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
        </section>

        {/* Pegajoso solo en pantalla ancha: la lista de la izquierda es más larga que
            el calendario, y sin esto la columna derecha deja un hueco al hacer scroll. */}
        <section style={isWide ? { position: 'sticky', top: 24 } : undefined}>
          <div style={{ marginBottom: 28 }}>
            <BillingCard />
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
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
              <span style={{ flexShrink: 0, color: 'var(--primary-text)', marginTop: 1 }}>
                <WIcon name="calendar" size={20} />
              </span>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6 }}>
                Todavía no confirmaste tu asistencia a ninguna sesión. Cuando lo hagas, aparecerán acá
                en tu calendario.
              </p>
            </div>
          )}
        </section>
      </div>
    </Shell>
  )
}
