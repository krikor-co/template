import { canRegister } from "@/app/auth/guards"
import { redirect } from "next/navigation"

export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  const to = await canRegister()
  if (to) redirect(to)

  return <>{children}</>
}
