import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { route } from './contract'

/**
 * Onboarding chokepoint guard, in the Suspense guard shell shape
 * (docs/guards.md → "Suspense guard shells"): the layout is SYNC so route
 * navigation streams immediately; the session check (cookie read +
 * sessions-row lookup) resolves inside the boundary, where `redirect()`
 * still works.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<OnboardingGuardFallback />}>
      <OnboardingGuard>{children}</OnboardingGuard>
    </Suspense>
  )
}

async function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect(route.exits.login())
  return <>{children}</>
}

/**
 * Footprint-matched fallback: mirrors the onboarding page's centered
 * min-h-screen column (see app/onboarding/page.tsx) so the fallback →
 * content swap doesn't shift layout.
 */
function OnboardingGuardFallback() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center"
      aria-busy="true"
    >
      <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
    </main>
  )
}
