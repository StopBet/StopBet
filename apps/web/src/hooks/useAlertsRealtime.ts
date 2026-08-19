import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// 4.1: alertas de pánico visibles sin recargar. Se conecta al SSE del backend
// (GET /panic/alerts/stream) e invalida la query de alertas al recibir un evento.
// Si el SSE falla (red, proxy, endpoint aún no registrado en panic.module.ts) no
// rompe nada — el refetchInterval de la propia query de alertas sigue trayendo
// datos nuevos como red de seguridad.
export function useAlertsRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const source = new EventSource(`${BASE}/panic/alerts/stream`)

    source.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    }
    source.onerror = () => {
      source.close()
    }

    return () => source.close()
  }, [queryClient])
}