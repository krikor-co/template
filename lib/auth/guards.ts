import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { entry as identifyEntry }  from '@/app/auth/(auto-redirect-if-logged-in)/identify/entry'
import { entry as verifyEntry }    from '@/app/auth/verify/entry'
import { entry as registerEntry }  from '@/app/auth/(auto-redirect-if-logged-in)/register/entry'

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
    const isNew = cookieStore.get('auth_is_new')?.value === '1'
    return isNew ? registerEntry.href({ returnTo }) : verifyEntry.href({ returnTo })
  }

  return null
}

export async function canVerify({ returnTo }: { returnTo?: string } = {}): Promise<{ redirectTo: string } | {loggedIn: true, redirectTo: string} | null> {
  const session = await getSession()
  if (session) return { loggedIn: true, redirectTo: returnTo ?? '/dashboard' }

  const cookieStore = await cookies()
  const authEmail = cookieStore.get('auth_email')?.value
  if (!authEmail) return { redirectTo: identifyEntry.href({ returnTo }) }

  const isNew = cookieStore.get('auth_is_new')?.value === '1'
  if (isNew) return { redirectTo: registerEntry.href({ returnTo }) }

  return null
}

export async function canRegister({ returnTo }: { returnTo?: string } = {}): Promise<string | null> {
  const session = await getSession()
  if (session) return returnTo ?? '/dashboard'

  const cookieStore = await cookies()
  const authEmail = cookieStore.get('auth_email')?.value
  if (!authEmail) return identifyEntry.href({ returnTo })

  const isNew = cookieStore.get('auth_is_new')?.value === '1'
  if (!isNew) return verifyEntry.href({ returnTo })

  return null
}
