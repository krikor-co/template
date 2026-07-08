import { cache } from 'react'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { persons, users } from '@/db/schema'
import { getSession } from '@/lib/auth/session'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, normalizeLocale, type Locale } from './types'
import { getCurrentTimezone } from './getTimezone'

/**
 * Read the explicit locale override from the `app.locale` cookie, if present
 * and valid. This is the highest-precedence signal for BOTH public and authed
 * surfaces — it is the only user-facing language override (set by the
 * `setLocale` action from any language picker).
 *
 * Returns `null` when the cookie is absent or holds an unsupported tag, so
 * callers can fall through to the next signal (persons.locale → DEFAULT_LOCALE).
 *
 * **NEVER call inside a `'use cache'` block** — reads `cookies()`.
 */
async function getCookieLocale(): Promise<Locale | null> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : null
}

/**
 * Resolve the current request's locale for an AUTHENTICATED surface.
 *
 * Precedence:
 *   1. `app.locale` cookie (explicit user override)
 *   2. the session user's `persons.locale`
 *   3. `DEFAULT_LOCALE` (`en`)
 *
 * **NEVER call this inside a `'use cache'` block** — it reads `cookies()`
 * (and `getSession()` also reads cookies), which is forbidden in cached
 * scopes. Resolve locale at the Component layer (or in layout) and pass it
 * down as a parameter into any cached query that needs it (so the locale
 * becomes part of the cache key).
 */
export const getCurrentLocale = cache(async (): Promise<Locale> => {
  const cookieLocale = await getCookieLocale()
  if (cookieLocale) return cookieLocale

  const session = await getSession()
  if (!session) return DEFAULT_LOCALE

  const [row] = await db
    .select({ locale: persons.locale })
    .from(users)
    .innerJoin(persons, eq(persons.id, users.personId))
    .where(eq(users.id, session.userId))
    .limit(1)

  return normalizeLocale(row?.locale)
})

/**
 * Bundle locale + timezone in one call so server components can do:
 *   const { locale, timeZone } = await getCurrentI18n()
 * and pass `{ timeZone }` into Intl formatter options. Both pieces are
 * cached per-request via React's `cache()`.
 */
export const getCurrentI18n = cache(async (): Promise<{ locale: Locale; timeZone: string }> => {
  const [locale, timeZone] = await Promise.all([getCurrentLocale(), getCurrentTimezone()])
  return { locale, timeZone }
})

/**
 * Resolve a locale for unauthenticated / public surfaces (the auth flow and
 * any pre-login page).
 *
 * Precedence:
 *   1. `app.locale` cookie (explicit user override — a live picker)
 *   2. `DEFAULT_LOCALE` (`en`)
 *
 * The app deliberately does NOT auto-detect from the browser's
 * `Accept-Language` — the cookie is the only override; users opt into
 * another shipped language via a picker that calls `setLocale`.
 *
 * This reads `cookies()`, so it is safe to call from a layout but **NEVER**
 * from inside a `'use cache'` block.
 */
export const getPublicLocale = cache(async (): Promise<Locale> => {
  const cookieLocale = await getCookieLocale()
  return cookieLocale ?? DEFAULT_LOCALE
})
