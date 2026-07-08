import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { route } from './contract'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect(route.exits.login())
  return <>{children}</>
}
