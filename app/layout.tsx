import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geist.variable} font-sans antialiased`}
        style={{ ['--font-display' as string]: 'var(--font-geist)', ['--font-kicker' as string]: 'var(--font-geist)' }}
      >
        {children}
      </body>
    </html>
  )
}
