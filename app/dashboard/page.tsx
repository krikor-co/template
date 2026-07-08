import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getCurrentLocale } from '@/lib/i18n/getLocale'
import { t } from '@/lib/i18n/messages'
import { getUserWorkspaces, isPlatformAdmin } from '@/lib/workspace/memberships'
import { route } from './contract'
import { LogoutButton } from './_components/LogoutButton/LogoutButton'
import { fixtures } from './_components/LogoutButton/fixtures'

/**
 * Post-login dispatcher. Resolves the user's workspace memberships:
 *   - exactly one   → redirect straight into it (no need to pick)
 *   - more than one → render a picker (plain example UI — restyle per app)
 *   - none          → redirect to /onboarding to create the first workspace
 *                     (platform admins are exempt — they keep the dashboard
 *                     even with no workspace of their own)
 *
 * Uncached I/O (session cookie + DB) resolves inside the <Suspense> child so
 * Next 16 Cache Components doesn't flag the route as blocking navigation, and
 * so the redirect-when-single still fires from within the boundary.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardHome />
    </Suspense>
  )
}

async function DashboardHome() {
  const session = await getSession()
  if (!session) redirect(route.exits.login())

  const memberships = await getUserWorkspaces(Number(session.userId))

  // Exactly one membership → skip the picker, go straight to the workspace.
  if (memberships.length === 1) {
    redirect(route.exits.workspace({ workspaceId: String(memberships[0].id) }))
  }

  const admin = await isPlatformAdmin(Number(session.userId))

  // Zero memberships → first-run: send to onboarding to create the first
  // workspace (instead of dead-ending on an empty list). Platform admins are
  // exempt — they keep the dashboard even with no workspace of their own.
  if (memberships.length === 0 && !admin) redirect(route.exits.onboarding())

  const locale = await getCurrentLocale()
  const m = t(locale).workspaces

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <div className="space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{m.kicker}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{m.heading}</h1>
          <p className="text-sm text-muted-foreground">{memberships.length ? m.pick : m.none}</p>
        </header>

        {memberships.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {memberships.map((w) => (
              <li key={w.id}>
                <Link
                  href={route.exits.workspace({ workspaceId: String(w.id) })}
                  className="block rounded-lg border bg-card p-5 transition-colors hover:bg-muted"
                >
                  <p className="font-medium text-foreground">{w.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{w.role}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <footer className="flex items-center justify-between border-t pt-6">
          <LogoutButton initialState={fixtures.idle} />
        </footer>
      </div>
    </main>
  )
}

function DashboardFallback() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12" aria-busy="true">
      <div className="space-y-8">
        <div className="h-24 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </main>
  )
}
