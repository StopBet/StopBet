import { useLayoutEffect } from 'react'
import { applyBrandPref, defaultBrandFor, readBrandPref } from '../utils/theme'

// Pone los colores de la institución mientras la vista con sesión está montada y los saca al
// desmontarse, para que al cerrar sesión el login vuelva a StopBet. Layout effect: se aplica
// antes del primer pintado del shell, sin un destello azul.
// Si la persona nunca eligió en Apariencia, arranca con los colores de su institución.
export function useBrandInShell(user: { role: string; institutionId?: string | null }) {
  const { role, institutionId } = user
  useLayoutEffect(() => {
    applyBrandPref(readBrandPref() ?? defaultBrandFor({ role, institutionId }))
    return () => applyBrandPref('stopbet')
  }, [role, institutionId])
}
