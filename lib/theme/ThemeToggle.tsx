'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

/**
 * Theme cycle: light → dark → system → light.
 *
 * next-themes is the SINGLE source of truth — it owns the `<html>` class, the
 * `system` media-query resolution, and persistence (localStorage['app.theme.mode']).
 *
 * IMPORTANT: we deliberately keep NO parallel `mode` state, no second
 * localStorage key, and no `useEffect` that pushes into `setTheme`. The old
 * version did, which broke on mobile: at mobile width the desktop sidebar is
 * `display:none` but still MOUNTED, so TWO toggle instances existed (the hidden
 * desktop one + the drawer one), each with its own `mode` state and an effect
 * with `setTheme` in its deps. Toggling in the drawer changed next-themes →
 * every instance got a fresh `setTheme` reference → the hidden desktop toggle's
 * effect re-fired with its STALE mode and re-applied the old theme → the visible
 * "blink then revert to old, only sticks after refresh". Reading next-themes
 * directly means both instances always agree and nothing re-applies a stale value.
 */
const NEXT: Record<'light' | 'dark' | 'system', 'light' | 'dark' | 'system'> = {
  light: 'dark', dark: 'system', system: 'light',
}

export type ThemeToggleLabels = {
  toggle: string
  light:  string
  dark:   string
  system: string
}

/**
 * Copy arrives via the `labels` prop (English defaults) instead of `useT()`
 * so the toggle carries no hard dependency on the i18n stack — localized
 * apps pass labels from a `useT()` call site.
 */
const DEFAULT_LABELS: ThemeToggleLabels = {
  toggle: 'Toggle theme',
  light:  'Light',
  dark:   'Dark',
  system: 'System',
}

export function ThemeToggle({
  className = '',
  labels = DEFAULT_LABELS,
}: {
  className?: string
  labels?:    ThemeToggleLabels
}) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Placeholder until mounted so SSR markup matches (theme is client-only).
  // No theme writes happen here — next-themes already applied the class pre-paint.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical next-themes hydration mount-guard; the setState runs exactly once post-mount and cannot cascade
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <span className={'inline-block h-8 w-8 ' + className} aria-hidden="true" />
  }

  const active: 'light' | 'dark' | 'system' =
    theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system'
  const resolved = resolvedTheme === 'dark' ? 'dark' : 'light'
  const label = labels[active]
  const icon =
      active === 'system' ? '🖥'
    : resolved === 'dark' ? '🌙'
    :                       '☀️'

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[active])}
      title={`${labels.toggle} (${label})`}
      aria-label={`${labels.toggle}: ${label}`}
      className={
        'inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-sm transition-colors hover:bg-muted ' +
        className
      }
    >
      <span aria-hidden="true">{icon}</span>
      <span className="sr-only">{label}</span>
    </button>
  )
}
