import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { DashboardApp } from './DashboardApp'
import { FamiliarPortal } from './pages/familiar/FamiliarPortal'
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

// La bandera y el usuario guardados son una pista de quién entró, no una credencial: sin
// token no hay sesión que valga. Creerles alcanzaba para renderizar el panel clínico entero
// con el nombre de un psicólogo y sus datos en blanco, sin volver nunca al login.
function hasStoredSession(): boolean {
  return (
    !!readStored(AUTH_KEY) &&
    !!readUser() &&
    (!!session.getAccessToken() || !!session.getRefreshToken())
  )
}

export default function App() {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(readUser)
  const [isLoggedIn, setIsLoggedIn] = useState(hasStoredSession)
  const [sessionExpired, setSessionExpired] = useState(false)

  const clearSession = () => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(AUTH_KEY)
      storage.removeItem(USER_KEY)
    }
    session.clear()
    // Las claves de caché no llevan el id del usuario, así que sin esto la cuenta
    // siguiente hereda lo que quedó de la anterior: pacientes, alertas, solicitudes,
    // sesiones del familiar. Y con `staleTime: 30_000` esos datos se consideran
    // frescos, así que ni siquiera se vuelven a pedir: se muestran tal cual hasta
    // medio minuto. Recargar la página lo tapaba porque la caché es solo de memoria.
    queryClient.clear()
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
        <Route path="/familiar/*" element={<FamiliarPortal user={user} onLogout={handleLogout} />} />
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

  return <DashboardApp psychId={user.id} user={user} onLogout={handleLogout} />
}
