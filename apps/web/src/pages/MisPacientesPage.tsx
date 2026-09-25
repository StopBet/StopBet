import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { WIcon } from '../components/WIcon'
import { api } from '../services/api'
import type { AlertHistoryItem, PatientListItem } from '../services/api'
import type { Patient } from '../data/mockData'
import { followUp, toPatient, type FollowUpRow } from '../utils/patientView'
import { ReportDialog } from '../components/ReportDialog'
import { PatientDrawer } from '../components/PatientDrawer'
import type { AuthUser } from '../services/api'
import { useNavigate } from 'react-router-dom'

// Las emociones que registra la app. El valor de ánimo sale de `patientView`, el mismo que
// usan el seguimiento y el reporte: tenía una copia propia que puntuaba distinto la misma emoción.
const EMOTION_LABEL: Record<string, string> = {
  good: 'Bien', tired: 'Cansado', anxious: 'Ansioso', lonely: 'Solo', angry: 'Con rabia',
}

const cardStyle: CSSProperties = {
  background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)', padding: 20,
}

function Chip({ text, tone }: { text: string; tone: 'danger' | 'warn' | 'muted' }) {
  const bg = tone === 'danger' ? 'var(--red-50)' : tone === 'warn' ? 'var(--surface-alt)' : 'var(--bg)'
  const fg = tone === 'danger' ? 'var(--danger-text)' : tone === 'warn' ? 'var(--primary-text)' : 'var(--fg2)'
  return (
    <span style={{
      display: 'inline-block', background: bg, color: fg, borderRadius: 9999,
      padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{text}</span>
  )
}

function AdherenceBar({ pct }: { pct: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 62, height: 6, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{
          width: `${Math.min(100, pct)}%`, height: '100%', borderRadius: 3,
          background: pct >= 60 ? 'var(--primary)' : 'var(--disabled-300)',
        }} />
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--fg2)' }}>{pct}%</span>
    </div>
  )
}

function PatientRow({ row, tieneFicha, onOpen, onReport, onFichaClinica }: {
  row: FollowUpRow
  tieneFicha: boolean
  onOpen: () => void
  onReport: () => void
  onFichaClinica: () => void
}) {
  const { p, name, initials, sinCheckIn, adherencia, moodReciente, flags } = row
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '13px 4px',
      borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: 'var(--teal-50)', color: 'var(--primary-text)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13,
      }}>{initials}</div>

      <div style={{ minWidth: 150, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg1)' }}>{name}</div>
        <div style={{ fontSize: 12.5, color: 'var(--fg2)' }}>
          {sinCheckIn === null
            ? 'Sin check-ins'
            : sinCheckIn === 0
              ? 'Check-in hoy'
              : `Último check-in hace ${sinCheckIn} ${sinCheckIn === 1 ? 'día' : 'días'}`}
          {p.lastCheckIn ? ` · ${EMOTION_LABEL[p.lastCheckIn.emotion] ?? p.lastCheckIn.emotion}` : ''}
        </div>
      </div>

      <div style={{ minWidth: 92 }}>
        <div style={{ fontSize: 11.5, color: 'var(--fg2)', marginBottom: 3 }}>Adherencia</div>
        <AdherenceBar pct={adherencia} />
      </div>

      <div style={{ minWidth: 70 }}>
        <div style={{ fontSize: 11.5, color: 'var(--fg2)', marginBottom: 3 }}>Racha</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--fg1)' }}>
          {p.daysStreak}<span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--fg2)' }}> días</span>
        </div>
      </div>

      <div style={{ minWidth: 70 }}>
        <div style={{ fontSize: 11.5, color: 'var(--fg2)', marginBottom: 3 }}>Ánimo 7d</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--fg1)' }}>
          {moodReciente === null ? '-' : `${moodReciente}`}
          {moodReciente !== null && <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--fg2)' }}>/5</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 120 }}>
        {flags.map(f => <Chip key={f.label} text={f.label} tone={f.tone} />)}
        {/* No va en `flags`: eso lo arma `patientView` con las señales de riesgo clínico, y
            que falte la ficha clínica es una tarea del psicólogo, no un problema del paciente. */}
        {!tieneFicha && <Chip text="Sin ficha clínica" tone="muted" />}
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onFichaClinica}
          aria-label={`Ficha clínica de ${name}`}
          style={{
            border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--primary-text)',
            borderRadius: 9999, height: 34, padding: '0 13px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}><WIcon name="notebook-pen" size={15} /> Ficha clínica</button>
        <button
          onClick={onReport}
          aria-label={`Reporte PDF de ${name}`}
          style={{
            border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg2)',
            borderRadius: 9999, height: 34, padding: '0 13px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}><WIcon name="download" size={15} /> PDF</button>
        <button
          onClick={onOpen}
          aria-label={`Ver seguimiento de ${name}`}
          style={{
            border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--primary-text)',
            borderRadius: 9999, height: 34, padding: '0 15px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
          }}>Seguimiento</button>
      </div>
    </div>
  )
}

