import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { createTransitionGuard } from '@/lib/transition'
import { entry as identifyEntry }  from '@/app/auth/identify/entry'
import { entry as verifyEntry }    from '@/app/auth/verify/entry'
import { entry as registerEntry }  from '@/app/auth/register/entry'
import { entry as dashboardEntry } from '@/app/dashboard/entry'

export const AUTH_RETURN_TO_COOKIE = 'auth_return_to'

export const transitions = {
  identify: createTransitionGuard('auth_identify', 2000),
  verify:   createTransitionGuard('auth_verify',   2000),
  register: createTransitionGuard('auth_register', 2000),
}

/**
 * Returns a redirect href if the user should not see the page, or null if they can.
 * Usage: const to = await canIdentify(); if (to) redirect(to)
 */

export async function canIdentify(): Promise<string | null> {
  if (await transitions.identify.isActive()) return null

  const cookieStore = await cookies()
  const returnTo = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value

  const session = await getSession()
  if (session) return returnTo ?? dashboardEntry.href()

  const authEmail = cookieStore.get('auth_email')?.value
  if (authEmail) {
    const isNew = cookieStore.get('auth_is_new')?.value === '1'
    return isNew ? registerEntry.href() : verifyEntry.href()
  }

  return null
}

export async function canVerify(): Promise<string | null> {
  if (await transitions.verify.isActive()) return null

  const cookieStore = await cookies()
  const returnTo = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value

  const session = await getSession()
  if (session) return returnTo ?? dashboardEntry.href()

  const authEmail = cookieStore.get('auth_email')?.value
  if (!authEmail) return identifyEntry.href()

  const isNew = cookieStore.get('auth_is_new')?.value === '1'
  if (isNew) return registerEntry.href()

  return null
}

export async function canRegister(): Promise<string | null> {
  if (await transitions.register.isActive()) return null

  const cookieStore = await cookies()
  const returnTo = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value

  const session = await getSession()
  if (session) return returnTo ?? dashboardEntry.href()

  const authEmail = cookieStore.get('auth_email')?.value
  if (!authEmail) return identifyEntry.href()

  const isNew = cookieStore.get('auth_is_new')?.value === '1'
  if (!isNew) return verifyEntry.href()

  return null
}
