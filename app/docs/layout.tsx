import Link from 'next/link'
import { Sidebar } from './_components/Sidebar'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="sticky top-0 h-screen overflow-y-auto border-r border-border px-4 py-6">
        <Link
          href="/docs"
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
