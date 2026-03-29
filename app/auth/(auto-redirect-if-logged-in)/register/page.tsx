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

  const to = await canRegister({ returnTo })
  if (to) redirect(to)
  const cookieStore = await cookies()
  const email       = cookieStore.get('auth_email')?.value as string

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-muted-foreground">Just your name to get started</p>
        </div>
        <RegisterForm initialState={{ status: 'idle', email, name: '', returnTo }} />
      </div>
    </div>
  )
}
