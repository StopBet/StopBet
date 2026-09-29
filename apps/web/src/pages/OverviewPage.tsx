import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { WIcon } from '../components/WIcon'
import { MetricCard } from '../components/MetricCard'
import { AlertStatusBadge } from '../components/AlertStatusBadge'
import { api } from '../services/api'
import type { AuthUser } from '../services/api'
import { useAlertsRealtime } from '../hooks/useAlertsRealtime'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { needsAttention } from '../utils/alertStatus'
import { followUp, relTime, shortSedeName } from '../utils/patientView'

// El Resumen es un vistazo, no un lugar de trabajo: un bloque por sección, que responde una
// sola pregunta y lleva a la sección con un clic. El detalle - tablas, seguimiento, reportes -
// vive en cada sección. Antes esta página tenía la tabla completa de pacientes y el
// generador de PDF, y se leía como una sección de pacientes más que como un resumen.

const MAX_ITEMS = 3

interface OverviewPageProps {
  user: AuthUser
}

function Block({ icon, title, count, tone = 'neutral', children, cta, onCta }: {
  icon: string
  title: string
  count?: number
  tone?: 'danger' | 'neutral'
  children: ReactNode
  cta: string
  onCta: () => void
}) {
  const alerta = tone === 'danger' && (count ?? 0) > 0
  return (
    <section style={{
      background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
      borderColor: alerta ? 'var(--danger)' : 'var(--border)', boxShadow: 'var(--shadow-soft)',
      padding: 20, display: 'flex', flexDirection: 'column', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <WIcon name={icon} size={18} color={alerta ? 'var(--danger-text)' : 'var(--primary-text)'} />
        <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: 'var(--fg1)' }}>{title}</h2>
        {count !== undefined && (
          <span style={{
            marginLeft: 'auto', borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 700,
            background: alerta ? 'var(--red-50)' : 'var(--bg)', color: alerta ? 'var(--danger-text)' : 'var(--fg2)',
          }}>{count}</span>
        )}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
      <button onClick={onCta} style={{
        marginTop: 14, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color: 'var(--primary-text)', fontSize: 13, fontWeight: 700,
      }}>
        {cta} <WIcon name="arrow-right" size={14} />
      </button>
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p style={{ margin: '4px 0', fontSize: 13.5, color: 'var(--fg2)' }}>{children}</p>
}

function Item({ title, meta, right }: { title: string; meta?: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--fg1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {meta && <div style={{ fontSize: 12, color: 'var(--fg2)', marginTop: 1 }}>{meta}</div>}
      </div>
      {right}
    </div>
  )
}

function Chip({ text, tone }: { text: string; tone: 'danger' | 'warn' }) {
  return (
    <span style={{
      flexShrink: 0, borderRadius: 9999, padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
      background: tone === 'danger' ? 'var(--red-50)' : 'var(--surface-alt)',
      color: tone === 'danger' ? 'var(--danger-text)' : 'var(--primary-text)',
    }}>{text}</span>
  )
}

export function OverviewPage({ user }: OverviewPageProps) {
  const navigate = useNavigate()
  const isNarrow = useIsNarrow()
  const esCoordinador = user.role === 'coordinator'
  useAlertsRealtime()

  // Mismas claves que las secciones: TanStack comparte la caché, así que ir del Resumen a
  // una sección no vuelve a pedir lo mismo.
  const { data: patients = [], isLoading } = useQuery({ queryKey: ['patients'], queryFn: api.getPatients })
  const { data: alertHistory = [] } = useQuery({ queryKey: ['alerts', 'history'], queryFn: api.getAlertHistory, refetchInterval: 30_000 })
  const { data: pending = [] } = useQuery({ queryKey: ['registration', 'pending'], queryFn: api.getPendingRequests })
  const { data: sedes = [] } = useQuery({ queryKey: ['sedes'], queryFn: api.getSedes })
  const { data: sesiones = [] } = useQuery({ queryKey: ['family', 'sede-sessions'], queryFn: api.getSedeFamilySessions })
  // La moderación es solo de psicólogos: al coordinador el backend le responde 403.
  const { data: flagged = [] } = useQuery({
    queryKey: ['flagged-posts'],
    queryFn: () => api.getFlaggedPosts(),
    enabled: !esCoordinador,
  })
  const { data: psicologos = [] } = useQuery({
    queryKey: ['psychologists'],
    queryFn: api.getPsychologists,
    enabled: esCoordinador,
  })

  if (isLoading) {
    return (
      <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <span style={{ color: 'var(--fg2)', fontSize: 14 }}>Cargando resumen…</span>
      </div>
    )
  }

  const sedeName = (id: string | null) => {
    const s = sedes.find(x => x.id === id)
    return shortSedeName(s?.name ?? id ?? '-')
  }
  const misIds = new Set(patients.map(p => p.id))
  const abrirPaciente = (id: string) => navigate(`/pacientes?paciente=${id}`)

  // ── Alertas: las que piden acción ahora, no las de hoy ─────────────────────
  const alertasActivas = alertHistory
    .filter(a => needsAttention(a.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // ── Seguimiento: la misma regla que «Mis pacientes» ────────────────────────
  const seguimiento = patients.map(followUp).filter(r => r.flags.length > 0)
    .sort((a, b) => (b.sinCheckIn ?? 999) - (a.sinCheckIn ?? 999))

  // ── Por revisar ───────────────────────────────────────────────────────────
  const porRevisar = pending.length + (esCoordinador ? 0 : flagged.length)

  // ── Próxima sesión de familiares ──────────────────────────────────────────
  const ahora = new Date().toISOString()
  const proximas = sesiones.filter(s => s.sessionDate >= ahora).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
  const proxima = proximas[0]
  const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
  // Solo la primera letra en mayúscula: `text-transform: capitalize` las ponía todas
  // («16 De Septiembre, 07:00 P. M.»).
  const fechaLarga = (iso: string) => {
    const d = new Date(iso)
    const dia = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
    const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${hora} h`
  }

  // ── Equipo (solo coordinación) ────────────────────────────────────────────
  const activos = psicologos.filter(p => p.accountStatus === 'active')
  const sedesCubiertas = new Set(activos.flatMap(p => p.sedes.map(s => s.id)))
  const sedesSinPsicologo = sedes.filter(s => s.isActive && !sedesCubiertas.has(s.id))

  return (
    <div style={{ padding: isNarrow ? '16px 14px 32px' : '22px 26px 40px' }}>
      <div style={{
        display: 'grid', gap: isNarrow ? 12 : 16, marginBottom: isNarrow ? 12 : 18,
        // auto-fit en vez de un número fijo de columnas: en una laptop más chica (entre los
        // 860px de "angosto" y los ~1300px que 4 tarjetas completas necesitan) minmax(0,1fr)
        // no alcanzaba a evitar que la cuarta tarjeta se cortara contra el borde. Con auto-fit
        // el navegador decide solo cuántas entran sin desbordar, para cualquier ancho.
        gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
      }}>
        <MetricCard icon="triangle-alert" label="Alertas activas" value={alertasActivas.length}
          sub="esperando respuesta o escaladas" tone="red" important={alertasActivas.length > 0} />
        <MetricCard icon="users" label="Requieren seguimiento" value={seguimiento.length}
          sub={esCoordinador ? `de ${patients.length} pacientes` : `de tus ${patients.length} pacientes`} />
        <MetricCard icon="inbox" label="Por revisar" value={porRevisar}
          sub={esCoordinador
            ? `${pending.length} ${pending.length === 1 ? 'solicitud' : 'solicitudes'}`
            : `${pending.length} ${pending.length === 1 ? 'solicitud' : 'solicitudes'} · ${flagged.length} ${flagged.length === 1 ? 'post' : 'posts'}`} />
        <MetricCard icon="calendar" label="Próxima sesión familiar" value={proxima ? fechaCorta(proxima.sessionDate) : '-'}
          sub={proxima ? `${proxima.confirmedCount} ${proxima.confirmedCount === 1 ? 'confirmación' : 'confirmaciones'}` : 'sin sesiones programadas'} />
      </div>

      <div style={{
        display: 'grid', gap: isNarrow ? 12 : 16, alignItems: 'stretch',
        gridTemplateColumns: isNarrow ? '1fr' : 'repeat(2, minmax(0, 1fr))',
      }}>
        <Block icon="triangle-alert" title="Alertas que requieren atención" count={alertasActivas.length} tone="danger"
          cta="Ir a Alertas de pánico" onCta={() => navigate('/alertas')}>
          {alertasActivas.length === 0
            ? <Empty>Ninguna alerta está esperando respuesta.</Empty>
            : alertasActivas.slice(0, MAX_ITEMS).map(a => (
              <Item key={a.id} title={a.patientName} meta={`${relTime(a.createdAt)} · ${sedeName(a.sedeId)}`}
                right={<>
                  <AlertStatusBadge status={a.status} />
                  {misIds.has(a.patientId) && (
                    <button onClick={() => abrirPaciente(a.patientId)} aria-label={`Ver seguimiento de ${a.patientName}`}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary-text)', display: 'flex' }}>
                      <WIcon name="chevron-right" size={18} />
                    </button>
                  )}
                </>} />
            ))}
          {alertasActivas.length > MAX_ITEMS && <Empty>y {alertasActivas.length - MAX_ITEMS} más</Empty>}
        </Block>

        <Block icon="users" title="Requieren seguimiento" count={seguimiento.length}
          cta="Ir a Mis pacientes" onCta={() => navigate('/pacientes')}>
          {seguimiento.length === 0
            ? <Empty>{patients.length === 0 ? 'Todavía no tienes pacientes asignados.' : 'Nadie muestra señales de alerta esta semana.'}</Empty>
            : seguimiento.slice(0, MAX_ITEMS).map(r => (
              <Item key={r.p.id} title={r.name}
                right={<>
                  <Chip text={r.flags[0].label} tone={r.flags[0].tone} />
                  <button onClick={() => abrirPaciente(r.p.id)} aria-label={`Ver seguimiento de ${r.name}`}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary-text)', display: 'flex' }}>
                    <WIcon name="chevron-right" size={18} />
                  </button>
                </>} />
            ))}
          {seguimiento.length > MAX_ITEMS && <Empty>y {seguimiento.length - MAX_ITEMS} más</Empty>}
        </Block>

        <Block icon="inbox" title="Por revisar" count={porRevisar}
          cta="Ir a Solicitudes" onCta={() => navigate('/solicitudes')}>
          {porRevisar === 0
            ? <Empty>No hay solicitudes ni publicaciones reportadas pendientes.</Empty>
            : <>
              {pending.slice(0, MAX_ITEMS).map(r => (
                <Item key={r.id} title={`${r.firstName} ${r.lastName}`} meta={`Solicitud de ingreso · ${sedeName(r.sedeId)} · ${relTime(r.createdAt)}`} />
              ))}
              {pending.length > MAX_ITEMS && <Empty>y {pending.length - MAX_ITEMS} {pending.length - MAX_ITEMS === 1 ? 'solicitud más' : 'solicitudes más'}</Empty>}
              {!esCoordinador && flagged.length > 0 && (
                <Item title={`${flagged.length} ${flagged.length === 1 ? 'publicación reportada' : 'publicaciones reportadas'}`} meta="Comunidad · esperando moderación" />
              )}
            </>}
        </Block>

        <Block icon="heart-handshake" title="Próxima sesión de familiares"
          cta="Ir a Sesiones de familiares" onCta={() => navigate('/sesiones-familiares')}>
          {!proxima
            ? <Empty>No hay sesiones programadas.</Empty>
            : <>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--fg1)' }}>{proxima.title}</div>
              <div style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 4 }}>{fechaLarga(proxima.sessionDate)}</div>
              <div style={{ fontSize: 13, color: 'var(--fg2)', marginTop: 2 }}>{proxima.isOnline ? 'Online' : proxima.location}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13, color: 'var(--fg1)' }}>
                <span><strong>{proxima.confirmedCount}</strong> confirman</span>
                <span><strong>{proxima.declinedCount}</strong> no asisten</span>
              </div>
              {proximas.length > 1 && <Empty>y {proximas.length - 1} {proximas.length - 1 === 1 ? 'sesión más programada' : 'sesiones más programadas'}</Empty>}
            </>}
        </Block>

        {esCoordinador && (
          <Block icon="user-plus" title="Equipo" count={sedesSinPsicologo.length} tone="danger"
            cta="Ir a Equipo" onCta={() => navigate('/equipo')}>
            <Item title={`${activos.length} ${activos.length === 1 ? 'psicólogo activo' : 'psicólogos activos'}`}
              meta={`${psicologos.length - activos.length} ${psicologos.length - activos.length === 1 ? 'cuenta desactivada' : 'cuentas desactivadas'}`} />
            {sedesSinPsicologo.length === 0
              ? <Empty>Todas las sedes activas tienen al menos un psicólogo.</Empty>
              : sedesSinPsicologo.map(s => (
                <Item key={s.id} title={shortSedeName(s.name)} meta="Sede sin psicólogo activo" right={<Chip text="Sin cobertura" tone="danger" />} />
              ))}
          </Block>
        )}
      </div>
    </div>
  )
}
