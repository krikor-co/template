import { canVerify } from "@/app/auth/guards"
import { redirect } from "next/navigation"

export default async function VerifyLayout({ children }: { children: React.ReactNode }) {
  const to = await canVerify()
  if (to) redirect(to)

  return <>{children}</>
}
