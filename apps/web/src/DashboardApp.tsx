import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { OverviewPage } from './pages/OverviewPage'
import { AlertasPage } from './pages/AlertasPage'
import { FinanzasPage } from './pages/FinanzasPage'
import { SolicitudesPage } from './pages/SolicitudesPage'
import { ConfiguracionPage } from './pages/ConfiguracionPage'
import { INITIAL_REQUESTS, type RegistrationRequest } from './data/mockData'

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

export function DashboardApp({ onLogout }: { onLogout: () => void }) {
  const [nav, setNav] = useState<NavId>('overview')
  const [requests, setRequests] = useState<RegistrationRequest[]>(INITIAL_REQUESTS)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const handleApprove = (id: string) => {
    setRequests(r => r.filter(x => x.id !== id))
    setToast({ message: 'Solicitud aprobada y paciente registrado.', tone: 'success' })
  }

  const handleReject = (id: string) => {
    setRequests(r => r.filter(x => x.id !== id))
    setToast({ message: 'Solicitud rechazada. Se notificó al solicitante.', tone: 'error' })
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
