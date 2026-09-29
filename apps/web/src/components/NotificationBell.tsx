import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { WIcon } from './WIcon'
import { api, type AppNotification } from '../services/api'
import { useIsNarrow } from '../hooks/useIsNarrow'

const QUERY_KEY = ['notifications']

// Solo los destinos que existen en la web. El resto de `target` son pantallas de la app del
// paciente: esas notificaciones se marcan leídas y nada más.
const WEB_ROUTES: Record<string, { path: string; label: string }> = {
  'family-links': { path: '/familiares', label: 'Ver en Familiares' },
}

// El tipo se distingue por el ícono, no solo por el color: la web no tiene un ámbar propio y
// advertencia e información comparten el color de marca. El fondo del cuadro sale del mismo
// color del ícono, para que se lea también sobre el tinte de "sin leer" y en modo oscuro.
const TYPE_STYLE: Record<AppNotification['type'], { icon: string; fg: string }> = {
  warning: { icon: 'triangle-alert', fg: 'var(--primary-text)' },
  info:    { icon: 'bell',           fg: 'var(--primary-text)' },
  success: { icon: 'circle-check',   fg: 'var(--secondary-text)' },
  danger:  { icon: 'circle-alert',   fg: 'var(--danger-text)' },
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  return `Hace ${Math.floor(hours / 24)} d`
}

