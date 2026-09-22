import { WIcon } from './WIcon'
import isotipo from '../assets/isotipo-blanco.png'
import logoAjuter from '../assets/logo-ajuter.png'
import logoAjuterBlanco from '../assets/logo-ajuter-blanco.png'
import type { AuthUser } from '../services/api'

type NavId = 'overview' | 'patients' | 'alerts' | 'requests' | 'familyLinks' | 'familySessions' | 'equipo' | 'reports' | 'finanzas' | 'settings'

interface SidebarProps {
  active: NavId
  onNav: (id: NavId) => void
  onLogout: () => void
  reqCount: number
  alertCount: number
  familyLinkCount: number
  user: AuthUser
}

// `soon`: la sección todavía no existe. Antes llevaban a "Sección en construcción";
// ahora se ven como lo que viene, sin prometer una pantalla al hacer clic.
const NAV_ITEMS: Array<{ id: NavId; icon: string; label: string; soon?: boolean }> = [
  { id: 'overview',  icon: 'house',          label: 'Resumen' },
  { id: 'patients',  icon: 'users',          label: 'Mis pacientes' },
  { id: 'alerts',    icon: 'triangle-alert', label: 'Alertas de pánico' },
  { id: 'requests',  icon: 'inbox',          label: 'Solicitudes' },
  { id: 'familyLinks', icon: 'user-round',   label: 'Familiares' },
  { id: 'familySessions', icon: 'heart-handshake', label: 'Sesiones de familiares' },
  { id: 'equipo',    icon: 'user-plus',      label: 'Equipo' },
  { id: 'reports',   icon: 'chart-column',   label: 'Reportes', soon: true },
  { id: 'finanzas',  icon: 'wallet',         label: 'Finanzas' },
  { id: 'settings',  icon: 'settings',       label: 'Configuración' },
]

