import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { DEFAULT_LOCALE } from '@/lib/i18n/types'
import { TimezoneSync } from '@/lib/i18n/TimezoneSync'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'
import './globals.css'

// ONE font for the whole app (`--font-geist`); Tailwind's font-serif/font-mono
// aliases resolve to it too (tailwind.config.ts fontFamily), so stray classes
// never introduce a second family. The display/kicker font TOKENS
// (`--font-display` / `--font-kicker`, consumed by `.display-text` /
// `.kicker-text` and the `font-display` / `font-kicker` utilities) alias the
// same family by default — to give the app a real display face, load it here
// with next/font (variable: '--font-display', display: 'swap') and remove the
// matching body-style alias below. See docs/design-tokens.md.
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title:       'App',
  description: 'Built with the Flow Framework',
}

/**
 * `interactiveWidget: 'resizes-content'` makes the on-screen keyboard SHRINK
 * the layout viewport instead of overlaying it. Full-height `100dvh` surfaces
 * (drawers/modals with bottom-pinned composers or submit bars) then ride just
 * above the keyboard with no dead gap and nothing hidden behind it. Keeps the
 * standard mobile defaults (`width=device-width, initial-scale=1`).
 */
export const viewport: Viewport = {
  width:             'device-width',
  initialScale:      1,
  interactiveWidget: 'resizes-content',
}

/**
 * Root layout uses DEFAULT_LOCALE for the `<html lang>` attribute. Any
 * per-user locale override happens client-side via `LocaleProvider`
 * (mounted by area layouts, e.g. `app/auth/layout.tsx`) — keeping this
 * server component synchronous means root navigation never blocks per
 * Next 16 Cache Components.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <body
        className={`${geist.variable} font-sans antialiased`}
        style={{ ['--font-display' as string]: 'var(--font-geist)', ['--font-kicker' as string]: 'var(--font-geist)' }}
      >
        <TimezoneSync />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
