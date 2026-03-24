import { useClerk } from '@clerk/clerk-react'

export default function AccessDenied({ email }: { email: string | null }) {
  const { signOut } = useClerk()

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-background px-4">
      <img src="/Blox-Full-Logo.svg" alt="Blox" className="h-6" />

      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
            aria-hidden="true"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-base font-semibold text-foreground">Access restricted</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This workspace is restricted to approved users.
          </p>
          {email && (
            <p className="mt-1 text-xs text-muted-foreground/70">
              Signed in as <span className="font-medium text-muted-foreground">{email}</span>
            </p>
          )}
        </div>

        <button
          onClick={() => signOut()}
          className="flex w-full cursor-pointer items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Sign out
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Need access?{' '}
        <a
          href="mailto:admin@bsf.io"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Request access
        </a>
      </p>
    </div>
  )
}
