import { cn } from '@/lib/utils'

/**
 * NavBadge — the small count pill on a sidebar / pill-nav item (overdue
 * items, pending approvals, unread counts). Tiny `rounded-full` numeric
 * chip, `tabular-nums`, right-aligned on the nav row. Renders nothing when
 * `count <= 0`.
 */
const tones = {
  overdue: 'bg-destructive-soft text-destructive-deep',
  pending: 'bg-warning-soft text-warning-deep',
  neutral: 'bg-secondary text-muted-foreground',
} as const

export type NavBadgeProps = {
  count: number
  tone?: keyof typeof tones
  /** Clamp display at `max`, rendering `max+` (e.g. 9 → "9+"). */
  max?: number
  className?: string
  'aria-label'?: string
}

export function NavBadge({ count, tone = 'neutral', max, className, 'aria-label': ariaLabel }: NavBadgeProps) {
  if (count <= 0) return null
  const display = max != null && count > max ? `${max}+` : String(count)
  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold leading-none tabular-nums',
        tones[tone],
        className,
      )}
    >
      {display}
    </span>
  )
}
