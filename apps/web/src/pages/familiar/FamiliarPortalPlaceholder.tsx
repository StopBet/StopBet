import { useQuery } from '@tanstack/react-query'
import { api, type AuthUser, type FamilyLinkState } from '../../services/api'

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER — Alex (HU-11)
//
// Esta pantalla existe solo para cerrar el CA 11.2: el familiar inicia sesión y
// aterriza en una vista propia con su sesión JWT ya funcionando. Reemplázala por
// el portal real (CA 11.1 calendario de sesiones, 11.3 confirmar asistencia,
// 11.5 estado vacío, 11.6 cuenta pendiente de vinculación).
//
// Lo que ya está resuelto y puedes usar:
//   - api.getFamilyLinkStatus()  → GET /family/link-status
//   - El token se manda solo en toda llamada de api.ts; no hace falta pasarlo.
//   - Para agregar endpoints nuevos (/family/sessions, etc.), sigue el patrón
//     del final de services/api.ts.
// ─────────────────────────────────────────────────────────────────────────────

const LINK_LABEL: Record<FamilyLinkState, string> = {
  active: 'Vínculo activo con tu paciente',
  pending: 'Tu cuenta está pendiente de vinculación',
  unlinked: 'Todavía no estás vinculado a ningún paciente',
}

export function FamiliarPortalPlaceholder({
  user,
  onLogout,
}: {
  user: AuthUser
  onLogout: () => void
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['family', 'link-status'],
    queryFn: api.getFamilyLinkStatus,
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '48px 24px' }}>
      <div
        style={{
          maxWidth: 560,
          margin: '0 auto',
          background: 'var(--surface)',
          borderRadius: 20,
          boxShadow: 'var(--shadow-soft)',
          padding: 32,
        }}
      >
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, color: 'var(--fg1)', margin: 0 }}>
          Hola, {user.firstName}
        </h1>
        <p style={{ color: 'var(--fg2)', marginTop: 8, marginBottom: 24 }}>
          Portal de familiares de AJUTER
        </p>

        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            color: 'var(--fg1)',
          }}
        >
          {isLoading && 'Cargando tu estado…'}
          {isError && 'No pudimos cargar tu estado. Intenta nuevamente más tarde.'}
          {data && LINK_LABEL[data.status]}
        </div>

        <p style={{ color: 'var(--fg2)', fontSize: 14, marginBottom: 24 }}>
          Pronto verás aquí el calendario de sesiones grupales de tu sede y podrás confirmar tu
          asistencia.
        </p>

        <button
          onClick={onLogout}
          style={{
            background: 'transparent',
            border: '1px solid var(--fg2)',
            color: 'var(--fg2)',
            borderRadius: 10,
            padding: '10px 18px',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
