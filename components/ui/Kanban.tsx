import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Avatar } from './Avatar'
import { Badge } from './Badge'
import { IconChip } from './IconChip'

/**
 * Pipeline / board primitives (Recipe D) — a presentational kanban for any
 * status pipeline. Pure props-in / pixels-out: the board renders columns,
 * each with a header band (title + count) over a stack of cards. No drag,
 * no state machine — it reflects EXISTING status.
 *
 * `KanbanBoard` may be a server component (no client JS); only `KanbanCard`
 * carries a CSS-only hover lift. Numbers ride `tabular-nums`; the urgent flag is
 * an accent-inverse badge per the status taxonomy.
 */

/* ── Board ────────────────────────────────────────────────────────────── */

export function KanbanBoard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-4 overflow-x-auto pb-1',
        'sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* ── Column ───────────────────────────────────────────────────────────── */

/** Header band tone — `accent` is the solid anchor; `plain` rides the canvas. */
const columnHeaderVariants = cva(
  'flex items-center justify-between gap-2 rounded-2xl px-4 py-2.5',
  {
    variants: {
      tone: {
        plain:  'bg-secondary text-foreground',
        accent: 'bg-accent text-accent-foreground',
      },
    },
    defaultVariants: { tone: 'plain' },
  },
)

type ColumnTone = NonNullable<VariantProps<typeof columnHeaderVariants>['tone']>

export function KanbanColumn({
  title,
  count,
  tone = 'plain',
  emptyLabel = 'Nothing here',
  className,
  children,
}: {
  title: string
  /** Items in this column — defaults to the rendered child count when omitted. */
  count?: number
  tone?: ColumnTone
  emptyLabel?: string
  className?: string
  children?: React.ReactNode
}) {
  const items = count ?? (Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 0)
  const isEmpty = items === 0

  return (
    <section
      aria-label={title}
      className={cn('flex min-w-0 flex-col gap-3', className)}
    >
      <header className={columnHeaderVariants({ tone })}>
        <span className="label-micro truncate">{title}</span>
        <span
          className={cn(
            'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
            tone === 'accent' ? 'bg-card/15 text-current' : 'bg-card text-foreground',
          )}
        >
          {items}
        </span>
      </header>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-secondary/50 px-4 py-8 text-center">
          <span className="text-xs text-muted-foreground">{emptyLabel}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">{children}</div>
      )}
    </section>
  )
}

/* ── Card ─────────────────────────────────────────────────────────────── */

/** Label-dot tone — a small status hue beside the card title. */
const dotTones = {
  success:     'bg-success',
  brand:       'bg-brand',
  warning:     'bg-warning',
  destructive: 'bg-destructive',
  info:        'bg-info',
  accent:      'bg-accent',
} as const

export function KanbanCard({
  id,
  title,
  meta,
  dotTone,
  avatarName,
  avatarSrc,
  lead,
  urgent = false,
  urgentLabel = 'Urgent',
  className,
  ...props
}: {
  /** Stable identifier surfaced as a quiet mono tag (e.g. an order number). */
  id?: string
  title: string
  /** When / who — the supporting line under the title. */
  meta?: React.ReactNode
  /** Status hue rendered as a leading dot beside the title. */
  dotTone?: keyof typeof dotTones
  /** Convenience: render an initial-avatar on the right. */
  avatarName?: string
  /** Optional avatar image URL paired with `avatarName`; null/undefined → initials. */
  avatarSrc?: string | null
  /** Custom leading affordance (IconChip/Avatar) — overrides `avatarName` slot. */
  lead?: React.ReactNode
  urgent?: boolean
  urgentLabel?: string
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-2xl bg-card p-3.5 shadow-card',
        'transition-shadow motion-reduce:transition-none hover:shadow-card-lg',
        className,
      )}
      {...props}
    >
      {lead && <div className="shrink-0">{lead}</div>}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {dotTone && (
            <span
              aria-hidden
              className={cn('size-1.5 shrink-0 rounded-full', dotTones[dotTone])}
            />
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {title}
          </span>
          {urgent && (
            <Badge variant="accent" className="shrink-0 uppercase tracking-[0.08em]">
              {urgentLabel}
            </Badge>
          )}
        </div>

        {(id || meta) && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {id && <span className="tabular-nums">{id}</span>}
            {id && meta && <span aria-hidden className="text-border">·</span>}
            {meta && <span className="min-w-0 truncate">{meta}</span>}
          </div>
        )}
      </div>

      {avatarName && <Avatar name={avatarName} src={avatarSrc} size="sm" className="shrink-0" />}
    </div>
  )
}

/** Re-export for call sites that compose their own lead chips. */
export { IconChip }
