import { cookies } from 'next/headers'
import { VerifyForm } from './_components/VerifyForm/VerifyForm'
import type { State } from './_components/VerifyForm/state'
import { AUTH_RETURN_TO_COOKIE } from '@/app/auth/guards'

export default async function VerifyPage() {
  const cookieStore = await cookies()
  const email = cookieStore.get('auth_email')?.value as string
  const returnTo = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value

  const initialState: State = { status: 'idle', email }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <VerifyForm initialState={initialState} returnTo={returnTo} />
      </div>
    </div>
  )
}
