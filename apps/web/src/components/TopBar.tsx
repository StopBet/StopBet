import { WIcon } from './WIcon'

interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header style={{
      height: 64, flexShrink: 0, background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      boxShadow: '0 1px 3px rgba(30,45,44,0.04)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', position: 'sticky', top: 0, zIndex: 5,
    }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--fg1)' }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Campana de notificaciones */}
        <button style={{
          position: 'relative', width: 40, height: 40, borderRadius: '50%',
          border: '1px solid var(--border)', background: 'var(--surface)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WIcon name="bell" size={19} color="var(--fg1)" />
          <span style={{
            position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18,
            padding: '0 4px', borderRadius: 9999, background: 'var(--danger)',
            color: '#fff', fontSize: 10.5, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--surface)', boxSizing: 'border-box',
          }}>3</span>
        </button>

        {/* Búsqueda */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, width: 240, height: 40,
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '0 14px',
        }}>
          <WIcon name="search" size={17} color="var(--fg2)" />
          <input
            placeholder="Buscar paciente…"
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13.5, color: 'var(--fg1)', width: '100%' }}
          />
        </label>

        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: 'var(--secondary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13,
        }}>MG</div>
      </div>
    </header>
  )
}
