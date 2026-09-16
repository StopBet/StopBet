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

// Las emociones que registra la app. El valor de ánimo sale de `patientView`, el mismo que
// usan la ficha y el reporte: tenía una copia propia que puntuaba distinto la misma emoción.
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

function PatientRow({ row, onOpen, onReport }: { row: FollowUpRow; onOpen: () => void; onReport: () => void }) {
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
          {moodReciente === null ? '—' : `${moodReciente}`}
          {moodReciente !== null && <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--fg2)' }}>/5</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 120 }}>
        {flags.map(f => <Chip key={f.label} text={f.label} tone={f.tone} />)}
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
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
          aria-label={`Ver ficha de ${name}`}
          style={{
            border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--primary-text)',
            borderRadius: 9999, height: 34, padding: '0 15px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
          }}>Ver ficha</button>
      </div>
    </div>
  )
}

export function MisPacientesPage() {
  const [q, setQ] = useState('')

  const [reporte, setReporte] = useState<Patient | null>(null)

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

  const [ficha, setFicha] = useState<Patient | null>(null)

  const armar = (p: PatientListItem): Patient => {
    const sedeMap = Object.fromEntries(sedes.map(x => [x.id, x.name]))
    const alertsByPatient: Record<string, AlertHistoryItem[]> = {}
    for (const a of alertHistory) (alertsByPatient[a.patientId] ??= []).push(a)
    return toPatient(p, alertsByPatient, sedeMap)
  }
  const abrirReporte = (p: PatientListItem) => setReporte(armar(p))
  const abrirFicha = (p: PatientListItem) => setFicha(armar(p))

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
    setFicha(armar(p))
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `armar` se recrea en cada render
  }, [pacienteParam, patients, setParams])

  const { seguimiento, resto, total } = useMemo(() => {
    const rows = patients.map(followUp)
    const filtered = q.trim()
      ? rows.filter(r => r.name.toLowerCase().includes(q.trim().toLowerCase()))
      : rows
    return {
      total: rows.length,
      seguimiento: filtered.filter(r => r.flags.length > 0)
        .sort((a, b) => (b.sinCheckIn ?? 999) - (a.sinCheckIn ?? 999)),
      resto: filtered.filter(r => r.flags.length === 0)
        .sort((a, b) => (a.sinCheckIn ?? 999) - (b.sinCheckIn ?? 999)),
    }
  }, [patients, q])

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
        Los pacientes asignados a ti. Arriba, quienes conviene mirar esta semana.
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
        <>
          <section style={{ ...cardStyle, marginBottom: 18, borderColor: seguimiento.length ? 'var(--danger)' : 'var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
              <WIcon name="triangle-alert" size={17} color={seguimiento.length ? 'var(--danger-text)' : 'var(--fg2)'} />
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--fg1)', margin: 0 }}>
                Requieren seguimiento
              </h3>
              <span style={{ marginLeft: 'auto' }}>
                <Chip text={`${seguimiento.length}`} tone={seguimiento.length ? 'danger' : 'muted'} />
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--fg2)', margin: '0 0 8px' }}>
              Por falta de check-ins, ánimo bajo sostenido, registro incompleto o cuenta suspendida.
            </p>
            {seguimiento.length === 0 ? (
              <div style={{ padding: '16px 4px', fontSize: 13.5, color: 'var(--fg2)' }}>
                Ninguno de tus pacientes tiene señales de alerta esta semana.
              </div>
            ) : (
              seguimiento.map(r => (
                <PatientRow key={r.p.id} row={r} onOpen={() => abrirFicha(r.p)} onReport={() => abrirReporte(r.p)} />
              ))
            )}
          </section>

          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--fg1)', margin: 0 }}>
                En seguimiento normal
              </h3>
              <span style={{ marginLeft: 'auto' }}><Chip text={`${resto.length}`} tone="muted" /></span>
            </div>
            {resto.length === 0 ? (
              <div style={{ padding: '16px 4px', fontSize: 13.5, color: 'var(--fg2)' }}>
                {q.trim() ? 'Ningún paciente coincide con la búsqueda.' : 'Sin pacientes en esta sección.'}
              </div>
            ) : (
              resto.map(r => (
                <PatientRow key={r.p.id} row={r} onOpen={() => abrirFicha(r.p)} onReport={() => abrirReporte(r.p)} />
              ))
            )}
          </section>
        </>
      )}

      {reporte && <ReportDialog patient={reporte} onClose={() => setReporte(null)} />}
      {ficha && <PatientDrawer patient={ficha} onClose={() => setFicha(null)} />}
    </div>
  )
}
