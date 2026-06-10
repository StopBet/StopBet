import { useState } from 'react'
import { LoginPage } from './pages/LoginPage'
import { DashboardApp } from './DashboardApp'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  if (!isLoggedIn) {
    return <LoginPage onSuccess={() => setIsLoggedIn(true)} />
  }

  return <DashboardApp onLogout={() => setIsLoggedIn(false)} />
}
