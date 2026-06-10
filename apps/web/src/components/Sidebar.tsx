import { WIcon } from './WIcon'

type NavId = 'overview' | 'patients' | 'alerts' | 'requests' | 'reports' | 'finanzas' | 'settings'

interface SidebarProps {
  active: NavId
  onNav: (id: NavId) => void
  onLogout: () => void
  reqCount: number
}

const NAV_ITEMS: Array<{ id: NavId; icon: string; label: string }> = [
  { id: 'overview',  icon: 'house',          label: 'Resumen' },
  { id: 'patients',  icon: 'users',          label: 'Mis pacientes' },
  { id: 'alerts',    icon: 'triangle-alert', label: 'Alertas de pánico' },
  { id: 'requests',  icon: 'inbox',          label: 'Solicitudes' },
  { id: 'reports',   icon: 'chart-column',   label: 'Reportes' },
  { id: 'finanzas',  icon: 'wallet',         label: 'Finanzas' },
  { id: 'settings',  icon: 'settings',       label: 'Configuración' },
]

export function Sidebar({ active, onNav, onLogout, reqCount }: SidebarProps) {
  return (
    <aside style={{
      width: 240, flexShrink: 0, background: 'var(--primary)', color: '#fff',
      display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Logo AJUTER */}
      <div style={{ padding: '26px 24px 18px' }}>
        <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: '8px 12px', display: 'inline-block' }}>
          <img
            src="https://ajuter.org/wp-content/uploads/2025/04/Logo-Ajuter-con-texto.png"
            alt="AJUTER"
            style={{ display: 'block', maxWidth: 160, height: 'auto' }}
          />
        </div>
        <div style={{
          marginTop: 9, display: 'inline-block', fontSize: 11, fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.10)',
          borderRadius: 9999, padding: '3px 10px',
        }}>
          Panel clínico
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', margin: '4px 16px 12px' }} />

      {/* Navegación */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 12px' }}>
        {NAV_ITEMS.map(it => {
          const on = active === it.id
          return (
            <button
              key={it.id}
              onClick={() => onNav(it.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 44,
                padding: '0 12px 0 14px', borderRadius: 10, border: 'none',
                cursor: 'pointer', textAlign: 'left',
                background: on ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: '#fff', fontFamily: 'var(--font-body)',
                fontWeight: on ? 700 : 500, fontSize: 14.5,
                borderLeft: on ? '3px solid #fff' : '3px solid transparent',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!on) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)' }}
              onMouseLeave={e => { if (!on) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <WIcon name={it.icon} size={19} color={on ? '#fff' : 'rgba(255,255,255,0.82)'} />
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.id === 'alerts' && (
                <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 9999, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>3</span>
              )}
              {it.id === 'requests' && reqCount > 0 && (
                <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 9999, fontSize: 11, fontWeight: 700, padding: '1px 7px' }}>{reqCount}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Usuario logueado */}
      <div style={{ marginTop: 'auto', padding: '16px 16px 22px' }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', marginBottom: 16 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,0.16)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15,
          }}>MG</div>
          <div style={{ lineHeight: 1.35, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>Dra. González</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }}>Sede Santiago</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            marginTop: 14, marginLeft: 51, background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: 600,
            cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
            gap: 6, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
        >
          <WIcon name="life-buoy" size={14} /> Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
