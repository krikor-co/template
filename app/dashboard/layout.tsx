import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requireSession, SessionGuardError } from '@/lib/auth/session'
import { route } from './contract'

/**
 * Dashboard chokepoint guard, in the Suspense guard shell shape
 * (docs/guards.md → "Suspense guard shells"):
 *
 *   sync layout → <Suspense fallback> → async shell (uncached I/O + redirect)
 *
 * The layout itself is SYNC so route navigation streams immediately; the
 * session check (cookie read + sessions-row lookup — uncached I/O under
 * Next 16 Cache Components) resolves inside the boundary, and redirect()
 * still works when thrown from within it.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardGuardFallback />}>
      <DashboardGuard>{children}</DashboardGuard>
    </Suspense>
  )
}

async function DashboardGuard({ children }: { children: React.ReactNode }) {
  try {
    await requireSession()
  } catch (err) {
    // Only the guard's own sentinel maps to a redirect — anything else is a
    // real bug and must surface, not silently bounce users to login.
    if (err instanceof SessionGuardError) redirect(route.exits.login())
    throw err
  }
  return <>{children}</>
}

/**
 * Footprint-matched fallback: mirrors the dashboard page's outer frame
 * (mx-auto max-w-3xl px-4 py-12 — see app/dashboard/page.tsx) so the
 * fallback → content swap doesn't shift layout.
 */
function DashboardGuardFallback() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12" aria-busy="true">
      <div className="space-y-8">
        <div className="h-24 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </main>
  )
}
