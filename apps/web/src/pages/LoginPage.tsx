import { useState } from 'react'
import { WIcon } from '../components/WIcon'
import { api, type LoginResponse } from '../services/api'
import { useIsNarrow } from '../hooks/useIsNarrow'
import isotipo from '../assets/isotipo-blanco.png'

// Reemplaza a la red de "personitas conectadas", que era genérica y podía ser de
// cualquier producto. Esto dibuja lo único que el paciente mira todos los días: la
// racha de días sin apostar subiendo, con las insignias de los hitos reales del
// backend (1, 7, 30, 60, 90).
function RecoveryPath() {
  const milestones = [
    { x: 48,  y: 250, label: '1' },
    { x: 168, y: 205, label: '7' },
    { x: 288, y: 150, label: '30' },
    { x: 408, y: 92,  label: '60' },
    { x: 512, y: 44,  label: '90' },
  ]
  const curve = 'M 48 250 C 108 236, 128 214, 168 205 S 248 178, 288 150 S 368 112, 408 92 S 480 56, 512 44'

  return (
    <svg viewBox="0 0 560 310" width="100%" aria-hidden style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sb-path-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.20)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      {/* Área bajo la curva: da volumen sin competir con el texto */}
      <path d={`${curve} L 512 300 L 48 300 Z`} fill="url(#sb-path-fill)" />

      {/* Guías horizontales, como el fondo de un gráfico de progreso */}
      {[92, 150, 205, 250].map(y => (
        <line key={y} x1="34" y1={y} x2="536" y2={y}
          stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="4 8" />
      ))}

      <path d={curve} fill="none" stroke="rgba(255,255,255,0.75)"
        strokeWidth="3" strokeLinecap="round" />

      {milestones.map((m, i) => {
        const isLast = i === milestones.length - 1
        return (
          <g key={m.label}>
            {/* El último hito va abierto, para que el camino se lea como continuo */}
            <circle cx={m.x} cy={m.y} r={isLast ? 22 : 17}
              fill={isLast ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.92)'}
              stroke="rgba(255,255,255,0.85)" strokeWidth={isLast ? 2 : 0} />
            <text x={m.x} y={m.y + 5}
              textAnchor="middle"
              fontSize={isLast ? 15 : 13}
              fontWeight="700"
              fontFamily="var(--sb-font-heading)"
              fill={isLast ? 'rgba(255,255,255,0.95)' : 'var(--sb-blue)'}>
              {m.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

type FormState = 'idle' | 'loading' | 'error' | 'forbidden' | 'offline'

const BLUE = 'var(--sb-blue)'
const BLUE_LIGHT = '#EAF1F9'

// /auth/login autentica a cualquier rol, así que el filtro de quién entra a la
// web vive acá. Sin esto un paciente o padrino aterrizaría en el shell clínico
// y alcanzaría endpoints todavía sin guard (ej. /panic/alerts/history, que
// expone nombres e historial de crisis de otros pacientes).
const WEB_ROLES: ReadonlySet<string> = new Set(['psychologist', 'coordinator', 'family'])

// El panel de marca ocupa la mitad del ancho. En un teléfono eso deja ~180 px
// por columna y el formulario queda cortado: los familiares entran desde el
// celular, así que bajo ese ancho se muestra solo el formulario.

export function LoginPage({ sessionExpired = false, onSuccess }: { sessionExpired?: boolean; onSuccess?: (keepSession: boolean, result: LoginResponse) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [keepSession, setKeepSession] = useState(true)
  const [formState, setFormState] = useState<FormState>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setFormState('loading')
    try {
      const result = await api.login(email.trim(), password)
      if (!WEB_ROLES.has(result.user.role)) {
        // Se rechaza antes de guardar el token: la sesión nunca llega a existir
        setFormState('forbidden')
        return
      }
      onSuccess?.(keepSession, result)
    } catch (err: unknown) {
      // Si la petición nunca llegó al servidor no trae status. Antes ese caso
      // también decía "correo o contraseña incorrectos", así que un problema de
      // red se leía como credenciales malas y la persona reintentaba a ciegas.
      const status = (err as { status?: number })?.status
      if (status === undefined) setFormState('offline')
      else setFormState(status === 403 ? 'forbidden' : 'error')
    }
  }

  const isLoading = formState === 'loading'
  // Sin conexión no se marcan los campos en rojo: lo que escribió está bien,
  // el problema no es suyo. Solo se muestra el aviso.
  const isError = formState === 'error' || formState === 'forbidden'
  const showBanner = isError || formState === 'offline'
  const isNarrow = useIsNarrow()

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      overflow: isNarrow ? 'auto' : 'hidden',
      fontFamily: 'var(--sb-font-body)',
    }}>

      {/* Panel izquierdo — marca StopBet. Se oculta en pantallas angostas.
          El login es la puerta común al panel clínico y al portal del familiar, así
          que lleva la marca del producto; el shell del psicólogo sigue en AJUTER. */}
      {!isNarrow && <div style={{
        width: '50%', flexShrink: 0,
        background: 'linear-gradient(160deg, var(--sb-blue) 0%, var(--sb-blue-dark) 100%)',
        display: 'flex', flexDirection: 'column',
        padding: '44px 52px', color: '#fff',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 2 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src={isotipo} alt="" style={{ width: 21, height: 21, display: 'block' }} />
          </div>
          {/* El manual escribe la marca "StopBet" entera: antes la segunda mitad iba
              al 72% de opacidad, como si fueran dos palabras distintas. */}
          <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: -0.5, fontFamily: 'var(--sb-font-heading)' }}>
            StopBet
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginLeft: 4 }}>· AJUTER</span>
        </div>

        {/* Contenido central */}
        <div style={{ margin: 'auto 0', position: 'relative', zIndex: 2, maxWidth: 460 }}>
          <h1 style={{
            fontWeight: 700, fontSize: 40, lineHeight: 1.2,
            margin: '0 0 14px', letterSpacing: -0.5,
            fontFamily: 'var(--sb-font-heading)',
          }}>
            Panel clínico
          </h1>
          <p style={{
            fontSize: 16, lineHeight: 1.65,
            color: 'rgba(255,255,255,0.80)',
            margin: '0 0 30px', maxWidth: 380,
          }}>
            Gestiona el progreso de tus pacientes en tiempo real
          </p>
          <ul style={{
            listStyle: 'none', padding: 0, margin: 0,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {[
              'Métricas de seguimiento actualizadas',
              'Alertas de botón de pánico en tiempo real',
              'Exportación de reportes PDF clínicos',
            ].map(item => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}><WIcon name="check" size={13} /></span>
                <span style={{ fontSize: 15 }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Ilustración: la racha de días sin apostar y sus hitos */}
        <div style={{
          position: 'absolute', right: -60, bottom: -20,
          width: 580, zIndex: 1, opacity: 0.85, pointerEvents: 'none',
        }}>
          <RecoveryPath />
        </div>
      </div>}

      {/* Panel derecho: el formulario */}
      <div style={{
        flex: 1, minWidth: 0, background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: isNarrow ? '20px 16px 28px' : '40px', position: 'relative',
      }}>
        {/* En el teléfono el panel de marca no cabe y se oculta entero, así que el
            login quedaba sin logo ni color: una tarjeta blanca suelta. Esta cabecera
            devuelve la identidad en el poco alto que hay. */}
        {isNarrow && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 22, alignSelf: 'center',
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'var(--sb-blue)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={isotipo} alt="" style={{ width: 25, height: 25, display: 'block' }} />
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{
                fontFamily: 'var(--sb-font-heading)', fontWeight: 700,
                fontSize: 22, letterSpacing: -0.5, color: 'var(--sb-blue)',
              }}>
                StopBet
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg2)' }}>Panel clínico · AJUTER</div>
            </div>
          </div>
        )}
        {/* Banner sesión expirada */}
        {sessionExpired && (
          <div style={{
            position: 'absolute', top: 28, left: 40, right: 40,
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--amber-50)', border: '1px solid rgba(232,136,58,0.30)',
            borderRadius: 12, padding: '12px 16px',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="#E8883A" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#9A4B22' }}>
              Tu sesión expiró por seguridad. Vuelve a iniciar sesión.
            </span>
          </div>
        )}

        {/* Tarjeta del formulario */}
        <div style={{
          width: '100%', maxWidth: 440,
          background: 'var(--surface)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-medium)',
          padding: isNarrow ? '28px 22px' : '40px 36px',
          boxSizing: 'border-box',
        }}>
          <h2 style={{
            fontWeight: 700, fontSize: 28,
            color: 'var(--fg1)', margin: '0 0 6px',
            fontFamily: 'var(--sb-font-heading)',
          }}>
            Bienvenido
          </h2>
          <p style={{ fontSize: 14, color: 'var(--fg2)', margin: '0 0 20px' }}>
            Accede a tu cuenta
          </p>

          {/* Badge acceso restringido */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: BLUE_LIGHT, borderRadius: 8,
            padding: '7px 12px', marginBottom: 24,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke={BLUE} strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: BLUE }}>
              Acceso para equipo clínico y familiares
            </span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Correo */}
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--fg1)', marginBottom: 7 }}>
                Correo
              </span>
              <div style={{
                display: 'flex', alignItems: 'center',
                borderRadius: 'var(--r-sm)', height: 50,
                border: `1.5px solid ${isError ? 'var(--danger)' : 'var(--border)'}`,
                padding: '0 14px', background: 'var(--surface)',
                boxShadow: isError ? '0 0 0 3px rgba(184,50,50,0.08)' : 'none',
              }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.cl"
                  autoComplete="email"
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    background: 'transparent', fontFamily: 'var(--sb-font-body)',
                    fontSize: 15, color: 'var(--fg1)',
                  }}
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="#574F4A" strokeWidth="2" strokeLinecap="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
            </label>

            {/* Contraseña */}
            <label style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg1)' }}>Contraseña</span>
                <a href="#" style={{ fontSize: 12.5, fontWeight: 600, color: BLUE, textDecoration: 'none' }}>
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center',
                borderRadius: 'var(--r-sm)', height: 50,
                border: `1.5px solid ${isError ? 'var(--danger)' : 'var(--border)'}`,
                padding: '0 14px', background: 'var(--surface)',
                boxShadow: isError ? '0 0 0 3px rgba(184,50,50,0.08)' : 'none',
              }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    background: 'transparent', fontFamily: 'var(--sb-font-body)',
                    fontSize: 15, color: 'var(--fg1)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: '#574F4A' }}
                >
                  {showPassword
                    ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )
                  }
                </button>
              </div>
            </label>

            {/* Toggle mantener sesión */}
            <div
              role="checkbox"
              aria-checked={keepSession}
              tabIndex={0}
              onClick={() => setKeepSession(s => !s)}
              onKeyDown={e => e.key === ' ' && setKeepSession(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{
                width: 42, height: 24, borderRadius: 9999, flexShrink: 0, position: 'relative',
                background: keepSession ? BLUE : 'var(--border)',
                transition: 'background 0.2s var(--ease-soft)',
              }}>
                <div style={{
                  position: 'absolute', top: 3,
                  left: keepSession ? 21 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(30,45,44,0.22)',
                  transition: 'left 0.2s var(--ease-soft)',
                }} />
              </div>
              <span style={{ fontSize: 14, color: 'var(--fg1)' }}>Mantener sesión activa</span>
            </div>

            {/* Botón principal */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', height: 52,
                borderRadius: 'var(--r-full)',
                background: isLoading ? `${BLUE}cc` : BLUE,
                color: '#fff', border: 'none',
                cursor: isLoading ? 'default' : 'pointer',
                fontFamily: 'var(--sb-font-body)', fontWeight: 700, fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.2s',
              }}
            >
              {isLoading
                ? (
                  <>
                    <span style={{
                      width: 16, height: 16,
                      border: '2px solid rgba(255,255,255,0.35)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'sb-spin 0.7s linear infinite',
                    }} />
                    Verificando...
                  </>
                )
                : 'Iniciar sesión'
              }
            </button>

            {/* Banner de error */}
            {showBanner && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9,
                background: 'var(--red-50)',
                border: '1px solid rgba(184,50,50,0.22)',
                borderRadius: 10, padding: '10px 14px',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="#B83232" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#B83232' }}>
                  {formState === 'offline'
                    ? 'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.'
                    : formState === 'forbidden'
                    ? 'Tu cuenta no tiene permisos para acceder'
                    : 'Correo o contraseña incorrectos'}
                </span>
              </div>
            )}
          </form>

          <div style={{ height: 1, background: 'var(--border)', margin: '22px 0 16px' }} />

          <p style={{ fontSize: 12, color: 'var(--fg2)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
            ¿No tienes acceso? Contacta a{' '}
            <a href="mailto:admin@stopbet.cl" style={{ color: BLUE, fontWeight: 600, textDecoration: 'none' }}>
              admin@stopbet.cl
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
