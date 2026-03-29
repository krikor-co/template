import { redirect } from 'next/navigation'
import { canIdentify } from '@/lib/auth/guards'
import { LoginForm } from './_components/LoginForm/LoginForm'
import { fixtures } from './_components/LoginForm/fixtures'

type Props = {
  params:       Promise<Record<string, string>>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams
  const returnTo = typeof sp.returnTo === 'string' ? sp.returnTo : undefined

  const to = await canIdentify({ returnTo })
  if (to) redirect(to)

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">Enter your email to continue</p>
        </div>
        <LoginForm initialState={{ ...fixtures.idle, returnTo }} />
      </div>
    </div>
  )
}
