import { Suspense } from "react"
import { cookies } from "next/headers"
import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { transitions, AUTH_RETURN_TO_COOKIE } from "@/app/auth/guards"
import { entry as dashboardEntry } from "@/app/dashboard/entry"
import { safeReturnTo } from "@/lib/return-to"
import { LocaleProvider } from "@/lib/i18n/LocaleProvider"
import { getPublicLocale } from "@/lib/i18n/getLocale"

/**
 * Auth area chokepoint (already-signed-in visitors bounce out), in the
 * Suspense guard shell shape (docs/guards.md → "Suspense guard shells"):
 * sync layout, uncached I/O (session, cookies, locale) + redirect inside
 * the boundary.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AuthGuardFallback />}>
      <AuthGuard>{children}</AuthGuard>
    </Suspense>
  )
}

async function AuthGuard({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (session && !(await transitions.verify.isActive())) {
    const cookieStore = await cookies()
    // Same-origin only — a tampered cookie must never turn this into an open redirect.
    const returnTo = safeReturnTo(cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value)
    redirect(returnTo ?? dashboardEntry.href())
  }

  const locale = await getPublicLocale()

  return <LocaleProvider locale={locale}>{children}</LocaleProvider>
}

/**
 * Footprint-matched fallback: mirrors the auth pages' centered min-h-screen
 * max-w-md frame (see app/auth/identify/page.tsx) so the fallback → content
 * swap doesn't shift layout.
 */
function AuthGuardFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12" aria-busy="true">
      <div className="w-full max-w-md space-y-4">
        <div className="mx-auto h-8 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}
