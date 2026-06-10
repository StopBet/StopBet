import { useState } from 'react'
import { WIcon } from '../components/WIcon'

function SupportNetwork() {
  const nodes = [
    { x: 82,  y: 148, r: 28 },
    { x: 205, y: 68,  r: 22 },
    { x: 336, y: 134, r: 34 },
    { x: 468, y: 62,  r: 20 },
    { x: 482, y: 192, r: 26 },
    { x: 260, y: 215, r: 18 },
    { x: 128, y: 258, r: 23 },
  ]
  const links: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [2, 4],
    [1, 5], [5, 6], [0, 6], [5, 2], [3, 4],
  ]

  return (
    <svg viewBox="0 0 560 310" width="100%" aria-hidden style={{ display: 'block' }}>
      {links.map(([a, b], i) => (
        <line key={i}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke="rgba(255,255,255,0.20)" strokeWidth="1.5" strokeLinecap="round"
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r}
            fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5" />
          <circle cx={n.x} cy={n.y - n.r * 0.18} r={n.r * 0.30}
            fill="rgba(255,255,255,0.88)" />
          <path
            d={`M ${n.x - n.r * 0.50} ${n.y + n.r * 0.52} q ${n.r * 0.50} ${-n.r * 0.48} ${n.r} 0`}
            fill="none" stroke="rgba(255,255,255,0.40)"
            strokeWidth={Math.max(1.4, n.r * 0.12)} strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  )
}

type FormState = 'idle' | 'loading' | 'error'

const TEAL = '#1B6F63'
const TEAL_LIGHT = '#EFF4F1'

export function LoginPage({ sessionExpired = false, onSuccess }: { sessionExpired?: boolean; onSuccess?: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [keepSession, setKeepSession] = useState(true)
  const [formState, setFormState] = useState<FormState>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setFormState('loading')
    // TODO: POST /auth/login cuando el módulo de auth esté implementado en el backend
    await new Promise<void>(resolve => setTimeout(() => resolve(), 900))
    if (email && password) {
      onSuccess?.()
    } else {
      setFormState('error')
    }
  }

  const isLoading = formState === 'loading'
  const isError = formState === 'error'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>

      {/* Panel izquierdo — marca AJUTER */}
      <div style={{
        width: '50%', flexShrink: 0,
        background: 'linear-gradient(160deg, var(--color-ajuter-orange) 0%, var(--color-ajuter-red-orange) 100%)',
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: -0.5, fontFamily: 'var(--font-heading)' }}>
            Stop<span style={{ opacity: 0.72 }}>Bet</span>
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginLeft: 4 }}>· AJUTER</span>
        </div>

        {/* Contenido central */}
        <div style={{ margin: 'auto 0', position: 'relative', zIndex: 2, maxWidth: 460 }}>
          <h1 style={{
            fontWeight: 700, fontSize: 40, lineHeight: 1.2,
            margin: '0 0 14px', letterSpacing: -0.5,
            fontFamily: 'var(--font-heading)',
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

        {/* Ilustración red de apoyo */}
        <div style={{
          position: 'absolute', right: -60, bottom: -20,
          width: 580, zIndex: 1, opacity: 0.85, pointerEvents: 'none',
        }}>
          <SupportNetwork />
        </div>

        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.30)', position: 'relative', zIndex: 2, margin: 0 }}>
          GPI-2026 · Grupo 04
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div style={{
        flex: 1, background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px', position: 'relative',
      }}>
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
          padding: '40px 36px',
          boxSizing: 'border-box',
        }}>
          <h2 style={{
            fontWeight: 700, fontSize: 28,
            color: 'var(--fg1)', margin: '0 0 6px',
            fontFamily: 'var(--font-heading)',
          }}>
            Bienvenido
          </h2>
          <p style={{ fontSize: 14, color: 'var(--fg2)', margin: '0 0 20px' }}>
            Accede al panel clínico de AJUTER
          </p>

          {/* Badge acceso restringido */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: TEAL_LIGHT, borderRadius: 8,
            padding: '7px 12px', marginBottom: 24,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke={TEAL} strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEAL }}>
              Solo psicólogos certificados de AJUTER
            </span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Correo */}
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--fg1)', marginBottom: 7 }}>
                Correo AJUTER
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
                  placeholder="nombre@ajuter.cl"
                  autoComplete="email"
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    background: 'transparent', fontFamily: 'var(--font-body)',
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
                <a href="#" style={{ fontSize: 12.5, fontWeight: 600, color: TEAL, textDecoration: 'none' }}>
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
                    background: 'transparent', fontFamily: 'var(--font-body)',
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
                background: keepSession ? TEAL : 'var(--border)',
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
                background: isLoading ? `${TEAL}cc` : TEAL,
                color: '#fff', border: 'none',
                cursor: isLoading ? 'default' : 'pointer',
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 16,
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
            {isError && (
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
                  Correo o contraseña incorrectos
                </span>
              </div>
            )}
          </form>

          <div style={{ height: 1, background: 'var(--border)', margin: '22px 0 16px' }} />

          <p style={{ fontSize: 12, color: 'var(--fg2)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
            ¿No tienes acceso? Contacta a{' '}
            <a href="mailto:admin@ajuter.cl" style={{ color: TEAL, fontWeight: 600, textDecoration: 'none' }}>
              admin@ajuter.cl
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
