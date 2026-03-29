import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { canVerify } from '@/lib/auth/guards'
import { VerifyForm } from './_components/VerifyForm/VerifyForm'
import { State } from './_components/VerifyForm/state'

type Props = {
  params:       Promise<Record<string, string>>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function VerifyPage({ searchParams }: Props) {
  const sp = await searchParams
  const returnTo = typeof sp.returnTo === 'string' ? sp.returnTo : undefined

  const result = await canVerify({ returnTo })
  if (result && !('loggedIn' in result) && 'redirectTo' in result) redirect(result.redirectTo)

  const cookieStore = await cookies()
  const email = cookieStore.get('auth_email')?.value as string

const initialState: State = result && 'loggedIn' in result ? { status: 'success', redirectTo: result.redirectTo } : { status: 'idle', email: email, code: '', returnTo: returnTo }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-muted-foreground">We sent a 6-digit code to <strong>{email}</strong></p>
        </div>
        <VerifyForm initialState={initialState} />
      </div>
    </div>
  )
}
