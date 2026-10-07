import { useState } from 'react'
import {
  KIND_LABEL, generarPerfil, type DemoCuenta, type DemoKind, type DemoPerfil,
} from '../utils/demoProfiles'

const KINDS: DemoKind[] = ['paciente-existe', 'paciente-no-existe']

function CopyButton({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1400)
    } catch {
      // Sin permiso del portapapeles: el valor sigue visible y se puede seleccionar a mano.
    }
  }
  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={`Copiar ${etiqueta}`}
      style={{
        flexShrink: 0, minHeight: 30, padding: '0 10px', borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${copiado ? 'var(--secondary-text)' : 'var(--border)'}`,
        background: 'transparent', fontSize: 12, fontWeight: 600,
        color: copiado ? 'var(--secondary-text)' : 'var(--primary-text)',
      }}
    >
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function CredencialRow({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span style={{ width: 52, flexShrink: 0, fontSize: 12, color: 'var(--fg2)' }}>{etiqueta}</span>
      <code style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--fg1)', overflowWrap: 'anywhere', userSelect: 'all' }}>{valor}</code>
      <CopyButton valor={valor} etiqueta={etiqueta.toLowerCase()} />
    </div>
  )
}

/** Correo, clave y RUT de una cuenta de demo, con «Copiar». Lo usan el panel y la pantalla de éxito. */
export function DemoCredenciales({ cuenta }: { cuenta: DemoCuenta }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <CredencialRow etiqueta="Correo" valor={cuenta.email} />
      <CredencialRow etiqueta="Clave" valor={cuenta.password} />
      <CredencialRow etiqueta="RUT" valor={cuenta.rut} />
    </div>
  )
}

const cajaDemo: React.CSSProperties = {
  background: 'var(--surface-alt)', border: '1.5px dashed var(--border)', borderRadius: 14, padding: '14px 16px',
}

/**
 * Modo demo del registro de familiar: genera un familiar nuevo, con datos únicos, y lo escribe en
 * el formulario. Lista además las cuentas que ya se crearon en este navegador, para poder entrar
 * con ellas después. Solo aparece con `?demo=1` (ver `useModoDemo`).
 */
export function DemoProfilesPanel({
  onFill, cuentas, onClear,
}: { onFill: (perfil: DemoPerfil) => void; cuentas: DemoCuenta[]; onClear: () => void }) {
  return (
    <div style={{ ...cajaDemo, marginBottom: 22 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--primary-text)' }}>
        Modo demo
      </div>
      <p style={{ margin: '6px 0 12px', fontSize: 13, color: 'var(--fg2)', lineHeight: 1.5 }}>
        Cada botón escribe en el formulario un familiar <strong style={{ color: 'var(--fg1)' }}>nuevo, con datos que no se repiten</strong>.
        Después solo toca «Crear cuenta». Para otra cuenta, vuelve a tocar un botón.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onFill(generarPerfil(kind))}
            style={{
              textAlign: 'left', cursor: 'pointer', padding: '10px 14px', borderRadius: 12,
              border: '1.5px solid var(--primary)', background: 'var(--surface)',
            }}
          >
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--primary-text)' }}>{KIND_LABEL[kind].titulo}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--fg2)', marginTop: 2 }}>{KIND_LABEL[kind].detalle}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)' }}>Cuentas creadas en este navegador</span>
          {cuentas.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--primary-text)', textDecoration: 'underline' }}
            >
              Borrar lista
            </button>
          )}
        </div>
        {cuentas.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg2)', lineHeight: 1.5 }}>
            Todavía no hay ninguna. Cada cuenta que registres aparece acá con su correo y su clave.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cuentas.map((cuenta, i) => (
              <div key={cuenta.email} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)' }}>
                  Familiar {cuentas.length - i} · {cuenta.nombre}
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg2)', margin: '2px 0 8px' }}>{cuenta.declara}</div>
                <DemoCredenciales cuenta={cuenta} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Las cuentas ya creadas, en el login, con un botón «Usar» que rellena correo y clave. */
export function DemoCuentasLogin({
  cuentas, onUse,
}: { cuentas: DemoCuenta[]; onUse: (cuenta: DemoCuenta) => void }) {
  if (cuentas.length === 0) return null
  return (
    <div style={{ ...cajaDemo, marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--primary-text)', marginBottom: 8 }}>
        Cuentas de demo
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cuentas.map((cuenta, i) => (
          <div key={cuenta.email} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg1)' }}>Familiar {cuentas.length - i} · {cuenta.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--fg2)', overflowWrap: 'anywhere' }}>{cuenta.email}</div>
            </div>
            <button
              type="button"
              onClick={() => onUse(cuenta)}
              aria-label={`Usar la cuenta de ${cuenta.nombre} (${cuenta.email})`}
              style={{ flexShrink: 0, minHeight: 36, padding: '0 14px', borderRadius: 9999, border: '1.5px solid var(--primary)', background: 'var(--surface)', color: 'var(--primary-text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Usar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
