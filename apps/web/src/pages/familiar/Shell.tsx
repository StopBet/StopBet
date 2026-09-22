import { useNavigate } from 'react-router-dom'
import { WIcon } from '../../components/WIcon'
import isotipo from '../../assets/isotipo-blanco.png'
import logoAjuterBlanco from '../../assets/logo-ajuter-blanco.png'
import type { AuthUser } from '../../services/api'

export function Shell({
  user,
  onLogout,
  // El ancho lo fija cada vista para que el encabezado quede alineado con su
  // contenido: los avisos siguen angostos y solo el portal de dos columnas se ensancha.
  maxWidth = 720,
  children,
}: {
  user: AuthUser
  onLogout: () => void
  maxWidth?: number
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* El degradado institucional arranca en el azul claro, justo donde va el saludo: el blanco
          quedaba en 1,99:1. Este tramo usa solo los dos azules oscuros de la marca. Con los
          colores de AJUTER, los mismos tokens lo vuelven carbón. */}
      <header style={{ background: 'linear-gradient(90deg, var(--chrome-bg-active) 0%, var(--chrome-bg) 100%)', padding: '26px 24px' }}>
        {/* Grilla y no flex: con los colores de AJUTER los botones suben a la fila del logo y el
            saludo baja con todo el ancho. Montserrat es más ancha que Chillax y en el teléfono
            partía «Hola, Patricia» en dos líneas. Las áreas cambian en ajuter-brand.css. */}
        <div className="sb-portal-header" style={{ maxWidth, margin: '0 auto' }}>
          <div className="sb-only-ajuter" style={{ gridArea: 'logo' }}>
            <img src={logoAjuterBlanco} alt="AJUTER" style={{ display: 'block', width: 104, height: 'auto' }} />
          </div>
          <div style={{ gridArea: 'greet', minWidth: 0 }}>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, color: 'var(--fg-on-primary)' }}>
              Hola, {user.firstName}
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'rgba(255,255,255,0.88)' }}>
              Portal de familiares
            </p>
          </div>
          <div style={{ gridArea: 'actions', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Solo ícono: en el teléfono el saludo y dos botones con texto no caben en una línea. */}
            <button
              onClick={() => navigate('/familiar/ajustes')}
              aria-label="Ajustes"
              title="Ajustes"
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.45)',
                color: 'var(--fg-on-primary)',
                borderRadius: '50%',
                width: 38,
                height: 38,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <WIcon name="settings" size={18} />
            </button>
            <button
              onClick={onLogout}
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.45)',
                color: 'var(--fg-on-primary)',
                borderRadius: 999,
                padding: '8px 16px',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth, margin: '0 auto', padding: '28px 24px 64px' }}>
        {children}
        <div className="sb-only-ajuter">
          <p style={{ margin: '40px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, color: 'var(--fg2)' }}>
            {/* El isotipo es blanco: sobre el fondo claro necesita su plaquita carbón */}
            <span style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--chrome-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={isotipo} alt="" style={{ width: 13, height: 13, display: 'block' }} />
            </span>
            Con tecnología <strong style={{ fontWeight: 700, color: 'var(--fg1)' }}>StopBet</strong>
          </p>
        </div>
      </main>
    </div>
  )
}

export function Notice({
  icon,
  title,
  children,
}: {
  icon: 'clock' | 'circle-alert' | 'calendar'
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-soft)',
        padding: '28px 26px',
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: 'var(--surface-alt)',
          color: 'var(--primary-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <WIcon name={icon} size={20} />
      </div>
      <div>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, color: 'var(--fg1)' }}>
          {title}
        </h2>
        <p style={{ margin: '7px 0 0', fontSize: 14, color: 'var(--fg2)', lineHeight: 1.6 }}>{children}</p>
      </div>
    </div>
  )
}
