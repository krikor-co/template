import { cookies } from 'next/headers'
import { RegisterForm } from './_components/RegisterForm/RegisterForm'

export default async function RegisterPage() {
  const cookieStore = await cookies()
  const email = cookieStore.get('auth_email')?.value as string

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <RegisterForm initialState={{ status: 'idle', email }} />
      </div>
    </div>
  )
}
