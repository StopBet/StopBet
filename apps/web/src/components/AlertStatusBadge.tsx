import { WIcon } from './WIcon'
import { ALERT_STATUS, type PanicStatus } from '../utils/alertStatus'

export function AlertStatusBadge({ status }: { status: PanicStatus }) {
  const s = ALERT_STATUS[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: s.bg, color: s.fg, borderRadius: 9999, padding: '5px 12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <WIcon name={s.icon} size={13} />
      {s.label}
    </span>
  )
}
