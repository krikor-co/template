import { Suspense } from "react"
import { redirect } from "next/navigation"
import { canIdentify } from "@/app/auth/guards"

/**
 * Identify-step guard, in the Suspense guard shell shape (docs/guards.md →
 * "Suspense guard shells"): the layout is SYNC so route navigation streams
 * immediately; the guard's uncached I/O (cookies, session) + redirect
 * resolve in an async child inside the boundary.
 */
export default function IdentifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<IdentifyGuardFallback />}>
      <IdentifyGuard>{children}</IdentifyGuard>
    </Suspense>
  )
}

async function IdentifyGuard({ children }: { children: React.ReactNode }) {
  const to = await canIdentify()
  if (to) redirect(to)

  return <>{children}</>
}

/**
 * Footprint-matched fallback: mirrors the auth step pages' centered
 * min-h-screen max-w-md frame (see ./page.tsx) so the fallback → content
 * swap doesn't shift layout.
 */
function IdentifyGuardFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12" aria-busy="true">
      <div className="w-full max-w-md space-y-4">
        <div className="mx-auto h-8 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}
