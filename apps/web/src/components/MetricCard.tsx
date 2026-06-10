import type { ReactNode } from 'react'
import { WIcon } from './WIcon'

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
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, background: 'var(--surface)', borderRadius: 16,
        border: '1px solid var(--border)',
        borderLeft: important ? `4px solid ${t.fg}` : '1px solid var(--border)',
        boxShadow: 'var(--shadow-soft)', padding: 20,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: 'var(--fg2)', fontWeight: 600 }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: t.bg, color: t.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <WIcon name={icon} size={18} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 36, color: t.fg, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {tone === 'red' && (
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)', marginTop: 3, flexShrink: 0, animation: 'sb-pulse 1.8s ease-in-out infinite' }} />
        )}
      </div>
      {sub && (
        <div style={{ fontSize: 12.5, color: 'var(--fg2)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
