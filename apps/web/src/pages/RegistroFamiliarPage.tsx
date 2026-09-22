import { useState } from 'react'
import { Link } from 'react-router-dom'
import { WIcon } from '../components/WIcon'
import { api, type ApiError } from '../services/api'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { cleanRut, formatRut, isValidRut } from '../utils/rut'
import isotipo from '../assets/isotipo-blanco.png'

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'password' | 'rut' | 'patientRut', string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(fields: {
  firstName: string
  lastName: string
  email: string
  password: string
  rut: string
  patientRut: string
}): FieldErrors {
  const errors: FieldErrors = {}
  if (!fields.firstName.trim()) errors.firstName = 'El nombre es obligatorio'
  if (!fields.lastName.trim()) errors.lastName = 'El apellido es obligatorio'
  if (!fields.email.trim()) errors.email = 'El correo es obligatorio'
  else if (!EMAIL_RE.test(fields.email.trim())) errors.email = 'El correo no es válido'
  if (!fields.password) errors.password = 'La contraseña es obligatoria'
  else if (fields.password.length < 8) errors.password = 'Debe tener al menos 8 caracteres'
  if (!fields.rut.trim()) errors.rut = 'Tu RUT es obligatorio'
  else if (!isValidRut(fields.rut)) errors.rut = 'El RUT ingresado no es válido'
  if (!fields.patientRut.trim()) errors.patientRut = 'El RUT del paciente es obligatorio'
  else if (!isValidRut(fields.patientRut)) errors.patientRut = 'El RUT ingresado no es válido'
  return errors
}

