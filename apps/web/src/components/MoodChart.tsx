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

  if (data.length === 0) {
    return (
      <div style={{
        height: H, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--fg2)', fontSize: 13,
      }}>
        Sin check-ins registrados
      </div>
    )
  }

  const linePtsFinal = data.map((d, i) => `${xFor(i).toFixed(1)},${yFor(d.mood).toFixed(1)}`).join(' ')
  const areaPtsFinal = `${padL},${padT + ih} ${linePtsFinal} ${padL + iw},${padT + ih}`

  // Una etiqueta por punto es ilegible: con 30 días de check-ins, las 30 fechas se
  // apilaban unas sobre otras en el eje. Se eligen los índices **desde el final** para
  // que la fecha más reciente siempre aparezca y las anteriores queden a una distancia
  // pareja; forzar la última encima de una serie calculada desde el principio la hacía
  // chocar con su vecina.
  const ANCHO_ETIQUETA = 56
  const sepPuntos = data.length > 1 ? iw / (data.length - 1) : iw
  const cadaCuantos = Math.max(1, Math.ceil(ANCHO_ETIQUETA / sepPuntos))
  const ultimo = data.length - 1
  const conEtiqueta = new Set<number>()
  for (let i = ultimo; i >= 0; i -= cadaCuantos) conEtiqueta.add(i)

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
      <polygon points={areaPtsFinal} fill="color-mix(in srgb, var(--primary) 10%, transparent)" />
      <polyline points={linePtsFinal} fill="none"
        stroke="var(--primary-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xFor(i)} cy={yFor(d.mood)} r={d.alert ? 5.5 : 3.5}
            fill={d.alert ? 'var(--danger)' : 'var(--surface)'}
            stroke={d.alert ? 'var(--surface)' : 'var(--primary-text)'} strokeWidth={2} />
          {d.label && conEtiqueta.has(i) && (
            <text x={xFor(i)} y={H - 9}
              textAnchor={i === ultimo && data.length > 1 ? 'end' : 'middle'}
              fontSize="12" fill="var(--fg2)" fontFamily="var(--font-body)">{d.label}</text>
          )}
        </g>
      ))}
    </svg>
  )
}