export function MisPacientesPage({ user }: { user: AuthUser }) {
  // La coordinación ve a todos los pacientes y un psicólogo solo a sus asignados, así que el
  // subtítulo no puede decir «asignados a ti» para los dos.
  const esCoordinacion = user.role === 'coordinator'

  const [q, setQ] = useState('')

  const [reporte, setReporte] = useState<Patient | null>(null)

  const navigate = useNavigate()

  // Qué pacientes ya tienen ficha clínica (HdU13). Solo trae el estado, nunca el contenido:
  // marcar «Sin ficha» en la lista es lo que le dice al psicólogo a quién le falta, en vez de
  // que lo descubra entrando paciente por paciente.
  const { data: fichas = [] } = useQuery({
    queryKey: ['clinical-record-status'],
    queryFn: api.getClinicalRecordStatus,
  })
  const conFicha = useMemo(() => new Set(fichas.map(f => f.patientId)), [fichas])

  const { data: patients = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['patients'],
    queryFn: api.getPatients,
  })
  // Mismas claves que el Resumen: TanStack comparte la caché y no se pide dos veces.
  const { data: alertHistory = [] } = useQuery({
    queryKey: ['alerts', 'history'],
    queryFn: api.getAlertHistory,
  })
  const { data: sedes = [] } = useQuery({
    queryKey: ['sedes'],
    queryFn: api.getSedes,
  })

  const [panel, setPanel] = useState<Patient | null>(null)

  const armar = (p: PatientListItem): Patient => {
    const sedeMap = Object.fromEntries(sedes.map(x => [x.id, x.name]))
    const alertsByPatient: Record<string, AlertHistoryItem[]> = {}
    for (const a of alertHistory) (alertsByPatient[a.patientId] ??= []).push(a)
    return toPatient(p, alertsByPatient, sedeMap)
  }
  const abrirReporte = (p: PatientListItem) => setReporte(armar(p))
  const abrirPanel = (p: PatientListItem) => setPanel(armar(p))

  // El Resumen manda acá con ?paciente=<id> para abrir una ficha puntual. Se atiende una
  // sola vez por id: sin el ref, limpiar el parámetro vuelve a renderizar y el efecto
  // reabría la ficha apenas se cerraba (fue un bug real).
  const [params, setParams] = useSearchParams()
  const pacienteParam = params.get('paciente')
  const atendido = useRef<string | null>(null)
  useEffect(() => {
    if (!pacienteParam || atendido.current === pacienteParam) return
    const p = patients.find(x => x.id === pacienteParam)
    if (!p) return
    atendido.current = pacienteParam
    setPanel(armar(p))
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `armar` se recrea en cada render
  }, [pacienteParam, patients, setParams])

  const { listado, seguimiento, sinFicha, total } = useMemo(() => {
    const rows = patients.map(followUp)
    const filtered = q.trim()
      ? rows.filter(r => r.name.toLowerCase().includes(q.trim().toLowerCase()))
      : rows
    return {
      total: rows.length,
      // Una sola lista: partirla en dos dejaba «En seguimiento normal» como título de casi
      // todos y obligaba a buscar a un paciente en dos sitios. Los que requieren atención
      // suben, y su chip ya los distingue dentro de la misma lista.
      listado: [...filtered].sort((a, b) => b.flags.length - a.flags.length
        || (b.sinCheckIn ?? -1) - (a.sinCheckIn ?? -1)),
      seguimiento: filtered.filter(r => r.flags.length > 0)
        .sort((a, b) => (b.sinCheckIn ?? 999) - (a.sinCheckIn ?? 999)),
      sinFicha: rows.filter(r => !conFicha.has(r.p.id)),
    }
  }, [patients, q, conFicha])

  if (isLoading) {
    return <div style={{ padding: 32, color: 'var(--fg2)' }}>Cargando tus pacientes…</div>
  }

  if (isError) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: 'var(--fg1)', marginBottom: 6 }}>No pudimos cargar tus pacientes</div>
          <div style={{ fontSize: 13.5, color: 'var(--fg2)', marginBottom: 14 }}>Revisa tu conexión e inténtalo otra vez.</div>
          <button onClick={() => refetch()} style={{
            border: 'none', background: 'var(--primary)', color: 'var(--fg-on-primary)',
            borderRadius: 9999, height: 40, padding: '0 22px', fontWeight: 700, cursor: 'pointer',
          }}>Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '22px 26px 40px' }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 24, color: 'var(--fg1)', margin: '0 0 4px' }}>
        Mis pacientes
      </h2>
      <p style={{ fontSize: 13.5, color: 'var(--fg2)', margin: '0 0 18px' }}>
        {esCoordinacion
          ? 'Todos los pacientes de las sedes que coordinas. Los que requieren seguimiento aparecen primero.'
          : 'Los pacientes asignados a ti. Los que requieren seguimiento aparecen primero.'}
      </p>

      <div style={{ marginBottom: 18, maxWidth: 380 }}>
        <label htmlFor="sb-buscar-paciente" style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 5 }}>
          Buscar
        </label>
        <input
          id="sb-buscar-paciente"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre…"
          style={{
            height: 42, width: '100%', boxSizing: 'border-box', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--surface)', padding: '0 12px',
            fontSize: 13.5, color: 'var(--fg1)',
          }}
        />
      </div>

      {total === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 36 }}>
          <div style={{ fontWeight: 700, color: 'var(--fg1)', marginBottom: 6 }}>Todavía no tienes pacientes asignados</div>
          <div style={{ fontSize: 13.5, color: 'var(--fg2)' }}>
            Cuando la coordinación te asigne pacientes, van a aparecer acá.
          </div>
        </div>
      ) : (
        // Dos columnas: la lista manda y «Requieren seguimiento» queda al lado. Antes ocupaba
        // el bloque de arriba, pero la semana en que nadie tiene señales de alerta -que es lo
        // que uno espera de un tratamiento que funciona- esa tarjeta quedaba vacía empujando la
        // lista hacia abajo. Un aviso secundario no debe ser lo primero y lo más grande.
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 520px', minWidth: 300 }}>
            <section style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--fg1)', margin: 0 }}>
                  {q.trim() ? 'Resultados' : 'Todos tus pacientes'}
                </h3>
                <span style={{ marginLeft: 'auto' }}><Chip text={`${listado.length}`} tone="muted" /></span>
              </div>
              {listado.length === 0 ? (
                <div style={{ padding: '16px 4px', fontSize: 13.5, color: 'var(--fg2)' }}>
                  Ningún paciente coincide con la búsqueda.
                </div>
              ) : (
                listado.map(r => (
                  <PatientRow
                    key={r.p.id}
                    row={r}
                    tieneFicha={conFicha.has(r.p.id)}
                    onOpen={() => abrirPanel(r.p)}
                    onReport={() => abrirReporte(r.p)}
                    onFichaClinica={() => navigate(`/pacientes/${r.p.id}/ficha`)}
                  />
                ))
              )}
            </section>
          </div>

          <aside style={{ flex: '0 1 290px', minWidth: 250, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <section style={{ ...cardStyle, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <WIcon name="triangle-alert" size={16} color={seguimiento.length ? 'var(--danger-text)' : 'var(--fg2)'} />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, color: 'var(--fg1)', margin: 0 }}>
                  Requieren seguimiento
                </h3>
                <span style={{ marginLeft: 'auto' }}>
                  <Chip text={`${seguimiento.length}`} tone={seguimiento.length ? 'danger' : 'muted'} />
                </span>
              </div>

              {seguimiento.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)', lineHeight: 1.55 }}>
                  Ninguno de tus pacientes tiene señales de alerta esta semana.
                </p>
              ) : (
                <>
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--fg2)', lineHeight: 1.5 }}>
                    Por falta de check-ins, ánimo bajo sostenido, registro incompleto o cuenta suspendida.
                  </p>
                  {seguimiento.map(r => (
                    <button
                      key={r.p.id}
                      onClick={() => abrirPanel(r.p)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                        textAlign: 'left', background: 'none', cursor: 'pointer',
                        border: 'none', borderTop: '1px solid var(--border)', padding: '10px 0',
                      }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--teal-50)', color: 'var(--primary-text)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 11.5,
                      }}>{r.initials}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg1)' }}>{r.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg2)' }}>
                          {r.flags.map(f => f.label).join(' · ')}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </section>

            {/* Lo que esta pantalla no decía y el psicólogo igual necesita saber: a cuántos les
                falta la ficha clínica. Es tarea suya y hasta ahora solo se veía paciente a
                paciente. */}
            <section style={{ ...cardStyle, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <WIcon name="notebook-pen" size={16} color="var(--primary-text)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, color: 'var(--fg1)', margin: 0 }}>
                  Fichas clínicas
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 26, color: 'var(--fg1)' }}>
                  {total - sinFicha.length}
                </span>
                <span style={{ fontSize: 13, color: 'var(--fg2)' }}>de {total} completas</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden', marginBottom: 10 }}>
                <div style={{
                  width: `${total ? ((total - sinFicha.length) / total) * 100 : 0}%`,
                  height: '100%', borderRadius: 3,
                  background: sinFicha.length === 0 ? 'var(--secondary)' : 'var(--primary)',
                }} />
              </div>
              {sinFicha.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)', lineHeight: 1.55 }}>
                  Todos tus pacientes tienen su ficha al día.
                </p>
              ) : (
                sinFicha.map(r => (
                  <button
                    key={r.p.id}
                    onClick={() => navigate(`/pacientes/${r.p.id}/ficha`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                      textAlign: 'left', background: 'none', cursor: 'pointer',
                      border: 'none', borderTop: '1px solid var(--border)', padding: '9px 0',
                      fontSize: 13, color: 'var(--primary-text)', fontWeight: 600,
                    }}
                  >
                    <WIcon name="arrow-right" size={14} color="var(--primary-text)" />
                    Crear la de {r.name.split(' ')[0]}
                  </button>
                ))
              )}
            </section>
          </aside>
        </div>
      )}

      {reporte && <ReportDialog patient={reporte} onClose={() => setReporte(null)} />}
      {panel && <PatientDrawer patient={panel} onClose={() => setPanel(null)} />}
    </div>
  )
}
