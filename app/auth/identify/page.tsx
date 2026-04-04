import { LoginForm } from './_components/LoginForm/LoginForm'
import { fixtures } from './_components/LoginForm/fixtures'
import { route } from './contract'

type Props = {
  params:       Promise<Record<string, string>>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams
  const entry = route.entry.parse({ params: {}, searchParams: sp, cookies: {} })

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <LoginForm initialState={fixtures.idle} returnTo={entry.returnTo} />
      </div>
    </div>
  )
}
