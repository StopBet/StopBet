import { useIsNarrow } from '../hooks/useIsNarrow'
// La sección sigue viviendo en SolicitudesPage.tsx para no mover código que Comunidad edita seguido.
import { FlaggedPostsSection } from './SolicitudesPage'

export function ModeracionPage() {
  const isNarrow = useIsNarrow()
  return (
    <div style={{ padding: isNarrow ? '16px 12px 28px' : 32, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <FlaggedPostsSection />
    </div>
  )
}
