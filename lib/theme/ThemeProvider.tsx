'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

/**
 * Wraps the app in `next-themes`. The `.dark` CSS variables already exist
 * in `app/globals.css` — toggling the class on `<html>` is all that's needed.
 *
 * `defaultTheme="system"` follows the user's OS preference until they
 * explicitly toggle. `attribute="class"` flips between `<html class="">`
 * and `<html class="dark">`. Persistence lives in
 * localStorage['app.theme.mode'] (`storageKey` below — the `app.` prefix
 * matches the app.locale / app.tz cookie identifiers).
 *
 * NOTE: `disableTransitionOnChange` is intentionally OMITTED. It injects a
 * `*{transition:none}` <style> + a `getComputedStyle` reflow trick around the
 * class swap; on mobile Safari/WebKit that sequence leaves the page painted in
 * the OLD theme until a scroll/refresh (desktop repaints fine) — which was the
 * "theme only changes after refresh on mobile" bug. Without it the class swap
 * repaints normally (and `transition-colors` utilities just animate smoothly).
 * `color-scheme` (set per-theme in globals.css) also helps the browser recompute.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="app.theme.mode"
    >
      {children}
    </NextThemesProvider>
  )
}
