import { cache } from 'react'
import { cookies } from 'next/headers'
import { TZ_COOKIE } from './types'

/**
 * Resolve the current request's IANA timezone for display formatting.
 *
 * Looks for the `app.tz` cookie set by `<TimezoneSync>` on first client load
 * (see `lib/i18n/TimezoneSync.tsx`). Falls back to `UTC` when:
 *   - first visit (cookie not set yet — one cold render will use UTC)
 *   - the cookie value doesn't look like an IANA tz (`Region/City`)
 *
 * Why a cookie and not a DB column on `persons`: it works on auth pages and
 * public surfaces (no session needed), and stays in sync with the user's
 * actual device tz when they travel. The session-bound locale lives in the
 * DB because users may explicitly choose a language different from their
 * device; timezone they almost never want to override.
 *
 * **NEVER call this inside a `'use cache'` block** — `cookies()` is
 * forbidden in cached scopes. Resolve at the Component / layout layer and
 * pass into cached queries so it becomes part of the cache key.
 */
export const getCurrentTimezone = cache(async (): Promise<string> => {
  try {
    const c = await cookies()
    const raw = c.get(TZ_COOKIE)?.value
    return looksLikeIanaTz(raw) ? raw! : 'UTC'
  } catch {
    return 'UTC'
  }
})

/** Cheap structural check — `Region/City` or `UTC` / `GMT`. */
function looksLikeIanaTz(v: string | undefined): v is string {
  if (!v) return false
  if (v === 'UTC' || v === 'GMT') return true
  return /^[A-Za-z_]+\/[A-Za-z_\-+0-9/]+$/.test(v)
}
