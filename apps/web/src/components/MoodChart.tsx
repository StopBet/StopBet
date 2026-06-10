interface MoodPoint {
  label: string
  mood: number
  alert?: boolean
}

export function MoodChart({ data }: { data: MoodPoint[] }) {
  const W = 416, H = 230, padL = 34, padR = 14, padT = 16, padB = 30
  const iw = W - padL - padR
  const ih = H - padT - padB
  const yFor = (m: number) => padT + ih - ((m - 1) / 4) * ih
  const xFor = (i: number) => padL + (data.length === 1 ? 0 : (i / (data.length - 1)) * iw)
  const linePts = data.map((d, i) => `${xFor(i).toFixed(1)},${yFor(d.mood).toFixed(1)}`).join(' ')
  const areaPts = `${padL},${padT + ih} ${linePts} ${padL + iw},${padT + ih}`

  const defaultData: MoodPoint[] = [
    { label: '1 may', mood: 3 }, { label: '8 may', mood: 4 },
    { label: '15 may', mood: 4 }, { label: '22 may', mood: 3 }, { label: '29 may', mood: 4 },
  ]
  const pts = data.length ? data : defaultData

  const linePtsFinal = pts.map((d, i) => `${xFor(i).toFixed(1)},${yFor(d.mood).toFixed(1)}`).join(' ')
  const areaPtsFinal = `${padL},${padT + ih} ${linePtsFinal} ${padL + iw},${padT + ih}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="230" style={{ display: 'block', overflow: 'visible' }}>
      {[1, 2, 3, 4, 5].map(m => (
        <g key={m}>
          <line x1={padL} y1={yFor(m)} x2={padL + iw} y2={yFor(m)}
            stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
          <text x={padL - 9} y={yFor(m) + 4} textAnchor="end"
            fontSize="11" fill="var(--fg2)" fontFamily="var(--font-body)">{m}</text>
        </g>
      ))}
      <polygon points={areaPtsFinal} fill="rgba(232,136,58,0.10)" />
      <polyline points={linePtsFinal} fill="none"
        stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((d, i) => (
        <g key={i}>
          <circle cx={xFor(i)} cy={yFor(d.mood)} r={d.alert ? 5.5 : 3.5}
            fill={d.alert ? 'var(--danger)' : '#fff'}
            stroke={d.alert ? '#fff' : 'var(--primary)'} strokeWidth={2} />
          {d.label && (
            <text x={xFor(i)} y={H - 9} textAnchor="middle"
              fontSize="10.5" fill="var(--fg2)" fontFamily="var(--font-body)">{d.label}</text>
          )}
        </g>
      ))}
    </svg>
  )
}
