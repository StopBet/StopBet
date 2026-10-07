import { useSearchParams } from 'react-router-dom'

/**
 * El modo demo del registro y del login solo existe con `?demo=1` en la dirección (o corriendo la
 * web en desarrollo). Una familia real que abre `/registro-familiar` no ve nada distinto: el panel
 * solo escribe datos de prueba en el formulario, pero no tiene por qué aparecerle a nadie más.
 */
export function useModoDemo(): boolean {
  const [params] = useSearchParams()
  return import.meta.env.DEV || params.get('demo') === '1'
}
