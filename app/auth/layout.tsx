import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { AUTH_TRANSITION_COOKIES } from "@/lib/auth/guards"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const session = await getSession()
  
  if (session && !(cookieStore.get(AUTH_TRANSITION_COOKIES.verify)?.value === '1')) redirect('/dashboard')

  return <>{children}</>
}