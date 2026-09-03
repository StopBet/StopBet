import { useEffect, useState } from 'react'

// El portal usa estilos en línea, que no admiten media queries, así que el layout
// se decide en JS igual que en el resto del dashboard.
//
// No reutiliza `useIsNarrow` a propósito: ese corta en 860px, y a esa altura las dos
// columnas del portal (lista de sesiones + calendario) quedan demasiado angostas.
// El calendario necesita ~360px para que la cuadrícula de 7 días no se apriete, así
// que las columnas recién se justifican pasados los 1024px. Cambiar el corte del hook
// compartido movería el layout de las otras ocho vistas que lo usan.
const WIDE = '(min-width: 1024px)'

export function useIsWide(): boolean {
  const [isWide, setIsWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(WIDE).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(WIDE)
    const onChange = (e: MediaQueryListEvent) => setIsWide(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isWide
}
