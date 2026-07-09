import { cookies } from "next/headers"
import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { transitions, AUTH_RETURN_TO_COOKIE } from "@/app/auth/guards"
import { entry as dashboardEntry } from "@/app/dashboard/entry"
import { safeReturnTo } from "@/lib/return-to"
import { LocaleProvider } from "@/lib/i18n/LocaleProvider"
import { getPublicLocale } from "@/lib/i18n/getLocale"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
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
