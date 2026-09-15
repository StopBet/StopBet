import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { WIcon } from '../components/WIcon'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { api, type AuthUser } from '../services/api'

type ConfigSection = 'perfil' | 'notificaciones' | 'sede' | 'seguridad'

function SectionNav({ active, onSelect }: { active: ConfigSection; onSelect: (s: ConfigSection) => void }) {
  const isNarrow = useIsNarrow()
  const sections: Array<{ id: ConfigSection; icon: string; label: string }> = [
    { id: 'perfil',         icon: 'user-round',    label: 'Perfil clínico'   },
    { id: 'notificaciones', icon: 'bell',          label: 'Notificaciones'   },
    { id: 'sede',           icon: 'map-pin',       label: 'Sede y equipo'    },
    { id: 'seguridad',      icon: 'shield',        label: 'Seguridad'        },
  ]
  return (
    // En el teléfono la columna de 220px se comía media pantalla. Pasan a pestañas
    // subrayadas en una sola línea, el patrón habitual en móvil: la clase .sb-tabs
    // esconde la barra de scroll sin impedir el desplazamiento.
    <div
      className={isNarrow ? 'sb-tabs' : undefined}
      style={{
        width: isNarrow ? '100%' : 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: isNarrow ? 'row' : 'column',
        gap: isNarrow ? 0 : 3,
        borderBottom: isNarrow ? '1px solid var(--border)' : undefined,
      }}
    >
      {sections.map(s => {
        const on = active === s.id
        return (
          <button key={s.id} onClick={() => onSelect(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: isNarrow ? 6 : 11, height: 44,
              padding: isNarrow ? '0 13px' : '0 12px',
              borderRadius: isNarrow ? 0 : 10,
              flexShrink: 0, whiteSpace: 'nowrap',
              border: 'none',
              background: isNarrow ? 'transparent' : (on ? 'var(--teal-50)' : 'transparent'),
              color: on ? 'var(--primary)' : 'var(--fg2)',
              fontFamily: 'var(--font-body)', fontSize: isNarrow ? 13.5 : 14.5,
              fontWeight: on ? 700 : 500, cursor: 'pointer', textAlign: 'left',
              // Angosto: subrayado bajo la activa. Ancho: la barra vertical de siempre.
              borderBottom: isNarrow ? `2.5px solid ${on ? 'var(--primary)' : 'transparent'}` : undefined,
              borderLeft: isNarrow ? undefined : (on ? '3px solid var(--primary)' : '3px solid transparent'),
              marginBottom: isNarrow ? -1 : undefined,
            }}>
            <WIcon name={s.icon} size={18} />
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

// Antes mostraba el perfil de una "Dra. González" inventada, con RUT y correo, en campos
// editables y con un "Guardar cambios" que no llamaba a nada. Ahora son los datos de la
// sesión, de solo lectura, hasta que exista un endpoint para editarlos.
function PerfilSection({ user }: { user: AuthUser }) {
  const isNarrow = useIsNarrow()
  const { data: sedes = [] } = useQuery({ queryKey: ['sedes'], queryFn: api.getSedes })
  // En el seed, users.sedeId guarda el nombre de la sede ("Santiago") y no su id: se aceptan ambos.
  const sedeName = sedes.find(s => s.id === user.sedeId || s.name === user.sedeId)?.name
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
  const rows: Array<[string, string]> = [
    ['Nombre', `${user.firstName} ${user.lastName}`.trim()],
    ['Correo', user.email],
    ['Rol', user.role === 'coordinator' ? 'Coordinación' : 'Psicólogo/a'],
    ['Sede', user.sedeId ? (sedeName ?? '—') : 'Sin sede asignada'],
  ]

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 26 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: isNarrow ? 0 : 280 }}>
        <dl style={{ margin: 0 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <dt style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', marginBottom: 4 }}>{label}</dt>
              <dd style={{ margin: 0, fontSize: 14.5, color: 'var(--fg1)' }}>{value}</dd>
            </div>
          ))}
        </dl>
        <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>
          Estos datos todavía no se pueden editar desde el panel.
        </p>
      </div>
    </div>
  )
}

// Estas secciones no tienen backend. Antes eran interruptores que no guardaban nada o barras
// grises que parecían una carga que nunca terminaba.
function ComingSoon({ desc }: { desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--surface-alt)', borderRadius: 12, padding: '16px 18px' }}>
      <WIcon name="clock" size={18} color="var(--primary)" />
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, color: 'var(--fg1)' }}>Próximamente</div>
        <div style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}

export function ConfiguracionPage({ user }: { user: AuthUser }) {
  const isNarrow = useIsNarrow()
  const [section, setSection] = useState<ConfigSection>('perfil')
  const titles: Record<ConfigSection, string> = {
    perfil: 'Perfil clínico',
    notificaciones: 'Notificaciones',
    sede: 'Sede y equipo',
    seguridad: 'Seguridad',
  }

  return (
    <div style={{ padding: isNarrow ? '16px 12px 28px' : 32, maxWidth: 1000, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 24px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 26, color: 'var(--fg1)' }}>Configuración</h2>

      <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', gap: isNarrow ? 14 : 28, alignItems: 'stretch' }}>
        <SectionNav active={section} onSelect={setSection} />

        <div style={{ flex: 1, minWidth: 0, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', padding: isNarrow ? '18px 16px' : '24px 28px' }}>
          <h2 style={{ margin: '0 0 20px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: 'var(--fg1)' }}>{titles[section]}</h2>

          {section === 'perfil'         && <PerfilSection user={user} />}
          {section === 'notificaciones' && <ComingSoon desc="Aquí vas a poder elegir qué avisos recibir." />}
          {section === 'sede'           && <ComingSoon desc="Aquí vas a poder ver a los integrantes de tu sede." />}
          {section === 'seguridad'      && <ComingSoon desc="Aquí vas a poder cambiar tu contraseña y cerrar tus sesiones abiertas." />}
        </div>
      </div>
    </div>
  )
}
