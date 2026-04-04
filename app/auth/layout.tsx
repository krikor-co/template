import { cookies } from "next/headers"
import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { transitions, AUTH_RETURN_TO_COOKIE } from "@/app/auth/guards"
import { entry as dashboardEntry } from "@/app/dashboard/entry"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (session && !(await transitions.verify.isActive())) {
    const cookieStore = await cookies()
    const returnTo = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value
    redirect(returnTo || dashboardEntry.href())
  }

  return <>{children}</>
}
