import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignSponsor,
  getAvailableSponsors,
  getCurrentSponsor,
} from '../services/api'

// HdU20. Se cuelga del perfil del paciente con una línea; toda la lógica vive acá para
// no engordar la página, que es de otra rama.
export function SeccionCompaneroViaje({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient()
  const [eligiendo, setEligiendo] = useState(false)
  const [seleccion, setSeleccion] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: actual, isLoading } = useQuery({
    queryKey: ['sponsor-actual', patientId],
    queryFn: () => getCurrentSponsor(patientId),
  })

  // Los candidatos solo se piden cuando el psicólogo abre el selector: la lista no le
  // sirve de nada mientras solo está mirando la ficha.
  const { data: candidatos = [], isLoading: cargandoCandidatos } = useQuery({
    queryKey: ['sponsors-disponibles', patientId],
    queryFn: () => getAvailableSponsors(patientId),
    enabled: eligiendo,
  })

  const asignar = useMutation({
    mutationFn: () => assignSponsor(patientId, seleccion),
    onSuccess: () => {
      setEligiendo(false)
      setSeleccion('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['sponsor-actual', patientId] })
      queryClient.invalidateQueries({ queryKey: ['sponsors-disponibles', patientId] })
    },
    onError: (e: Error & { body?: { message?: string } }) => {
      setError(e.body?.message ?? 'No se pudo asignar. Inténtalo de nuevo.')
    },
  })

  const reemplaza = Boolean(actual)
  const elegido = candidatos.find((c) => c.id === seleccion)

  return (
    <section style={tarjeta}>
      <h3 style={{ ...titulo, fontSize: 15, marginBottom: 10 }}>
        Compañero de viaje
      </h3>

      {isLoading ? (
        <p style={textoSecundario}>Cargando…</p>
      ) : actual ? (
        <p style={{ ...textoPrincipal, margin: '0 0 12px' }}>
          {actual.firstName} {actual.lastName}
        </p>
      ) : (
        // CA20.4: no basta con decir que no tiene. Hay que explicar qué pasa con sus
        // alertas de pánico mientras siga así.
        <div style={aviso}>
          <p style={{ ...textoPrincipal, margin: '0 0 4px', fontWeight: 600 }}>
            Sin compañero de viaje asignado
          </p>
          <p style={{ ...textoSecundario, margin: 0 }}>
            Si activa el botón de pánico, la alerta se deriva directamente al
            asistente virtual en vez de a una persona.
          </p>
        </div>
      )}

      {!eligiendo ? (
        <button
          type="button"
          onClick={() => {
            setEligiendo(true)
            setError(null)
          }}
          style={botonPrimario}
        >
          {reemplaza ? 'Reemplazar' : 'Asignar compañero de viaje'}
        </button>
      ) : (
        <div style={{ marginTop: 12 }}>
          <label
            htmlFor="companero-viaje"
            style={{ ...textoSecundario, display: 'block', marginBottom: 6 }}
          >
            Elige a alguien de la sede del paciente
          </label>
          <select
            id="companero-viaje"
            value={seleccion}
            onChange={(e) => setSeleccion(e.target.value)}
            disabled={cargandoCandidatos}
            style={campo}
          >
            <option value="">
              {cargandoCandidatos ? 'Cargando…' : 'Selecciona…'}
            </option>
            {candidatos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>

          {!cargandoCandidatos && candidatos.length === 0 && (
            <p style={{ ...textoSecundario, marginTop: 8 }}>
              No hay nadie designado como compañero de viaje en esta sede.
              Primero hay que designar a alguien.
            </p>
          )}

          {/* CA20.3: el reemplazo se confirma, y diciendo a quién se reemplaza. */}
          {reemplaza && elegido && (
            <p style={{ ...textoSecundario, marginTop: 10 }}>
              Vas a reemplazar a <strong>{actual!.firstName} {actual!.lastName}</strong>{' '}
              por <strong>{elegido.firstName} {elegido.lastName}</strong>. El
              registro del anterior se conserva.
            </p>
          )}

          {error && (
            <p role="alert" style={{ ...textoSecundario, color: 'var(--danger-text)', marginTop: 10 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => asignar.mutate()}
              disabled={!seleccion || asignar.isPending}
              style={{
                ...botonPrimario,
                opacity: !seleccion || asignar.isPending ? 0.5 : 1,
              }}
            >
              {asignar.isPending
                ? 'Guardando…'
                : reemplaza
                  ? 'Confirmar reemplazo'
                  : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEligiendo(false)
                setSeleccion('')
                setError(null)
              }}
              style={botonSecundario}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

const tarjeta: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '16px 18px',
  boxShadow: 'var(--shadow-soft)',
}

const titulo: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 700,
  color: 'var(--fg1)',
  margin: 0,
}

const textoPrincipal: React.CSSProperties = { color: 'var(--fg1)', fontSize: 14 }
const textoSecundario: React.CSSProperties = { color: 'var(--fg2)', fontSize: 13 }

const aviso: React.CSSProperties = {
  background: 'var(--surface-alt)',
  border: '1px solid var(--border-200)',
  borderRadius: 10,
  padding: '10px 12px',
  marginBottom: 12,
}

const campo: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--fg1)',
  fontSize: 14,
}

const botonPrimario: React.CSSProperties = {
  background: 'var(--primary)',
  color: 'var(--primary-text)',
  border: 'none',
  borderRadius: 10,
  padding: '9px 14px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

const botonSecundario: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--fg2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '9px 14px',
  fontSize: 14,
  cursor: 'pointer',
}
