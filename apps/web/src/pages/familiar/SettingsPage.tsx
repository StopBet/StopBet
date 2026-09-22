import { useNavigate } from 'react-router-dom'
import { ThemePicker } from '../../components/ThemePicker'
import { WIcon } from '../../components/WIcon'
import type { AuthUser } from '../../services/api'
import { Shell } from './Shell'

const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  boxShadow: 'var(--shadow-soft)',
  padding: 22,
}

const sectionTitle: React.CSSProperties = {
  margin: '0 0 4px',
  fontFamily: 'var(--font-heading)',
  fontWeight: 700,
  fontSize: 16,
  color: 'var(--fg1)',
}

export function SettingsPage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const navigate = useNavigate()
  const rows: Array<[string, string]> = [
    ['Nombre', `${user.firstName} ${user.lastName}`.trim()],
    ['Correo', user.email],
  ]

  return (
    <Shell user={user} onLogout={onLogout}>
      <button
        onClick={() => navigate('/familiar')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, marginBottom: 18, color: 'var(--primary-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
      >
        <WIcon name="chevron-left" size={17} />
        Volver al portal
      </button>

      <h2 style={{ margin: '0 0 20px', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, color: 'var(--fg1)' }}>
        Ajustes
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section style={sectionStyle} aria-labelledby="ajustes-apariencia">
          <h3 id="ajustes-apariencia" style={sectionTitle}>Apariencia</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--fg2)' }}>
            Se guarda en este navegador.
          </p>
          <ThemePicker label="Tema del portal" />
        </section>

        {/* De solo lectura, igual que el perfil del panel clínico: no hay endpoint para editarlos. */}
        <section style={sectionStyle} aria-labelledby="ajustes-cuenta">
          <h3 id="ajustes-cuenta" style={sectionTitle}>Mi cuenta</h3>
          <dl style={{ margin: 0 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <dt style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', marginBottom: 4 }}>{label}</dt>
                <dd style={{ margin: 0, fontSize: 14.5, color: 'var(--fg1)', overflowWrap: 'anywhere' }}>{value}</dd>
              </div>
            ))}
          </dl>
          <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>
            Para cambiar tus datos, escríbele al equipo clínico de la sede.
          </p>
        </section>
      </div>
    </Shell>
  )
}
