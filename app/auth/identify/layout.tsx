import { canIdentify } from "@/lib/auth/guards"
import { redirect } from "next/navigation"

export default async function IdentifyLayout({ children, searchParams }: { children: React.ReactNode, searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const sp = await searchParams
    const returnTo = sp?.returnTo && typeof sp.returnTo === 'string' ? sp.returnTo : undefined
  
    const to = await canIdentify({ returnTo })
    if (to) redirect(to)
      
  return <>{children}</>
}