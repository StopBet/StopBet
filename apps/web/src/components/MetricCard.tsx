import type { ReactNode } from 'react'
import { WIcon } from './WIcon'
import { useIsNarrow } from '../hooks/useIsNarrow'

type Tone = 'teal' | 'sage' | 'amber' | 'gold' | 'red'

const TONES: Record<Tone, { bg: string; fg: string }> = {
  teal:  { bg: 'var(--teal-50)',  fg: 'var(--primary)' },
  sage:  { bg: 'var(--sage-50)',  fg: 'var(--sage-500)' },
  amber: { bg: 'var(--amber-50)', fg: 'var(--accent)' },
  gold:  { bg: 'var(--gold-50)',  fg: 'var(--gold)' },
  red:   { bg: 'var(--red-50)',   fg: 'var(--danger)' },
}

interface MetricCardProps {
  icon: string
  label: string
  value: string | number
  sub?: ReactNode
  tone?: Tone
  important?: boolean
  onClick?: () => void
}

export function MetricCard({ icon, label, value, sub, tone = 'teal', important, onClick }: MetricCardProps) {
  const t = TONES[tone]
  const isNarrow = useIsNarrow()

  // En dos columnas de teléfono el título se parte en dos líneas y una cifra
  // como "$150.000" a 36 px no cabe. Se achica el valor según su largo.
  const valueLength = String(value).length
  const valueSize = isNarrow
    ? (valueLength > 6 ? 24 : valueLength > 3 ? 30 : 34)
    : 36

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0, background: 'var(--surface)', borderRadius: 16,
        border: '1px solid var(--border)',
        borderLeft: important ? `4px solid ${t.fg}` : '1px solid var(--border)',
        boxShadow: 'var(--shadow-soft)', padding: isNarrow ? '14px 14px 16px' : 20,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {/* flex-start, no center: con el título en dos líneas el icono quedaba a media
          altura y se leía como encimado. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: isNarrow ? 10 : 14 }}>
        <span style={{ fontSize: isNarrow ? 12.5 : 13, color: 'var(--fg2)', fontWeight: 600, minWidth: 0, lineHeight: 1.3 }}>{label}</span>
        <div style={{ width: isNarrow ? 28 : 34, height: isNarrow ? 28 : 34, borderRadius: isNarrow ? 8 : 10, flexShrink: 0, background: t.bg, color: t.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <WIcon name={icon} size={isNarrow ? 15 : 18} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: valueSize, color: t.fg, lineHeight: 1, fontVariantNumeric: 'tabular-nums', minWidth: 0, overflowWrap: 'anywhere' }}>
          {value}
        </span>
        {tone === 'red' && (
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)', marginTop: 3, flexShrink: 0, animation: 'sb-pulse 1.8s ease-in-out infinite' }} />
        )}
      </div>
      {sub && (
        <div style={{ fontSize: isNarrow ? 11.5 : 12.5, color: 'var(--fg2)', marginTop: isNarrow ? 6 : 8, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', lineHeight: 1.35 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
