import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { OverviewPage } from './pages/OverviewPage'
import { AlertasPage } from './pages/AlertasPage'
import { FinanzasPage } from './pages/FinanzasPage'
import { SolicitudesPage } from './pages/SolicitudesPage'
import { ConfiguracionPage } from './pages/ConfiguracionPage'
import { api } from './services/api'
import type { RegistrationRequest } from './data/mockData'

// TODO(auth): reemplazar con UUID real del psicólogo autenticado cuando auth esté implementado
const TEMP_PSYCH_ID = '22222222-2222-2222-2222-222222222222'

type NavId = 'overview' | 'patients' | 'alerts' | 'requests' | 'reports' | 'finanzas' | 'settings'

interface Toast { message: string; tone?: 'success' | 'error' }

const PAGE_TITLES: Record<NavId, string> = {
  overview:  'Resumen clínico',
  patients:  'Mis pacientes',
  alerts:    'Alertas de pánico',
  requests:  'Solicitudes de ingreso',
  reports:   'Reportes',
  finanzas:  'Finanzas',
  settings:  'Configuración',
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
      <div style={{ textAlign: 'center', color: 'var(--fg2)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: 'var(--fg1)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 14 }}>Sección en construcción.</div>
      </div>
    </div>
  )
}

function relTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days} días`
}

function shortSedeName(name: string): string {
  if (name.includes('Santiago')) return 'Santiago'
  if (name.includes('Viña')) return 'Viña del Mar'
  if (name.includes('Online')) return 'Online'
  if (name.includes('Concepción')) return 'Concepción'
  return name
}

export function DashboardApp({ onLogout }: { onLogout: () => void }) {
  const [nav, setNav] = useState<NavId>('overview')
  const [toast, setToast] = useState<Toast | null>(null)
  const qc = useQueryClient()

  const { data: pendingRaw = [] } = useQuery({
    queryKey: ['registration', 'pending'],
    queryFn: api.getPendingRequests,
  })

  const { data: sedes = [] } = useQuery({
    queryKey: ['sedes'],
    queryFn: api.getSedes,
  })

  const sedeMap = Object.fromEntries(sedes.map(s => [s.id, s.name]))

  const requests: RegistrationRequest[] = pendingRaw.map(r => ({
    id: r.id,
    initials: `${r.firstName[0] ?? ''}${r.lastName[0] ?? ''}`.toUpperCase(),
    name: `${r.firstName} ${r.lastName}`,
    email: r.email,
    sede: shortSedeName(sedeMap[r.sedeId] ?? r.sedeId),
    rel: relTime(r.createdAt),
    date: new Date(r.createdAt).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
    amount: '$30.000',
  }))

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const handleApprove = async (id: string) => {
    try {
      await api.approveRequest(id, TEMP_PSYCH_ID)
      qc.invalidateQueries({ queryKey: ['registration', 'pending'] })
      setToast({ message: 'Solicitud aprobada y paciente registrado.', tone: 'success' })
    } catch {
      setToast({ message: 'Error al aprobar la solicitud.', tone: 'error' })
    }
  }

  const handleReject = async (id: string) => {
    try {
      await api.rejectRequest(id, TEMP_PSYCH_ID)
      qc.invalidateQueries({ queryKey: ['registration', 'pending'] })
      setToast({ message: 'Solicitud rechazada. Se notificó al solicitante.', tone: 'error' })
    } catch {
      setToast({ message: 'Error al rechazar la solicitud.', tone: 'error' })
    }
  }

  const handleNav = (id: string) => setNav(id as NavId)

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Sidebar active={nav} onNav={id => setNav(id)} onLogout={onLogout} reqCount={requests.length} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar title={PAGE_TITLES[nav]} />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {nav === 'overview'  && <OverviewPage onNav={handleNav} reqCount={requests.length} />}
          {nav === 'alerts'    && <AlertasPage />}
          {nav === 'requests'  && <SolicitudesPage requests={requests} onApprove={handleApprove} onReject={handleReject} />}
          {nav === 'finanzas'  && <FinanzasPage />}
          {nav === 'settings'  && <ConfiguracionPage />}
          {(nav === 'patients' || nav === 'reports') && <PlaceholderPage title={PAGE_TITLES[nav]} />}
        </main>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink-900)', color: '#fff', borderRadius: 12,
          padding: '13px 22px', fontSize: 13.5, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: 'var(--shadow-strong)', zIndex: 60, whiteSpace: 'nowrap',
          animation: 'sb-rise 0.32s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: toast.tone === 'success' ? 'var(--sage-500)' : 'var(--danger)' }} />
          {toast.message}
        </div>
      )}
    </div>
  )
}
