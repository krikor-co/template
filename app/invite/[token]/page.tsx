import { Suspense } from 'react'
import Link from 'next/link'
import { getPublicLocale } from '@/lib/i18n/getLocale'
import { t } from '@/lib/i18n/messages'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'
import { route } from './contract'
import { loadInvite, type InviteLoad } from './_lib/loadInvite'
import { AcceptForm } from './_sections/AcceptForm/Component'

type Props = {
  params:       Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Public invite-accept page. Magic-link accept: the token (from the invitee's
 * email) is the credential — no separate sign-in needed. The accept action
 * provisions identity + a session on accept.
 *
 * No top-level uncached awaits — everything resolves inside the Suspense'd
 * child per Next 16 Cache Components.
 */
export default async function InvitePage({ params, searchParams }: Props) {
  const p  = await params
  const sp = await searchParams
  const parsed = route.entry.parse({ params: p, searchParams: sp, cookies: {} })

  return (
    <Suspense
      fallback={
        <InviteShell>
          <div className="space-y-6" aria-busy="true">
            <div className="space-y-3">
              <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
              <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          </div>
        </InviteShell>
      }
    >
      <InviteContent token={parsed.token} />
    </Suspense>
  )
}

async function InviteContent({ token }: { token: string }) {
  const [locale, loaded] = await Promise.all([
    getPublicLocale(),
    loadInvite(token),
  ])
  const m = t(locale)

  if (!loaded.ok) {
    return (
      <LocaleProvider locale={locale}>
        <InviteShell>
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{m.invite.title}</p>
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
                {m.invite.title}
              </h1>
              <p className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {errorCopy(loaded, m)}
              </p>
            </div>
            <Link
              href={route.exits.dashboard()}
              className="block w-full rounded-md border px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted"
            >
              {m.invite.error.goHome}
            </Link>
          </div>
        </InviteShell>
      </LocaleProvider>
    )
  }

  return (
    <LocaleProvider locale={locale}>
      <InviteShell>
        <AcceptForm
          token={token}
          workspaceId={String(loaded.invite.workspaceId)}
          workspaceName={loaded.invite.workspaceName}
          role={loaded.invite.role}
          existingName={loaded.invite.existingName}
        />
      </InviteShell>
    </LocaleProvider>
  )
}

function errorCopy(loaded: Extract<InviteLoad, { ok: false }>, m: ReturnType<typeof t>): string {
  switch (loaded.reason) {
    case 'notFound': return m.invite.error.notFound
    case 'expired':  return m.invite.error.expired
    case 'used':     return m.invite.error.used
    case 'revoked':  return m.invite.error.revoked
    default:         return m.invite.error.generic
  }
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  )
}
