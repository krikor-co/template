import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { safeReturnTo } from '@/lib/return-to'
import { createTransitionGuard } from '@/lib/transition'
import { entry as identifyEntry }  from '@/app/auth/identify/entry'
import { entry as verifyEntry }    from '@/app/auth/verify/entry'
import { entry as registerEntry }  from '@/app/auth/register/entry'
import { entry as dashboardEntry } from '@/app/dashboard/entry'
import {
  AUTH_IDENTIFIER_COOKIE,
  AUTH_IDENTIFIER_TYPE_COOKIE,
  AUTH_IS_NEW_COOKIE,
  type IdentifierType,
} from '@/lib/auth/identifier'

export const AUTH_RETURN_TO_COOKIE = 'auth_return_to'

export const transitions = {
  identify: createTransitionGuard('auth_identify', 2000),
  verify:   createTransitionGuard('auth_verify',   2000),
  register: createTransitionGuard('auth_register', 2000),
}

/** Read the current auth identifier from cookies, if any */
export async function getAuthIdentifier(): Promise<{ identifier: string; type: IdentifierType } | null> {
  const cookieStore = await cookies()
  const identifier = cookieStore.get(AUTH_IDENTIFIER_COOKIE)?.value
  const type = cookieStore.get(AUTH_IDENTIFIER_TYPE_COOKIE)?.value as IdentifierType | undefined
  if (!identifier || !type) return null
  return { identifier, type }
}

export async function canIdentify(): Promise<string | null> {
  if (await transitions.identify.isActive()) return null

  const cookieStore = await cookies()
  // Defense in depth: the write site (sendLoginOtp) already sanitizes, but
  // never trust a cookie value into redirect() — re-validate as same-origin.
  const returnTo = safeReturnTo(cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value)

  const session = await getSession()
  if (session) return returnTo ?? dashboardEntry.href()

  const auth = await getAuthIdentifier()
  if (auth) {
    const isNew = cookieStore.get(AUTH_IS_NEW_COOKIE)?.value === '1'
    return isNew ? registerEntry.href() : verifyEntry.href()
  }

  return null
}

export async function canVerify(): Promise<string | null> {
  if (await transitions.verify.isActive()) return null

  const cookieStore = await cookies()
  const returnTo = safeReturnTo(cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value)

  const session = await getSession()
  if (session) return returnTo ?? dashboardEntry.href()

  const auth = await getAuthIdentifier()
  if (!auth) return identifyEntry.href()

  const isNew = cookieStore.get(AUTH_IS_NEW_COOKIE)?.value === '1'
  if (isNew) return registerEntry.href()

  return null
}

export async function canRegister(): Promise<string | null> {
  if (await transitions.register.isActive()) return null

  const cookieStore = await cookies()
  const returnTo = safeReturnTo(cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value)

  const session = await getSession()
  if (session) return returnTo ?? dashboardEntry.href()

  const auth = await getAuthIdentifier()
  if (!auth) return identifyEntry.href()

  const isNew = cookieStore.get(AUTH_IS_NEW_COOKIE)?.value === '1'
  if (!isNew) return verifyEntry.href()

  return null
}
