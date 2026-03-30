import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { entry as identifyEntry }  from '@/app/auth/identify/entry'
import { entry as verifyEntry }    from '@/app/auth/verify/entry'
import { entry as registerEntry }  from '@/app/auth/register/entry'

export const AUTH_TRANSITION_COOKIES = {
  identify: 'auth_identify_in_transition',
  verify: 'auth_verify_in_transition',
  register: 'auth_register_in_transition',
}

/**
 * Returns a redirect href if the user should not see the page, or null if they can.
 * Usage: const to = await canIdentify({ returnTo }); if (to) redirect(to)
 */

export async function canIdentify({ returnTo }: { returnTo?: string } = {}): Promise<string | null> {
  const session = await getSession()
  if (session) return returnTo ?? '/dashboard'

  const cookieStore = await cookies()
  const authEmail = cookieStore.get('auth_email')?.value
  if (authEmail) {
    if (cookieStore.get(AUTH_TRANSITION_COOKIES.identify)?.value === '1') return null
    const isNew = cookieStore.get('auth_is_new')?.value === '1'
    return isNew ? registerEntry.href({ returnTo }) : verifyEntry.href({ returnTo })
  }

  return null
}

export async function canVerify({ returnTo }: { returnTo?: string } = {}): Promise<string | null> {
  const cookieStore = await cookies()
  if (cookieStore.get(AUTH_TRANSITION_COOKIES.verify)?.value === '1') return null

  const session = await getSession()
  if (session) return returnTo ?? '/dashboard'

  const authEmail = cookieStore.get('auth_email')?.value
  if (!authEmail) return identifyEntry.href({ returnTo })

  const isNew = cookieStore.get('auth_is_new')?.value === '1'
  if (isNew) return registerEntry.href({ returnTo })

  return null
}

export async function canRegister({ returnTo }: { returnTo?: string } = {}): Promise<string | null> {
  const session = await getSession()
  if (session) return returnTo ?? '/dashboard'

  const cookieStore = await cookies()

  if (cookieStore.get(AUTH_TRANSITION_COOKIES.register)?.value === '1') return null

  const authEmail = cookieStore.get('auth_email')?.value
  if (!authEmail) return identifyEntry.href({ returnTo })

  const isNew = cookieStore.get('auth_is_new')?.value === '1'
  if (!isNew) return verifyEntry.href({ returnTo })

  return null
}
