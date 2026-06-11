import { useState } from 'react'
import { LoginPage } from './pages/LoginPage'
import { DashboardApp } from './DashboardApp'
import type { LoginResult } from './services/api'

const AUTH_KEY = 'sb-dashboard-auth'
const PSYCH_KEY = 'sb-dashboard-psych'

function readAuth() {
  return !!(localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY))
}

function readPsychId(): string | null {
  return localStorage.getItem(PSYCH_KEY) || sessionStorage.getItem(PSYCH_KEY)
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(readAuth)
  const [psychId, setPsychId] = useState<string | null>(readPsychId)

  const handleSuccess = (keepSession: boolean, user: LoginResult) => {
    const storage = keepSession ? localStorage : sessionStorage
    storage.setItem(AUTH_KEY, '1')
    storage.setItem(PSYCH_KEY, user.id)
    setPsychId(user.id)
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(PSYCH_KEY)
    sessionStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem(PSYCH_KEY)
    setPsychId(null)
    setIsLoggedIn(false)
  }

  if (!isLoggedIn) {
    return <LoginPage onSuccess={handleSuccess} />
  }

  return <DashboardApp psychId={psychId!} onLogout={handleLogout} />
}
