'use client'

import { createContext, useContext, type ReactNode } from 'react'

const DEFAULT_TIMEZONE = 'UTC'
const TimezoneContext = createContext<string>(DEFAULT_TIMEZONE)

/**
 * Wraps client subtrees so any client component can read the user's IANA
 * timezone via `useTimezone()` without prop-drilling. The mounting layout
 * resolves it server-side via `getCurrentTimezone()` (cookie-based) and
 * feeds it in here. Client-only renders that don't have access to the
 * provider fall back to `Intl.DateTimeFormat().resolvedOptions().timeZone`
 * by reading directly — but inside the provider, `useTimezone()` is the
 * stable answer that matches what the server rendered.
 */
export function TimezoneProvider({
  timeZone,
  children,
}: {
  timeZone: string
  children: ReactNode
}) {
  return <TimezoneContext.Provider value={timeZone}>{children}</TimezoneContext.Provider>
}

export function useTimezone(): string {
  return useContext(TimezoneContext)
}
