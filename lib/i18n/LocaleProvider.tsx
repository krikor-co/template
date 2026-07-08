'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { DEFAULT_LOCALE, type Locale } from './types'
import { t, type Messages } from './messages'

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

/**
 * Wraps client subtrees so any client component can read the request's
 * locale via `useLocale()` / `useT()` without prop-drilling.
 *
 * An area layout is the mount point — e.g. `app/auth/layout.tsx` resolves
 * the locale server-side via `getPublicLocale()` (authed areas use
 * `getCurrentLocale()`) and passes it in here.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale:   Locale
  children: ReactNode
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

/**
 * Convenience: returns the message dictionary for the current locale.
 * Memoized on the locale value so callers can compare references safely.
 */
export function useT(): Messages {
  const locale = useLocale()
  return useMemo(() => t(locale), [locale])
}
