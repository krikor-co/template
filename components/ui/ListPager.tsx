'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useListPager } from './useListPager'

/**
 * ListPager — shared server-pagination footer for LIST pages.
 *
 * Server-paginated lists (LIMIT/OFFSET) re-suspend their section when the
 * page changes, so navigating via a plain `<Link>` would flash the section's
 * skeleton. This wraps `router.push` in a `startTransition` so the existing
 * rows stay on screen (dimmed) while the next page streams in. The parent
 * server component computes the prev/next hrefs from its OWN route
 * `entry.href` (preserving every active filter) and passes them in as plain
 * strings, so nothing route-specific leaks into this client island — and the
 * no-raw-URL-strings invariant holds, because the hrefs come from the entry.
 *
 * `prevHref` / `nextHref` are `null` at the ends (button disabled). The
 * `children` are the server-rendered row list, dimmed during the transition.
 * All labels are required props — no baked-in copy (docs/pages.md →
 * "Server-paginated lists").
 */
const pagerButtonClass = cn(
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background',
  'text-foreground transition-colors hover:bg-muted',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  'disabled:pointer-events-none disabled:opacity-50',
)

export function ListPager({
  prevHref,
  nextHref,
  rangeLabel,
  pageLabel,
  prevLabel,
  nextLabel,
  navLabel = 'pagination',
  children,
}: {
  prevHref:  string | null
  nextHref:  string | null
  rangeLabel: string
  pageLabel:  string
  prevLabel:  string
  nextLabel:  string
  navLabel?:  string
  children:   React.ReactNode
}) {
  const { isPending, go } = useListPager()

  return (
    <div className="space-y-2">
      <div className={cn('transition-opacity', isPending && 'opacity-60')}>
        {children}
      </div>

      <nav
        aria-label={navLabel}
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-xs"
      >
        <span className="tabular-nums text-muted-foreground">
          {rangeLabel}
          {isPending && (
            <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/60" />
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={pagerButtonClass}
            aria-label={prevLabel}
            disabled={!prevHref || isPending}
            onClick={() => go(prevHref)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-1 tabular-nums text-muted-foreground">{pageLabel}</span>
          <button
            type="button"
            className={pagerButtonClass}
            aria-label={nextLabel}
            disabled={!nextHref || isPending}
            onClick={() => go(nextHref)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </nav>
    </div>
  )
}
