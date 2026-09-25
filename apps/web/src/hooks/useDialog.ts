import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Los modales eran divs sueltos: no se cerraban con Escape, el foco se quedaba en la página
// de atrás y un lector de pantalla no se enteraba de que había un diálogo. Este hook da lo
// mínimo: foco inicial adentro, Tab que no se escapa, Escape que cierra y, al cerrar, el foco
// de vuelta donde estaba. El que lo usa pone role="dialog", aria-modal y tabIndex={-1}.
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      const node = ref.current
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [])

  return ref
}
