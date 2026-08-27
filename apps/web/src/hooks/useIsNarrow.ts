import { useEffect, useState } from 'react'

// Las páginas usan estilos en línea, que no admiten media queries. Este hook
// permite decidir el layout en JS con el mismo corte en todas las vistas.
const NARROW = '(max-width: 860px)'

export function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isNarrow
}
