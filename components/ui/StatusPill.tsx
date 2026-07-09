import { cn } from '@/lib/utils'
import { Badge, type BadgeProps } from './Badge'

/**
 * StatusPill — the canonical status / priority taxonomy as a self-documenting
 * alias over {@link Badge}, so call sites read `<StatusPill status="overdue" />`
 * instead of a raw color variant. Encodes the locked taxonomy:
 *
 *   paid · active · confirmed  → success   (positive)
 *   pending · partial · expiring → warning
 *   overdue · cancelled · error → destructive (negative)
 *   urgent                      → accent (neutral-strong inverse)
 *   info                        → info     (AI / informational — never a money status)
 *   default                     → neutral
 *
 * The status word is the visible text (status is never color-only). A leading
 * dot is shown by default for soft tones; pass `dot={false}` to hide it.
 */

type Status =
  | 'paid'
  | 'active'
  | 'confirmed'
  | 'completed'
  | 'pending'
  | 'partial'
  | 'expiring'
  | 'overdue'
  | 'cancelled'
  | 'error'
  | 'failed'
  | 'urgent'
  | 'info'
  | 'default'

type Tone = NonNullable<BadgeProps['variant']>

const STATUS_TONE: Record<Status, Tone> = {
  paid:      'success',
  active:    'success',
  confirmed: 'success',
  completed: 'success',
  pending:   'warning',
  partial:   'warning',
  expiring:  'warning',
  overdue:     'destructive',
  cancelled:   'destructive',
  error:       'destructive',
  failed:      'destructive',
  urgent:  'accent',
  info:    'info',
  default: 'default',
}

/** The dot color per tone (rides the tone's deep ink, or inverse on accent). */
const DOT_CLASS: Partial<Record<Tone, string>> = {
  success:     'bg-success-deep',
  warning:     'bg-warning-deep',
  brand:       'bg-brand-deep',
  destructive: 'bg-destructive-deep',
  info:        'bg-info-deep',
  accent:      'bg-current',
  default:     'bg-muted-foreground',
}

export type StatusPillProps = {
  /** A status from the locked taxonomy. Unknown strings fall back to `default`. */
  status: Status | (string & {})
  /** Override the visible label (defaults to a humanized status word). */
  label?: React.ReactNode
  size?: 'sm' | 'md'
  /** Show the leading status dot (default true). */
  dot?: boolean
  className?: string
  /** Icon-only / ambiguous content → supply an explicit a11y label. */
  'aria-label'?: string
}

function isKnownStatus(s: string): s is Status {
  return s in STATUS_TONE
}

export function StatusPill({
  status,
  label,
  size = 'md',
  dot = true,
  className,
  ...props
}: StatusPillProps) {
  const tone: Tone = isKnownStatus(status) ? STATUS_TONE[status] : 'default'
  const dotClass = DOT_CLASS[tone] ?? 'bg-current'
  return (
    <Badge
      variant={tone}
      className={cn(size === 'sm' && 'px-2 py-0 text-[0.625rem]', className)}
      {...props}
    >
      {dot && (
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
      )}
      {label ?? humanize(String(status))}
    </Badge>
  )
}

function humanize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
