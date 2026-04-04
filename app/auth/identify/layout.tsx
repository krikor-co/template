import { canIdentify } from "@/app/auth/guards"
import { redirect } from "next/navigation"

export default async function IdentifyLayout({ children }: { children: React.ReactNode }) {
  const to = await canIdentify()
  if (to) redirect(to)

  return <>{children}</>
}
