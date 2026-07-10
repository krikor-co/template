import { redirect } from 'next/navigation'
import { RegisterForm } from './_components/RegisterForm/RegisterForm'
import { getAuthIdentifier } from '@/app/auth/guards'
import { entry as identifyEntry } from '@/app/auth/identify/entry'

export default async function RegisterPage() {
  // Typed, guarded read instead of `as string`: if the identifier cookie is
  // missing (deep link, expired flow), bounce to identify rather than
  // rendering with undefined smuggled through a string type. The layout
  // guard usually catches this first — this is the page-level backstop.
  const auth = await getAuthIdentifier()
  if (!auth) redirect(identifyEntry.href())

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <RegisterForm initialState={{ status: 'idle', identifier: auth.identifier, identifierType: auth.type }} />
      </div>
    </div>
  )
}