export function Sidebar({ active, onNav, onLogout, reqCount, alertCount, familyLinkCount, user }: SidebarProps) {
  const displayName = `${user.firstName} ${user.lastName}`.trim()
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
  const roleLabel = user.role === 'coordinator' ? 'Coordinación' : 'Psicólogo/a'

  return (
    // overflowY auto: si el contenido no cabe en la altura de la ventana, antes el
    // bloque del usuario y "Cerrar sesión" quedaban fuera de pantalla sin forma de
    // llegar a ellos.
    <aside style={{
      width: 240, flexShrink: 0, background: 'var(--chrome-bg)', color: 'var(--fg-on-primary)',
      display: 'flex', flexDirection: 'column', position: 'sticky', top: 0,
      height: '100vh', overflowY: 'auto',
    }}>
      {/* Marca StopBet. El logo de AJUTER baja al pie: el producto encabeza, pero
          el panel sigue identificando a la institución que lo usa. Con los colores de
          AJUTER se invierte: la institución arriba y StopBet al pie. */}
      <div style={{ padding: '26px 24px 18px' }}>
        <div className="sb-only-ajuter">
          <img src={logoAjuterBlanco} alt="AJUTER" style={{ display: 'block', width: 132, height: 'auto' }} />
        </div>
        <div className="sb-only-stopbet">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11, flexShrink: 0,
              background: 'rgba(255,255,255,0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={isotipo} alt="" style={{ width: 23, height: 23, display: 'block' }} />
            </div>
            <span style={{
              fontFamily: 'var(--font-heading)', fontWeight: 700,
              fontSize: 22, letterSpacing: -0.5,
            }}>
              StopBet
            </span>
          </div>
        </div>
        <div style={{
          marginTop: 9, display: 'inline-block', fontSize: 12, fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--fg-on-primary)', background: 'var(--chrome-bg-active)',
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
          if (it.soon) {
            return (
              <div
                key={it.id}
                aria-disabled="true"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, height: 44,
                  padding: '0 12px 0 17px', color: 'rgba(255,255,255,0.92)',
                  fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14.5,
                }}
              >
                <WIcon name={it.icon} size={19} color="rgba(255,255,255,0.65)" />
                {/* Segunda línea en vez de una etiqueta al lado: la etiqueta partía
                    "Mis pacientes" en dos líneas dentro de los 240 px de la barra. */}
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                  {it.label}
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>Próximamente</span>
                </span>
              </div>
            )
          }
          return (
            <button
              key={it.id}
              onClick={() => onNav(it.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, height: 44,
                padding: '0 12px 0 14px', borderRadius: 10, border: 'none',
                cursor: 'pointer', textAlign: 'left',
                // Activo y hover oscurecen en vez de aclarar: un velo blanco sobre el azul
                // bajaba el texto blanco a 3,8:1. Con el azul oscuro de la marca queda en 6,5:1.
                background: on ? 'var(--chrome-bg-active)' : 'transparent',
                color: 'var(--fg-on-primary)', fontFamily: 'var(--font-body)',
                fontWeight: on ? 700 : 500, fontSize: 14.5,
                borderLeft: on ? '3px solid var(--chrome-accent)' : '3px solid transparent',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!on) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.10)' }}
              onMouseLeave={e => { if (!on) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <WIcon name={it.icon} size={19} color={on ? 'var(--fg-on-primary)' : 'rgba(255,255,255,0.82)'} />
              {/* nowrap: la negrita del ítem activo, más el contador, partía "Alertas de pánico" en dos líneas */}
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
              {it.id === 'alerts' && alertCount > 0 && (
                <span style={{ background: 'var(--danger)', color: 'var(--fg-on-primary)', borderRadius: 9999, fontSize: 12, fontWeight: 700, padding: '1px 7px' }}>{alertCount}</span>
              )}
              {it.id === 'requests' && reqCount > 0 && (
                <span style={{ background: 'var(--danger)', color: 'var(--fg-on-primary)', borderRadius: 9999, fontSize: 12, fontWeight: 700, padding: '1px 7px' }}>{reqCount}</span>
              )}
              {it.id === 'familyLinks' && familyLinkCount > 0 && (
                <span style={{ background: 'var(--danger)', color: 'var(--fg-on-primary)', borderRadius: 9999, fontSize: 12, fontWeight: 700, padding: '1px 7px' }}>{familyLinkCount}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Usuario logueado */}
      <div style={{ marginTop: 'auto', flexShrink: 0, padding: '12px 16px 18px' }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.14)', marginBottom: 12 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'var(--chrome-bg-active)', color: 'var(--fg-on-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15,
          }}>{initials}</div>
          <div style={{ lineHeight: 1.35, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-on-primary)' }}>{roleLabel}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            marginTop: 14, marginLeft: 51, background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
            gap: 6, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg-on-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.92)')}
        >
          {/* Antes usaba el salvavidas, que en esta app significa ayuda en una crisis */}
          <WIcon name="log-out" size={15} /> Cerrar sesión
        </button>

        {/* AJUTER es la institución dueña del panel: va al pie, en una sola línea.
            Antes ocupaba dos separadores más y empujaba al usuario fuera de la
            pantalla en ventanas de poca altura. */}
        <div className="sb-only-ajuter">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16 }}>
            <img src={isotipo} alt="" style={{ width: 16, height: 16, display: 'block', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--fg-on-primary)' }}>
              Con tecnología <strong style={{ fontWeight: 700 }}>StopBet</strong>
            </span>
          </div>
        </div>
        <div className="sb-only-stopbet">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--fg-on-primary)', flexShrink: 0 }}>Para</span>
            <div style={{ background: 'rgba(255,255,255,0.92)', borderRadius: 6, padding: '3px 7px', display: 'inline-block' }}>
              {/* Servido desde el repo, no desde ajuter.org: si el sitio del cliente cambia
                  o se cae, el panel pierde el logo, y cada carga quedaba registrada en un
                  servidor de terceros. */}
              <img
                src={logoAjuter}
                alt="AJUTER"
                style={{ display: 'block', maxWidth: 76, height: 'auto' }}
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
