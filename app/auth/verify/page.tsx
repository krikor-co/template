import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { canVerify } from '@/lib/auth/guards'
import { VerifyForm } from './_components/VerifyForm/VerifyForm'

type Props = {
  params:       Promise<Record<string, string>>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function VerifyPage({ searchParams }: Props) {
  const sp = await searchParams
  const returnTo = typeof sp.returnTo === 'string' ? sp.returnTo : undefined

  const to = await canVerify({ returnTo })
  if (to) redirect(to)

  const cookieStore = await cookies()
  const email = cookieStore.get('auth_email')?.value as string

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-muted-foreground">We sent a 6-digit code to <strong>{email}</strong></p>
        </div>
        <VerifyForm initialState={{ status: 'idle', email, code: '', returnTo }} />
      </div>
    </div>
  )
}
