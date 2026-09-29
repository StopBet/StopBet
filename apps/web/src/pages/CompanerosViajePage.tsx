import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import {
  designateSponsor,
  getDesignatedSponsors,
  getSponsorCandidates,
  revokeSponsor,
  type SponsorCandidate,
  type SponsorWithLoad,
} from '../services/api'

// HdU21. Designar es una decisión de sede, no de un paciente en particular: por eso vive
// en su propia página y no colgando de una ficha.
export function CompanerosViajePage() {
  const qc = useQueryClient()
  const [aRevocar, setARevocar] = useState<SponsorWithLoad | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: designados = [], isLoading: cargandoDesignados } = useQuery({
    queryKey: ['sponsors-designados'],
    queryFn: getDesignatedSponsors,
  })

  const { data: candidatos = [], isLoading: cargandoCandidatos } = useQuery({
    queryKey: ['sponsors-candidatos'],
    queryFn: getSponsorCandidates,
  })

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['sponsors-designados'] })
    qc.invalidateQueries({ queryKey: ['sponsors-candidatos'] })
  }

  const designar = useMutation({
    mutationFn: designateSponsor,
    onSuccess: () => { setError(null); refrescar() },
    onError: (e: Error & { body?: { message?: string } }) =>
      setError(e.body?.message ?? 'No se pudo designar. Inténtalo de nuevo.'),
  })

  const revocar = useMutation({
    mutationFn: revokeSponsor,
    onSuccess: () => { setARevocar(null); setError(null); refrescar() },
    onError: (e: Error & { body?: { message?: string } }) => {
      setARevocar(null)
      setError(e.body?.message ?? 'No se pudo revocar el rol.')
    },
  })

  return (
    <div style={{ padding: '4px 0 40px' }}>
      <header style={{ marginBottom: 24 }}>
        <h2 style={{ ...titulo, fontSize: 24, margin: '0 0 6px' }}>
          Compañeros de viaje
        </h2>
        <p style={{ ...secundario, margin: 0, maxWidth: 720 }}>
          Un compañero de viaje es un paciente que tú consideras preparado para acompañar
          a otro. Recibe sus alertas de pánico, así que la decisión es clínica y queda
          registrada a tu nombre.
        </p>
      </header>

      {error && (
        <div role="alert" style={aviso}>
          <WIcon name="triangle-alert" size={16} color="var(--danger-text)" />
          <span>{error}</span>
        </div>
      )}

      <section style={{ ...tarjeta, marginBottom: 22 }}>
        <div style={encabezado}>
          <WIcon name="heart-handshake" size={17} color="var(--primary-text)" />
          <h3 style={{ ...titulo, fontSize: 16 }}>Quiénes lo son hoy</h3>
          {!cargandoDesignados && (
            <span style={contador}>{designados.length}</span>
          )}
        </div>

        {cargandoDesignados ? (
          <p style={secundario}>Cargando…</p>
        ) : designados.length === 0 ? (
          <p style={{ ...secundario, margin: 0 }}>
            Todavía no hay nadie designado en tu sede. Mientras no lo haya, no vas a poder
            asignarle un compañero de viaje a ningún paciente.
          </p>
        ) : (
          <ul style={lista}>
            {designados.map((s) => (
              <li key={s.id} style={fila}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...principal, margin: '0 0 3px', fontWeight: 600 }}>
                    {s.firstName} {s.lastName}
                  </p>
                  <p style={{ ...secundario, margin: 0, fontSize: 12.5 }}>
                    Designado por {s.designatedByName} ·{' '}
                    {new Date(s.designatedAt).toLocaleDateString('es-CL')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      ...etiqueta,
                      // La carga no es un adorno: es lo que decide si se puede revocar.
                      background: s.assignedPatients > 0 ? 'var(--sage-50)' : 'var(--surface-alt)',
                    }}
                  >
                    {s.assignedPatients === 0
                      ? 'sin pacientes'
                      : `${s.assignedPatients} paciente${s.assignedPatients > 1 ? 's' : ''}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setError(null); setARevocar(s) }}
                    style={botonSecundario}
                  >
                    Revocar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={tarjeta}>
        <div style={encabezado}>
          <WIcon name="user-plus" size={17} color="var(--primary-text)" />
          <h3 style={{ ...titulo, fontSize: 16 }}>A quién puedes designar</h3>
          {!cargandoCandidatos && (
            <span style={contador}>{candidatos.length}</span>
          )}
        </div>
        <p style={{ ...secundario, margin: '0 0 14px' }}>
          Pacientes activos de tu sede que todavía no tienen el rol.
        </p>

        {cargandoCandidatos ? (
          <p style={secundario}>Cargando…</p>
        ) : candidatos.length === 0 ? (
          <p style={{ ...secundario, margin: 0 }}>
            No hay pacientes disponibles para designar en tu sede.
          </p>
        ) : (
          <ul style={lista}>
            {candidatos.map((c: SponsorCandidate) => (
              <li key={c.id} style={fila}>
                <p style={{ ...principal, margin: 0 }}>
                  {c.firstName} {c.lastName}
                </p>
                <button
                  type="button"
                  onClick={() => { setError(null); designar.mutate(c.id) }}
                  disabled={designar.isPending}
                  style={{ ...botonPrimario, opacity: designar.isPending ? 0.6 : 1 }}
                >
                  <WIcon name="circle-check" size={15} color="var(--fg-on-primary)" />
                  Designar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {aRevocar && (
        <ConfirmarRevocacion
          sponsor={aRevocar}
          pendiente={revocar.isPending}
          onCancelar={() => setARevocar(null)}
          onConfirmar={() => revocar.mutate(aRevocar.id)}
        />
      )}
    </div>
  )
}

function ConfirmarRevocacion({
  sponsor, pendiente, onCancelar, onConfirmar,
}: {
  sponsor: SponsorWithLoad
  pendiente: boolean
  onCancelar: () => void
  onConfirmar: () => void
}) {
  // CA21.3: con gente a cargo no se revoca. Se avisa antes de que aprieten, en vez de
  // dejar que el backend devuelva un 409 que la pantalla tendría que traducir.
  const bloqueado = sponsor.assignedPatients > 0

  return (
    <div style={fondoModal}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-revocar-titulo"
        style={modal}
      >
        <h3
          id="sb-revocar-titulo"
          style={{ ...titulo, fontSize: 19, margin: '0 0 10px' }}
        >
          Revocar a {sponsor.firstName} {sponsor.lastName}
        </h3>

        {bloqueado ? (
          <p style={{ ...secundario, margin: '0 0 18px' }}>
            Acompaña a {sponsor.assignedPatients}{' '}
            {sponsor.assignedPatients > 1 ? 'pacientes' : 'paciente'}. Antes de revocar el
            rol hay que asignarles otro compañero de viaje desde su ficha clínica: si no,
            sus alertas de pánico se quedarían sin nadie a quien llegar.
          </p>
        ) : (
          <p style={{ ...secundario, margin: '0 0 18px' }}>
            No acompaña a nadie en este momento, así que se puede revocar sin dejar a
            ningún paciente sin cobertura. El registro de la designación se conserva.
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancelar} style={botonSecundario}>
            {bloqueado ? 'Entendido' : 'Cancelar'}
          </button>
          {!bloqueado && (
            <button
              type="button"
              onClick={onConfirmar}
              disabled={pendiente}
              style={{ ...botonPrimario, opacity: pendiente ? 0.6 : 1 }}
            >
              {pendiente ? 'Revocando…' : 'Confirmar revocación'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const tarjeta: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '18px 20px',
  boxShadow: 'var(--shadow-soft)',
}

const titulo: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 700,
  color: 'var(--fg1)',
  margin: 0,
}

const principal: React.CSSProperties = { color: 'var(--fg1)', fontSize: 14.5 }
const secundario: React.CSSProperties = {
  color: 'var(--fg2)', fontSize: 13.5, lineHeight: 1.5,
}

const encabezado: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12,
}

const contador: React.CSSProperties = {
  marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--fg2)',
}

const lista: React.CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0,
  display: 'flex', flexDirection: 'column', gap: 2,
}

const fila: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 16, padding: '12px 2px', borderTop: '1px solid var(--border-200)',
}

const etiqueta: React.CSSProperties = {
  fontSize: 12.5, color: 'var(--fg2)', padding: '4px 10px',
  borderRadius: 999, whiteSpace: 'nowrap',
}

const aviso: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9,
  background: 'var(--surface)', border: '1px solid var(--danger)',
  color: 'var(--danger-text)', borderRadius: 12,
  padding: '11px 14px', marginBottom: 18, fontSize: 13.5,
}

const fondoModal: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.38)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
}

const modal: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: 20,
  boxShadow: 'var(--shadow-strong)', padding: 26,
  width: 480, maxWidth: '92vw',
}

const botonPrimario: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  background: 'var(--primary)', color: 'var(--fg-on-primary)',
  border: 'none', borderRadius: 10, padding: '9px 15px',
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
}

const botonSecundario: React.CSSProperties = {
  background: 'transparent', color: 'var(--fg2)',
  border: '1px solid var(--border)', borderRadius: 10,
  padding: '9px 15px', fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap',
}
