import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { DashboardApp } from './DashboardApp'
import { FamiliarPortalPlaceholder } from './pages/familiar/FamiliarPortalPlaceholder'
import { api, session, type AuthUser, type LoginResponse } from './services/api'

const AUTH_KEY = 'sb-dashboard-auth'
const USER_KEY = 'sb-dashboard-user'

function readStored(key: string): string | null {
  return localStorage.getItem(key) || sessionStorage.getItem(key)
}

function readUser(): AuthUser | null {
  const raw = readStored(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(readUser)
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!readStored(AUTH_KEY) && !!readUser())
  const [sessionExpired, setSessionExpired] = useState(false)

  const clearSession = () => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(AUTH_KEY)
      storage.removeItem(USER_KEY)
    }
    session.clear()
    setUser(null)
    setIsLoggedIn(false)
  }

  // api.ts avisa cuando el refresh token dejó de servir: se vuelve al login
  // con el banner que LoginPage ya tenía implementado.
  useEffect(() => {
    session.setOnSessionExpired(() => {
      clearSession()
      setSessionExpired(true)
    })
    return () => session.setOnSessionExpired(null)
  }, [])

  const handleSuccess = (keepSession: boolean, result: LoginResponse) => {
    const storage = keepSession ? localStorage : sessionStorage
    session.setTokens(result, keepSession)
    storage.setItem(AUTH_KEY, '1')
    storage.setItem(USER_KEY, JSON.stringify(result.user))
    setUser(result.user)
    setSessionExpired(false)
    setIsLoggedIn(true)
  }

  const handleLogout = async () => {
    await api.logout()
    clearSession()
  }

  if (!isLoggedIn || !user) {
    return <LoginPage sessionExpired={sessionExpired} onSuccess={handleSuccess} />
  }

  // El portal familiar se enruta acá y no dentro de DashboardApp: el catch-all
  // de DashboardApp redirige cualquier ruta desconocida a "/".
  if (user.role === 'family') {
    return (
      <Routes>
        <Route path="/familiar" element={<FamiliarPortalPlaceholder user={user} onLogout={handleLogout} />} />
        <Route path="*" element={<Navigate to="/familiar" replace />} />
      </Routes>
    )
  }

  if (user.role !== 'psychologist' && user.role !== 'coordinator') {
    // LoginPage ya filtra por rol; esto cubre una sesión vieja en storage y
    // evita que un paciente aterrice en el shell clínico.
    clearSession()
    return <LoginPage onSuccess={handleSuccess} />
  }

  return <DashboardApp psychId={user.id} onLogout={handleLogout} />
}
