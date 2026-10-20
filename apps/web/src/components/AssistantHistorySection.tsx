import { useQuery } from '@tanstack/react-query'
import { WIcon } from './WIcon'
import { getPatientAssistantHistory, type AssistantHistoryItem } from '../services/api'

const CATEGORY: Record<NonNullable<AssistantHistoryItem['triggerCategory']>, string> = {
  money: 'Dinero', temptation: 'Publicidad o tentación', sports: 'Deporte',
  emotions: 'Emociones difíciles', loneliness: 'Soledad o aburrimiento',
  family: 'Familia o pareja', work: 'Trabajo', other: 'Otro motivo',
}
const TECHNIQUE: Record<NonNullable<AssistantHistoryItem['technique']>, string> = {
  breathing: 'Respiración 4-7-8', grounding: 'Grounding 5-4-3-2-1', postponement: 'Postergar el impulso',
}
const FEEDBACK = { yes: 'Le ayudó', somewhat: 'Le ayudó un poco', no: 'No le ayudó' } as const
const RISK = { low: 'Riesgo bajo', medium: 'Riesgo medio', high: 'Riesgo alto' } as const

const box = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }

export function AssistantHistorySection({ patientId }: { patientId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['assistant-history', patientId],
    queryFn: () => getPatientAssistantHistory(patientId),
  })

  if (isLoading) return <p style={{ color: 'var(--fg2)', fontSize: 13 }}>Cargando conversaciones…</p>
  if (isError) return <p style={{ color: 'var(--danger-text)', fontSize: 13 }}>No pudimos cargar las conversaciones con el asistente.</p>
  if (!data?.length) return <div style={box}><p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)' }}>Este paciente todavía no ha conversado con el asistente.</p></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((s) => (
        <div key={s.id} style={box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <WIcon name="message-circle" size={16} color="var(--primary-text)" />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13.5, color: 'var(--fg1)' }}>
              {new Date(s.createdAt).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })} · {Math.max(1, s.durationMinutes)} min
            </span>
            {s.riskLevel && (
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: s.riskLevel === 'high' ? 'var(--danger-text)' : 'var(--fg2)' }}>
                {RISK[s.riskLevel]}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg2)', lineHeight: 1.6 }}>
            {s.triggerCategory && <>Motivo: {CATEGORY[s.triggerCategory]}{s.trigger ? ` («${s.trigger}»)` : ''}<br /></>}
            {s.technique && <>Técnica: {TECHNIQUE[s.technique]}<br /></>}
            {s.mood && <>Ánimo: {s.mood}<br /></>}
            {s.patientFeedback && <strong style={{ color: 'var(--primary-text)' }}>{FEEDBACK[s.patientFeedback]}</strong>}
          </p>
        </div>
      ))}
    </div>
  )
}
