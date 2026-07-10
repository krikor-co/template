'use client'

import { useEffect } from 'react'
import { TZ_COOKIE } from './types'

/**
 * Writes the browser's resolved IANA timezone into the `app.tz` cookie so
 * server components can render dates in the user's actual tz on subsequent
 * renders. Effect runs once on mount; cookie persists 1 year.
 *
 * On the very first cold render (cookie not yet set) the server falls back
 * to UTC — but the next navigation will pick up the cookie and render
 * correctly. Acceptable: dev / first-visit only.
 *
 * Renders nothing. Mounted in the root layout.
 */
export function TimezoneSync() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!tz) return
      const existing = document.cookie.split('; ').find((c) => c.startsWith(`${TZ_COOKIE}=`))?.split('=')[1]
      if (existing === tz) return
      // 1 year max-age. SameSite=Lax so it travels on same-site navigations.
      // No HttpOnly: we WANT JS to read this for client-side parity.
      const oneYear = 60 * 60 * 24 * 365
      document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=${oneYear}; SameSite=Lax`
    } catch {
      // Intl unavailable in this runtime — leave the cookie alone.
    }
  }, [])
  return null
}
