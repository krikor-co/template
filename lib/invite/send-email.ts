import { headers } from 'next/headers'
import { Resend } from 'resend'
import { t } from '@/lib/i18n/messages'
import type { Locale } from '@/lib/i18n/types'

/**
 * Resolve the absolute base URL for invite links.
 *
 * Mirrors what the rest of the codebase uses for absolute URLs: the
 * `NEXT_PUBLIC_APP_URL` env (set in `.env` to `http://localhost:3000`).
 * When it's absent we derive it from the incoming request's `host` header
 * (and `x-forwarded-proto`) so the link still points back at the caller.
 */
export async function getBaseUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')

  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Sends the invite email via Resend (same construction as the auth OTP flow:
 * `new Resend(RESEND_API_KEY)` + `resend.emails.send`, `from` =
 * `RESEND_FROM_EMAIL`). Email copy is localized via lib/i18n; English is the
 * default locale.
 *
 * Returns `{ ok }` — the caller decides whether a send failure should fail
 * the whole action.
 */
export async function sendInviteEmail(input: {
  to:            string
  token:         string
  workspaceName: string
  role:          string
  locale:        Locale
}): Promise<{ ok: boolean }> {
  const baseUrl = await getBaseUrl()
  const acceptUrl = `${baseUrl}/invite/${input.token}`
  const m = t(input.locale).invite
  const roleLabel = m.roles[input.role as keyof typeof m.roles] ?? input.role

  const { error } = await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
    to:      input.to,
    subject: m.email.subject(input.workspaceName),
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5;">
        <p>${m.email.greeting}</p>
        <p>${m.email.body(input.workspaceName, roleLabel)}</p>
        <p>
          <a href="${acceptUrl}"
             style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:6px;text-decoration:none;">
            ${m.email.cta}
          </a>
        </p>
        <p style="color:#888;font-size:13px;">${acceptUrl}</p>
        <p style="color:#888;font-size:13px;">${m.email.ignore}</p>
      </div>
    `,
  })

  return { ok: !error }
}
