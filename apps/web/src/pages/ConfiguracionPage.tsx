import { useState } from 'react'
import { WIcon } from '../components/WIcon'

type ConfigSection = 'perfil' | 'notificaciones' | 'sede' | 'seguridad'

function SectionNav({ active, onSelect }: { active: ConfigSection; onSelect: (s: ConfigSection) => void }) {
  const sections: Array<{ id: ConfigSection; icon: string; label: string }> = [
    { id: 'perfil',         icon: 'user-round',    label: 'Perfil clínico'   },
    { id: 'notificaciones', icon: 'bell',          label: 'Notificaciones'   },
    { id: 'sede',           icon: 'map-pin',       label: 'Sede y equipo'    },
    { id: 'seguridad',      icon: 'shield',        label: 'Seguridad'        },
  ]
  return (
    <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {sections.map(s => {
        const on = active === s.id
        return (
          <button key={s.id} onClick={() => onSelect(s.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, height: 44, padding: '0 12px', borderRadius: 10, border: 'none', background: on ? 'var(--teal-50)' : 'transparent', color: on ? 'var(--primary)' : 'var(--fg2)', fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: on ? 700 : 500, cursor: 'pointer', textAlign: 'left', borderLeft: on ? '3px solid var(--primary)' : '3px solid transparent' }}>
            <WIcon name={s.icon} size={18} />
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--fg1)' }}>{label}</div>
        <div style={{ fontSize: 12.5, color: 'var(--fg2)', marginTop: 2 }}>{desc}</div>
      </div>
      <button onClick={onChange} style={{
        width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0, position: 'relative',
        background: value ? 'var(--primary)' : 'var(--border)', transition: 'background 0.2s',
      }}>
        <span style={{ position: 'absolute', top: 3, left: value ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.14)' }} />
      </button>
    </div>
  )
}

function PerfilSection() {
  const fieldStyle: React.CSSProperties = { height: 42, width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', padding: '0 12px', fontSize: 13.5, color: 'var(--fg1)', outline: 'none' }
  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {/* Avatar card */}
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 28 }}>MG</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--fg1)' }}>Dra. González</div>
          <div style={{ fontSize: 12.5, color: 'var(--fg2)', marginTop: 2 }}>Psicóloga clínica</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexDirection: 'column', width: '100%' }}>
          <span style={{ display: 'inline-block', background: 'var(--teal-50)', color: 'var(--primary)', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>Sede Santiago</span>
          <span style={{ display: 'inline-block', background: 'var(--amber-50)', color: 'var(--accent)', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, textAlign: 'center' }}>24 pacientes activos</span>
        </div>
        <button style={{ background: 'none', border: '1.5px dashed var(--border)', borderRadius: 10, padding: '8px 16px', fontSize: 13, color: 'var(--fg2)', cursor: 'pointer', width: '100%' }}>
          Cambiar foto
        </button>
      </div>

      {/* Form */}
      <div style={{ flex: 1, minWidth: 320 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          {[
            { l: 'Nombre', v: 'María', placeholder: 'Nombre' },
            { l: 'Apellido', v: 'González', placeholder: 'Apellido' },
          ].map(({ l, v, placeholder }) => (
            <div key={l}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 5 }}>{l}</label>
              <input defaultValue={v} placeholder={placeholder} style={fieldStyle} />
            </div>
          ))}
        </div>
        {[
          { l: 'Correo profesional', v: 'm.gonzalez@ajuter.cl', placeholder: 'correo@ajuter.cl' },
          { l: 'Número de RUT / Registro profesional', v: '15.234.789-K', placeholder: 'RUT' },
          { l: 'Especialidad', v: 'Psicología clínica — Ludopatía', placeholder: 'Especialidad' },
        ].map(({ l, v, placeholder }) => (
          <div key={l} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg2)', display: 'block', marginBottom: 5 }}>{l}</label>
            <input defaultValue={v} placeholder={placeholder} style={fieldStyle} />
          </div>
        ))}
        <button style={{ marginTop: 6, height: 46, padding: '0 28px', borderRadius: 9999, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
          Guardar cambios
        </button>
      </div>
    </div>
  )
}

function NotificacionesSection() {
  const [state, setState] = useState({
    panic:     true,
    checkin:   true,
    sessions:  false,
    payments:  true,
  })
  const toggle = (k: keyof typeof state) => setState(s => ({ ...s, [k]: !s[k] }))
  const rows: Array<{ k: keyof typeof state; label: string; desc: string }> = [
    { k: 'panic',    label: 'Alertas de pánico',       desc: 'Notificación push inmediata cuando un paciente activa el botón de pánico.' },
    { k: 'checkin',  label: 'Check-ins emocionales',   desc: 'Resumen diario de check-ins completados por tus pacientes.' },
    { k: 'sessions', label: 'Sesiones con IA',         desc: 'Aviso cuando un paciente completa una sesión de contención con el asistente.' },
    { k: 'payments', label: 'Pagos y cobros',          desc: 'Recordatorio de pagos pendientes y confirmación de cobros.' },
  ]
  return (
    <div>
      {rows.map(r => (
        <ToggleRow key={r.k} label={r.label} desc={r.desc} value={state[r.k]} onChange={() => toggle(r.k)} />
      ))}
    </div>
  )
}

function SkeletonSection({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ padding: '28px 0' }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--fg1)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--fg2)', marginBottom: 18 }}>{desc}</div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: 40, borderRadius: 10, background: 'var(--border)', marginBottom: 12, opacity: 0.5 }} />
      ))}
      <div style={{ height: 40, borderRadius: 9999, background: 'var(--teal-50)', width: 160 }} />
    </div>
  )
}

export function ConfiguracionPage() {
  const [section, setSection] = useState<ConfigSection>('perfil')
  const titles: Record<ConfigSection, string> = {
    perfil: 'Perfil clínico',
    notificaciones: 'Notificaciones',
    sede: 'Sede y equipo',
    seguridad: 'Seguridad',
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000, minWidth: 820, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <h1 style={{ margin: '0 0 24px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 26, color: 'var(--fg1)' }}>Configuración</h1>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        <SectionNav active={section} onSelect={setSection} />

        <div style={{ flex: 1, minWidth: 0, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)', padding: '24px 28px' }}>
          <h2 style={{ margin: '0 0 20px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: 'var(--fg1)' }}>{titles[section]}</h2>

          {section === 'perfil'         && <PerfilSection />}
          {section === 'notificaciones' && <NotificacionesSection />}
          {section === 'sede'           && <SkeletonSection title="Sede y equipo" desc="Administra los integrantes y configuraciones de tu sede." />}
          {section === 'seguridad'      && <SkeletonSection title="Seguridad" desc="Cambia tu contraseña y gestiona sesiones activas." />}
        </div>
      </div>
    </div>
  )
}
