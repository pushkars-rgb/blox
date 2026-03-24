/**
 * Centralized email allowlist.
 *
 * Env vars (Vite):
 *   VITE_ALLOWED_EMAIL_DOMAINS  — comma-separated domains   (default: bsf.io)
 *   VITE_ALLOWED_EMAILS         — comma-separated exact addresses (optional)
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false

  const normalized = email.toLowerCase().trim()
  const domain = normalized.split('@')[1]
  if (!domain) return false

  const allowedDomains = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS ?? 'bsf.io')
    .split(',')
    .map((d: string) => d.trim().toLowerCase())
    .filter(Boolean)

  const allowedEmails = (import.meta.env.VITE_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean)

  if (allowedDomains.includes(domain)) return true
  if (allowedEmails.includes(normalized)) return true
  return false
}
