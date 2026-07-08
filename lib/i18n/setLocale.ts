'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { tracedAction } from '@/lib/effect/traced'
import { isLocale, LOCALE_COOKIE, type Locale } from './types'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Set the explicit locale override cookie (`app.locale`).
 *
 * Validates that `locale` is one of `SUPPORTED_LOCALES`, writes a year-long
 * cookie at path `/`, then revalidates so the new language takes effect on the
 * next render. This cookie is read FIRST by both `getPublicLocale` and
 * `getCurrentLocale`, so it overrides `persons.locale` and the `DEFAULT_LOCALE`
 * fallback — letting any picker switch the whole app live.
 *
 * Returns `{ success }` so the caller (the client picker) can decide whether
 * to `router.refresh()`. Never throws on a bad locale — it no-ops instead.
 */
export async function setLocale(locale: Locale): Promise<{ success: boolean }> {
  return tracedAction('setLocale', { locale }, async () => {
    if (!isLocale(locale)) return { success: false }

    const store = await cookies()
    store.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'lax',
    })

    revalidatePath('/')
    return { success: true }
  })
}
