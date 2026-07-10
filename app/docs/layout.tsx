import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { entry as identifyEntry } from '@/app/auth/identify/entry'
import { entry } from './entry'
import { Sidebar } from './_components/Sidebar'

/**
 * /docs is the internal architecture handbook. In production it is gated
 * behind a session — serving it anonymously would leak the whole system
 * design. In development it stays open (docs are read most while building,
 * often before auth is even configured).
 *
 * Suspense guard shell (docs/guards.md → "Suspense guard shells"): the
 * layout stays sync, the session check (uncached cookie + DB I/O) resolves
 * inside the boundary, and the redirect fires from within it. Apps with
 * real end-users should tighten this to requireAdmin() (app/admin/guards.ts).
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DocsFallback />}>
      <DocsShell>{children}</DocsShell>
    </Suspense>
  )
}

async function DocsShell({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    const session = await getSession()
    if (!session) redirect(identifyEntry.href({ returnTo: entry.href() }))
  }

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="sticky top-0 h-screen overflow-y-auto border-r border-border px-4 py-6">
        <Link
          href={entry.href()}
          className="mb-6 flex items-center gap-2 px-3 text-sm font-semibold tracking-tight"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
            F
          </span>
          Flow Docs
        </Link>
        <Sidebar />
      </aside>
      <main className="overflow-y-auto px-8 py-10 lg:px-16">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  )
}

/** Footprint-matched to the docs grid so the swap doesn't shift layout. */
function DocsFallback() {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]" aria-busy="true">
      <aside className="border-r border-border px-4 py-6">
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
      </aside>
      <main className="px-8 py-10 lg:px-16">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-40 w-full animate-pulse rounded bg-muted" />
        </div>
      </main>
    </div>
  )
}
