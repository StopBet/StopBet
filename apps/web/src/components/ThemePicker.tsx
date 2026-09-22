import { useState } from 'react'
import {
  isBrandActive, readThemePref, saveBrandPref, saveThemePref,
  type BrandPref, type ThemePref,
} from '../utils/theme'

// Dos ejes independientes: Tema (claro/oscuro) y Colores (StopBet o los de la institución).
// Se combinan: AJUTER tiene su versión clara y su versión oscura.
// Lo usan Configuración del panel clínico y Ajustes del portal del familiar.

type Option<T extends string> = { id: T; titulo: string; desc: string; swatches?: string[] }

// Mismas tres opciones que la app mobile (Perfil → Apariencia). No alcanza con seguir al
// sistema: alguien puede tener el computador en claro y preferir el panel oscuro de noche.
const THEME_OPTIONS: Option<ThemePref>[] = [
  { id: 'auto',  titulo: 'Automático', desc: 'Sigue la configuración de tu sistema.' },
  { id: 'light', titulo: 'Claro',      desc: 'Fondo claro, siempre.' },
  { id: 'dark',  titulo: 'Oscuro',     desc: 'Fondo oscuro, más cómodo de noche.' },
]

// Las muestras son la paleta de cada manual tal cual, no los tokens: ilustran la marca,
// no pintan texto.
const BRAND_OPTIONS: Option<BrandPref>[] = [
  { id: 'stopbet', titulo: 'StopBet', desc: 'Los colores de la plataforma.', swatches: ['#396fb6', '#93bce5', '#c2d66e'] },
  { id: 'ajuter',  titulo: 'AJUTER',  desc: 'Los colores y la letra de AJUTER.', swatches: ['#EDB734', '#c08026', '#272727'] },
]

function RadioCards<T extends string>({
  label, options, value, onChange,
}: {
  label: string
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map(o => {
        const on = value === o.id
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer',
              padding: '14px 16px', borderRadius: 12, background: on ? 'var(--surface-alt)' : 'var(--surface)',
              border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            <span aria-hidden style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
              border: `2px solid ${on ? 'var(--primary-text)' : 'var(--fg2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-text)' }} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5, color: 'var(--fg1)' }}>{o.titulo}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--fg2)', marginTop: 2 }}>{o.desc}</span>
            </span>
            {o.swatches && (
              <span aria-hidden style={{ display: 'flex', flexShrink: 0 }}>
                {o.swatches.map((c, i) => (
                  <span key={c} style={{
                    width: 20, height: 20, borderRadius: '50%', background: c,
                    border: '2px solid var(--surface)', marginLeft: i === 0 ? 0 : -6,
                  }} />
                ))}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const groupTitle: React.CSSProperties = {
  margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--fg2)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

export function ThemePicker({ label }: { label: string }) {
  const [theme, setTheme] = useState<ThemePref>(readThemePref)
  // Se lee lo que está aplicado y no lo guardado: si la persona nunca eligió, lo aplicado es
  // el valor por defecto de su institución (useBrandInShell).
  const [brand, setBrand] = useState<BrandPref>(() => (isBrandActive() ? 'ajuter' : 'stopbet'))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h4 style={groupTitle}>Tema</h4>
        <RadioCards
          label={label}
          options={THEME_OPTIONS}
          value={theme}
          onChange={(v) => { setTheme(v); saveThemePref(v) }}
        />
      </div>
      <div>
        <h4 style={groupTitle}>Colores</h4>
        <RadioCards
          label="Colores"
          options={BRAND_OPTIONS}
          value={brand}
          onChange={(v) => { setBrand(v); saveBrandPref(v) }}
        />
      </div>
    </div>
  )
}
