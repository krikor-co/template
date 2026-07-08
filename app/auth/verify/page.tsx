import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { VerifyForm } from './_components/VerifyForm/VerifyForm'
import type { State } from './_components/VerifyForm/state'
import { getAuthIdentifier, AUTH_RETURN_TO_COOKIE, transitions } from '@/app/auth/guards'
import { entry as identifyEntry } from '@/app/auth/identify/entry'

export default async function VerifyPage() {
  const auth = await getAuthIdentifier()
  // On success the verify action sets the session AND clears the identifier
  // cookie, then triggers a re-render of this route — at which point `auth`
  // is null. Without this guard the page would bounce to /identify (and
  // then, now logged-in, to the dashboard) BEFORE the client VerifySuccess
  // animation can paint. So, like the auth LAYOUT, respect the verify
  // transition guard: while it's active, stay on this route so the client
  // success scene plays out and drives its own delayed redirect.
  if (!auth && !(await transitions.verify.isActive())) redirect(identifyEntry.href())

  const cookieStore = await cookies()
  const returnTo = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value

  // During the success transition `auth` is null (cookie cleared) but the
  // client VerifyForm is already in its `success` state and is preserved
  // across this re-render — these idle fallbacks are never actually shown.
  const initialState: State = auth
    ? { status: 'idle', identifier: auth.identifier, identifierType: auth.type }
    : { status: 'idle', identifier: '', identifierType: 'email' }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <VerifyForm initialState={initialState} returnTo={returnTo} />
      </div>
    </div>
  )
}
