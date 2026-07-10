import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requireWorkspaceRole, WorkspaceGuardError } from '@/app/workspace/guards'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'
import { getCurrentLocale } from '@/lib/i18n/getLocale'
import { route } from './contract'

/**
 * Workspace membership chokepoint, in the Suspense guard shell shape
 * (docs/guards.md → "Suspense guard shells"): the layout is SYNC so route
 * navigation streams immediately; the membership check + locale read
 * (uncached I/O) resolve in an async child inside the boundary, where
 * `redirect()` still works.
 */
export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  return (
    <Suspense fallback={<WorkspaceGuardFallback />}>
      <WorkspaceGuard params={params}>{children}</WorkspaceGuard>
    </Suspense>
  )
}

async function WorkspaceGuard({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  try {
    await requireWorkspaceRole(workspaceId, ['owner', 'member'])
  } catch (e) {
    // Only the guard's own sentinel maps to a redirect — anything else is a
    // real bug and must surface, not silently bounce users away.
    if (e instanceof WorkspaceGuardError) {
      if (e.reason === 'unauthenticated') {
        redirect(route.exits.login({ workspaceId }))
      }
      redirect(route.exits.dashboard())
    }
    throw e
  }
  const locale = await getCurrentLocale()
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>
}

/**
 * Footprint-matched fallback: mirrors the workspace pages' centered
 * min-h-screen frame (see app/workspace/[workspaceId]/(app)/page.tsx) so the
 * fallback → content swap doesn't shift layout.
 */
function WorkspaceGuardFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
    </main>
  )
}