// `chrome`: sobre el encabezado oscuro (portal del familiar, cabecera angosta del panel).
// `surface`: sobre la barra superior blanca del panel clínico.
export function NotificationBell({ variant }: { variant: 'surface' | 'chrome' }) {
  const [open, setOpen] = useState(false)
  const isNarrow = useIsNarrow()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  const { data: notifications = [], isPending, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: api.getNotifications,
    refetchInterval: 60_000,
  })
  const unread = notifications.filter(n => !n.read).length

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  // Optimista, como en la app móvil: si el PATCH falla, se vuelve a pedir la lista.
  const setRead = (ids: string[] | 'all') => {
    qc.setQueryData<AppNotification[]>(QUERY_KEY, old =>
      old?.map(n => (ids === 'all' || ids.includes(n.id) ? { ...n, read: true } : n)),
    )
  }

  const onItem = (n: AppNotification) => {
    if (!n.read) {
      setRead([n.id])
      api.markNotificationRead(n.id).catch(() => qc.invalidateQueries({ queryKey: QUERY_KEY }))
    }
    const route = n.target ? WEB_ROUTES[n.target] : undefined
    if (route) {
      setOpen(false)
      navigate(route.path)
    }
  }

  const onMarkAll = () => {
    setRead('all')
    api.markAllNotificationsRead().catch(() => qc.invalidateQueries({ queryKey: QUERY_KEY }))
  }

  const onChrome = variant === 'chrome'
  const size = onChrome ? 38 : 40
  const bellStyle: CSSProperties = {
    position: 'relative', width: size, height: size, borderRadius: '50%', padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    ...(onChrome
      ? {
          background: open ? 'var(--fg-on-primary)' : 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.45)',
          color: open ? 'var(--chrome-bg)' : 'var(--fg-on-primary)',
        }
      : {
          background: open ? 'var(--surface-alt)' : 'var(--bg)',
          border: '1px solid var(--border)',
          color: 'var(--fg1)',
        }),
  }

  const panelStyle: CSSProperties = isNarrow
    ? {
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 51,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        boxShadow: 'var(--shadow-strong)', animation: 'sb-sheet-in 0.24s var(--ease-calm)',
        paddingBottom: 12,
      }
    : {
        position: 'absolute', right: 0, top: 'calc(100% + 10px)', zIndex: 51,
        width: 380, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-strong)', overflow: 'hidden', textAlign: 'left',
      }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notificaciones"
        style={bellStyle}
      >
        <WIcon name="bell" size={18} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 4px',
              borderRadius: 9, background: 'var(--primary)', color: 'var(--fg-on-primary)',
              fontSize: 11, fontWeight: 700, lineHeight: 1, boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${onChrome ? 'var(--chrome-bg)' : 'var(--surface)'}`,
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && isNarrow && (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--scrim)', animation: 'sb-scrim-in 0.2s ease' }}
        />
      )}

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          style={{ ...panelStyle, outline: 'none', color: 'var(--fg1)' }}
        >
          {isNarrow && (
            <div aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border)', margin: '10px auto 2px', flexShrink: 0 }} />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: isNarrow ? '10px 20px 14px' : '18px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div>
              <h2 id={titleId} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, color: 'var(--fg1)' }}>
                Notificaciones
              </h2>
              {!isPending && !isError && (
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--fg2)' }}>
                  {unread > 0 ? `${unread} sin leer` : 'Estás al día'}
                </p>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAll}
                style={{ background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--primary-text)', flexShrink: 0 }}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto' }}>
            {isPending ? (
              <Skeleton />
            ) : isError ? (
              <EmptyState
                icon="circle-alert"
                title="No pudimos cargar tus notificaciones"
                body="Revisa tu conexión e inténtalo de nuevo."
                action={{ label: 'Reintentar', onClick: () => void refetch() }}
              />
            ) : notifications.length === 0 ? (
              <EmptyState
                icon="bell"
                title="No tienes notificaciones"
                body="Acá van a llegar los avisos sobre familiares y tu sede."
              />
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {notifications.map(n => (
                  <NotificationItem key={n.id} n={n} onClick={() => onItem(n)} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationItem({ n, onClick }: { n: AppNotification; onClick: () => void }) {
  const t = TYPE_STYLE[n.type] ?? TYPE_STYLE.info
  const route = n.target ? WEB_ROUTES[n.target] : undefined
  return (
    <li style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          position: 'relative', display: 'flex', gap: 12, width: '100%', minHeight: 44,
          padding: '16px 20px 16px 26px', border: 'none', textAlign: 'left', cursor: 'pointer',
          font: 'inherit', color: 'inherit',
          background: n.read ? 'transparent' : 'color-mix(in srgb, var(--primary) 7%, var(--surface))',
        }}
      >
        {!n.read && (
          <span style={{ position: 'absolute', left: 11, top: 29, width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)' }} />
        )}
        {!n.read && <span className="sb-sr-only">Sin leer. </span>}
        <span style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0, color: t.fg,
          background: `color-mix(in srgb, ${t.fg} 16%, var(--surface))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: n.read ? 0.6 : 1,
        }}>
          <WIcon name={t.icon} size={17} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1, opacity: n.read ? 0.6 : 1 }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, lineHeight: 1.3, color: 'var(--fg1)' }}>
            {n.title}
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--fg2)' }}>{n.body}</span>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: 'var(--fg2)' }}>
            <span>{timeAgo(n.createdAt)}</span>
            {route && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12.5, fontWeight: 600, color: 'var(--primary-text)' }}>
                {route.label}
                <WIcon name="chevron-right" size={14} />
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

function Skeleton() {
  const bar = (width: string, height: number): CSSProperties => ({
    width, height, borderRadius: 6, background: 'var(--surface-alt)',
    animation: 'sb-skeleton 1.4s ease-in-out infinite',
  })
  return (
    <div aria-busy="true" aria-label="Cargando notificaciones">
      {[80, 65, 75].map(w => (
        <div key={w} style={{ display: 'flex', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ ...bar('34px', 34), borderRadius: 9, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, paddingTop: 2 }}>
            <div style={bar(`${w}%`, 12)} />
            <div style={bar('100%', 10)} />
            <div style={bar(`${w - 25}%`, 10)} />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  icon, title, body, action,
}: { icon: string; title: string; body: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '36px 32px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-alt)', color: 'var(--fg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <WIcon name={icon} size={28} />
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--fg1)' }}>{title}</div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--fg2)', maxWidth: 260 }}>{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            marginTop: 8, height: 40, padding: '0 20px', borderRadius: 9999, border: 'none', cursor: 'pointer',
            background: 'var(--primary)', color: 'var(--fg-on-primary)', fontSize: 14, fontWeight: 600,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
