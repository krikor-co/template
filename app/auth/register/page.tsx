import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { canRegister } from '@/lib/auth/guards'
import { RegisterForm } from './_components/RegisterForm/RegisterForm'

type Props = {
  params:       Promise<Record<string, string>>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RegisterPage({ searchParams }: Props) {
  const sp       = await searchParams
  const returnTo = typeof sp.returnTo === 'string' ? sp.returnTo : undefined

  const cookieStore = await cookies()
  const email       = cookieStore.get('auth_email')?.value as string

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <RegisterForm initialState={{ status: 'idle', email, returnTo }} />
      </div>
    </div>
  )
}
