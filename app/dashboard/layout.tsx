import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { route } from './contract'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) {
    redirect(route.exits.login())
  }
  return <>{children}</>
}