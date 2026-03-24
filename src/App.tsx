import { useUser } from '@clerk/clerk-react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { isAllowedEmail } from './lib/allowlist'
import Dashboard from './pages/Dashboard'
import Editor from './pages/Editor'
import AuthScreen from './pages/AuthScreen'
import AccessDenied from './pages/AccessDenied'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser()

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground"
          aria-label="Loading"
        />
      </div>
    )
  }

  if (!isSignedIn) return <AuthScreen />

  const email = user.primaryEmailAddress?.emailAddress ?? null
  const allowed = isAllowedEmail(email)

  console.log('User email:', email)
  console.log('Allowed:', allowed)

  if (!allowed) return <AccessDenied email={email} />

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor/:projectId" element={<Editor />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  )
}
