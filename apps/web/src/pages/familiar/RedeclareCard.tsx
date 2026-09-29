import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { WIcon } from '../../components/WIcon'
import { PatientIdToggle, type PatientIdBy } from '../../components/PatientIdToggle'
import { api, type ApiError } from '../../services/api'
import { cleanRut, formatRut, isValidRut } from '../../utils/rut'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type RedeclareOutcome = 'sent' | 'already-in-review'

// HDU 22 CA6 — el familiar vuelve a declarar a su paciente desde el portal: se equivocó de RUT
// al registrarse o el equipo clínico rechazó la solicitud. La respuesta nunca dice si el
// paciente existe; solo si esa misma declaración ya estaba en revisión.
export function RedeclareCard({
  title,
  intro,
  collapsible = false,
  onDone,
}: {
  title: string
  intro: string
  collapsible?: boolean
  onDone: (outcome: RedeclareOutcome) => void
}) {
  const [expanded, setExpanded] = useState(!collapsible)
  const [by, setBy] = useState<PatientIdBy>('rut')
  const [rut, setRut] = useState('')
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      api.requestFamilyLink(by === 'rut' ? { patientRut: cleanRut(rut) } : { patientEmail: email.trim() }),
    onSuccess: (res) => onDone(res.alreadyInReview ? 'already-in-review' : 'sent'),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (by === 'rut') {
      if (!rut.trim()) return setFieldError('Escribe el RUT del paciente')
      if (!isValidRut(rut)) return setFieldError('El RUT ingresado no es válido')
    } else {
      if (!email.trim()) return setFieldError('Escribe el correo del paciente')
      if (!EMAIL_RE.test(email.trim())) return setFieldError('El correo no es válido')
    }
    setFieldError(null)
    mutation.mutate()
  }

  const status = (mutation.error as ApiError | null)?.status
  const requestError = !mutation.error
    ? null
    : status === 429
      ? 'Hiciste varios intentos seguidos. Espera un minuto y vuelve a intentarlo.'
      : 'No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos.'

  const card: React.CSSProperties = {
    marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
    boxShadow: 'var(--shadow-soft)', padding: '22px 26px',
  }

  if (!expanded) {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, color: 'var(--fg2)' }}>{intro}</span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--primary-text)', textDecoration: 'underline' }}
        >
          {title}
        </button>
      </div>
    )
  }

  const hasError = !!fieldError
  return (
    <form onSubmit={submit} style={card} noValidate>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--fg1)' }}>{title}</h2>
      <p style={{ margin: '6px 0 16px', fontSize: 13.5, color: 'var(--fg2)', lineHeight: 1.55 }}>{intro}</p>

      <PatientIdToggle value={by} onChange={(v) => { setBy(v); setFieldError(null) }} />

      <label style={{ display: 'block' }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--fg1)', marginBottom: 7 }}>
          {by === 'rut' ? 'RUT del paciente' : 'Correo del paciente'}
        </span>
        <input
          type={by === 'rut' ? 'text' : 'email'}
          value={by === 'rut' ? rut : email}
          onChange={(e) => (by === 'rut' ? setRut(e.target.value) : setEmail(e.target.value))}
          onBlur={() => { if (by === 'rut' && rut.trim()) setRut(formatRut(rut)) }}
          placeholder={by === 'rut' ? '12.345.678-9' : 'familiar@correo.cl'}
          aria-invalid={hasError}
          style={{
            width: '100%', boxSizing: 'border-box', height: 48, padding: '0 14px', borderRadius: 'var(--r-sm)',
            border: `1.5px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`, background: 'var(--surface)',
            fontSize: 15, color: 'var(--fg1)', outline: 'none',
          }}
        />
        {fieldError && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--danger-text)', marginTop: 6 }}>{fieldError}</span>}
      </label>

      {requestError && (
        <div role="alert" style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--danger-text)' }}>
          <WIcon name="circle-alert" size={16} />
          {requestError}
        </div>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        style={{
          marginTop: 18, height: 46, padding: '0 24px', borderRadius: 9999, border: 'none',
          background: mutation.isPending ? 'var(--disabled)' : 'var(--primary)', color: 'var(--fg-on-primary)',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5,
          cursor: mutation.isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {mutation.isPending ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  )
}

// Aviso tras enviar: se muestra en el estado "pendiente", que es a donde pasa el portal.
export function RedeclareResult({ outcome }: { outcome: RedeclareOutcome }) {
  const inReview = outcome === 'already-in-review'
  return (
    <div
      role="status"
      style={{
        marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '14px 18px', borderRadius: 14,
        background: 'color-mix(in srgb, var(--primary) 7%, var(--surface))', border: '1px solid var(--border)',
        fontSize: 14, color: 'var(--fg1)', lineHeight: 1.5,
      }}
    >
      <WIcon name={inReview ? 'clock' : 'circle-check'} size={18} color="var(--primary-text)" />
      <span>
        {inReview
          ? 'Esa solicitud ya está en revisión. No hace falta enviarla de nuevo: te avisaremos cuando el equipo clínico la revise.'
          : 'Enviamos tu solicitud. El equipo clínico la va a revisar y te avisaremos acá mismo.'}
      </span>
    </div>
  )
}
