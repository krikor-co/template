import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Delta pill — a signed change indicator (↑ +5% / ↓ -3%) with a trend icon,
 * toned success (up/good) or destructive (down/bad). `invert` flips the good
 * direction (e.g. for costs, where down is good).
 */
export function Delta({
  value,
  invert = false,
  className,
}: {
  /** e.g. "+5%", "-3%", "+1.4%". The leading sign drives direction. */
  value:    string
  invert?:  boolean
  className?: string
}) {
  const trimmed = value.trim()
  const dir = trimmed.startsWith('-') ? 'down' : trimmed.startsWith('+') ? 'up' : 'flat'
  const good = dir === 'flat' ? null : (dir === 'up') !== invert
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
        good === null && 'bg-secondary text-muted-foreground',
        good === true && 'bg-success-soft text-success-deep',
        good === false && 'bg-destructive-soft text-destructive-deep',
        className,
      )}
    >
      <Icon aria-hidden className="size-3" />
      {trimmed}
    </span>
  )
}