// Estilos compartidos con LoginPage: misma tarjeta, mismos inputs, para que el
// registro se sienta parte del mismo producto y no una pantalla aparte.
function fieldBoxStyle(hasError: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center',
    borderRadius: 'var(--r-sm)', height: 50,
    border: `1.5px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
    padding: '0 14px', background: 'var(--surface)',
    boxShadow: hasError ? '0 0 0 3px color-mix(in srgb, var(--danger) 8%, transparent)' : 'none',
  }
}

const inputStyle: React.CSSProperties = {
  flex: 1, border: 'none', outline: 'none',
  background: 'transparent', fontFamily: 'var(--sb-font-body)',
  fontSize: 15, color: 'var(--fg1)', width: '100%',
}

const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--fg1)', marginBottom: 7 }
const errorTextStyle: React.CSSProperties = { fontSize: 12.5, color: 'var(--danger-text)', marginTop: 6 }

function Field({
  label, error, children, optional,
}: { label: string; error?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>
        {label} {optional && <span style={{ fontWeight: 400, color: 'var(--fg2)' }}>(opcional)</span>}
      </span>
      {children}
      {error && <div style={errorTextStyle}>{error}</div>}
    </label>
  )
}

export function RegistroFamiliarPage() {
  const isNarrow = useIsNarrow()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [rut, setRut] = useState('')
  const [patientRut, setPatientRut] = useState('')

  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // CA4 — se bloquea el envío y se resaltan los campos, sin perder lo ya escrito.
    const fieldErrors = validate({ firstName, lastName, email, password, rut, patientRut })
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setSubmitting(true)
    try {
      await api.registerFamily({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        rut: cleanRut(rut),
        patientRut: cleanRut(patientRut),
      })
      // CA1 + CA2 — misma confirmación exista o no el paciente: no se distingue acá.
      setDone(true)
    } catch (err) {
      const apiErr = err as ApiError
      // CA3 — correo o RUT ya usados por otra cuenta.
      setFormError(
        apiErr.status === 409
          ? (apiErr.body?.message as string | undefined) ?? 'Ya existe una cuenta con esos datos'
          : 'No pudimos completar el registro. Intenta de nuevo en unos minutos.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isNarrow ? '20px 16px 40px' : '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--sb-blue)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={isotipo} alt="" style={{ width: 25, height: 25, display: 'block' }} />
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontFamily: 'var(--sb-font-heading)', fontWeight: 700, fontSize: 22, letterSpacing: -0.5, color: 'var(--primary-text)' }}>
            StopBet
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg2)' }}>Portal de familiares</div>
        </div>
      </div>

      <div style={{
        width: '100%', maxWidth: 460,
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-medium)',
        padding: isNarrow ? '28px 22px' : '36px 36px',
        boxSizing: 'border-box',
      }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 18px',
              background: 'var(--surface-alt)', color: 'var(--primary-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <WIcon name="circle-check" size={28} />
            </div>
            <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--sb-font-heading)', fontWeight: 700, fontSize: 22, color: 'var(--fg1)' }}>
              Solicitud enviada
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6 }}>
              Revisamos tu solicitud y te avisaremos por correo cuando el equipo clínico confirme
              el vínculo con el paciente.
            </p>
            <Link
              to="/"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                height: 46, padding: '0 26px', borderRadius: 9999,
                border: '1.5px solid var(--primary)', color: 'var(--primary)',
                fontFamily: 'var(--sb-font-heading)', fontWeight: 700, fontSize: 14.5,
                textDecoration: 'none',
              }}
            >
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <h2 style={{ fontWeight: 700, fontSize: 26, color: 'var(--fg1)', margin: '0 0 6px', fontFamily: 'var(--sb-font-heading)' }}>
              Crea tu cuenta de familiar
            </h2>
            <p style={{ fontSize: 14, color: 'var(--fg2)', margin: '0 0 22px', lineHeight: 1.5 }}>
              Vas a poder ver las sesiones grupales y el estado de tu familiar una vez que el
              equipo clínico confirme el vínculo.
            </p>

            {formError && (
              <div style={{
                background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
                border: '1px solid var(--danger)', borderRadius: 12,
                padding: '12px 14px', marginBottom: 20,
                fontSize: 13.5, color: 'var(--danger-text)', fontWeight: 600,
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12, flexDirection: isNarrow ? 'column' : 'row' }}>
                <div style={{ flex: 1 }}>
                  <Field label="Nombre" error={errors.firstName}>
                    <div style={fieldBoxStyle(!!errors.firstName)}>
                      <input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" />
                    </div>
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Apellido" error={errors.lastName}>
                    <div style={fieldBoxStyle(!!errors.lastName)}>
                      <input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" />
                    </div>
                  </Field>
                </div>
              </div>

              <Field label="Correo electrónico" error={errors.email}>
                <div style={fieldBoxStyle(!!errors.email)}>
                  <input type="email" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="tu@correo.cl" />
                </div>
              </Field>

              <Field label="Contraseña" error={errors.password}>
                <div style={fieldBoxStyle(!!errors.password)}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    style={inputStyle}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: 'var(--fg2)', flexShrink: 0 }}
                  >
                    {/* WIcon no tiene ícono de ojo — mismo SVG a mano que usa LoginPage. */}
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </Field>

              <Field label="Teléfono" optional>
                <div style={fieldBoxStyle(false)}>
                  <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="+56 9 1234 5678" />
                </div>
              </Field>

              <Field label="Tu RUT" error={errors.rut}>
                <div style={fieldBoxStyle(!!errors.rut)}>
                  <input
                    style={inputStyle}
                    value={rut}
                    onChange={e => setRut(e.target.value)}
                    onBlur={() => setRut(r => (r.trim() ? formatRut(r) : r))}
                    placeholder="12.345.678-9"
                  />
                </div>
              </Field>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)', marginBottom: 12, fontFamily: 'var(--sb-font-heading)' }}>
                  Datos del paciente
                </div>
                <Field label="RUT del paciente al que estás vinculado" error={errors.patientRut}>
                  <div style={fieldBoxStyle(!!errors.patientRut)}>
                    <input
                      style={inputStyle}
                      value={patientRut}
                      onChange={e => setPatientRut(e.target.value)}
                      onBlur={() => setPatientRut(r => (r.trim() ? formatRut(r) : r))}
                      placeholder="12.345.678-9"
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg2)', marginTop: 6, lineHeight: 1.5 }}>
                    Se lo pediremos a tu familiar o lo encuentras en su ficha de ingreso.
                  </div>
                </Field>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  height: 50, borderRadius: 9999, border: 'none',
                  background: submitting ? 'var(--disabled)' : 'var(--primary)',
                  color: 'var(--fg-on-primary)', fontFamily: 'var(--sb-font-heading)',
                  fontWeight: 700, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer',
                  marginTop: 6,
                }}
              >
                {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>

              <Link to="/" style={{ textAlign: 'center', fontSize: 13, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                ¿Ya tienes cuenta? Inicia sesión
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
