import { useState, type FormEvent } from 'react'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { isAllowedEmail } from '../lib/allowlist'

type Stage = 'email-gate' | 'sign-in' | 'sign-up' | 'blocked'

export default function AuthScreen() {
  const [stage, setStage] = useState<Stage>('email-gate')
  const [email, setEmail] = useState('')

  function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    if (isAllowedEmail(trimmed)) {
      setStage('sign-in')
    } else {
      setStage('blocked')
    }
  }

  if (stage === 'email-gate') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-background px-4">
        <img src="/Blox-Full-Logo.svg" alt="Blox" className="h-6 dark:hidden" />
        <img src="/Blox-Full-Logo-Dark-Mode.svg" alt="Blox" className="h-6 hidden dark:block" />

        <div className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-col gap-1">
            <h1 className="text-base font-semibold text-foreground">Sign in to Blox</h1>
            <p className="text-sm text-muted-foreground">Enter your work email to continue.</p>
          </div>

          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@bsf.io"
              autoFocus
              required
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
            <button
              type="submit"
              className="h-9 w-full cursor-pointer rounded-md bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 active:opacity-80"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (stage === 'blocked') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-background px-4">
        <img src="/Blox-Full-Logo.svg" alt="Blox" className="h-6 dark:hidden" />
        <img src="/Blox-Full-Logo-Dark-Mode.svg" alt="Blox" className="h-6 hidden dark:block" />

        <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              className="text-muted-foreground" aria-hidden="true">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <div className="flex flex-col gap-1.5">
            <h1 className="text-base font-semibold text-foreground">Access restricted</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This workspace is restricted to approved users.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Tried: <span className="font-medium text-muted-foreground">{email}</span>
            </p>
          </div>

          <button
            onClick={() => { setEmail(''); setStage('email-gate') }}
            className="flex w-full cursor-pointer items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Try a different email
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Need access?{' '}
          <a href="mailto:admin@bsf.io"
            className="underline underline-offset-2 hover:text-foreground transition-colors">
            Request access
          </a>
        </p>
      </div>
    )
  }

  // stage === 'sign-in' | 'sign-up' — Clerk auth, email already validated
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-background px-4">
      <img src="/Blox-Full-Logo.svg" alt="Blox" className="h-6" />

      {stage === 'sign-in' ? (
        <SignIn routing="virtual" initialValues={{ emailAddress: email }} />
      ) : (
        <SignUp routing="virtual" initialValues={{ emailAddress: email }} />
      )}

      <p className="text-xs text-muted-foreground">
        {stage === 'sign-in' ? (
          <>
            Don't have an account?{' '}
            <button onClick={() => setStage('sign-up')}
              className="underline underline-offset-2 hover:text-foreground transition-colors cursor-pointer">
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button onClick={() => setStage('sign-in')}
              className="underline underline-offset-2 hover:text-foreground transition-colors cursor-pointer">
              Sign in
            </button>
          </>
        )}
        {' · '}
        <button onClick={() => setStage('email-gate')}
          className="underline underline-offset-2 hover:text-foreground transition-colors cursor-pointer">
          Back
        </button>
      </p>
    </div>
  )
}
