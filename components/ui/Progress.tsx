import { cn } from '@/lib/utils'

const FILL = {
  brand:   'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  primary: 'bg-primary',
} as const

/**
 * Labeled progress bar — the savings-goal pattern from the references. Optional
 * leading label + trailing value above a rounded track.
 */
export function Progress({
  value,
  max = 100,
  tone = 'brand',
  label,
  valueLabel,
  className,
}: {
  value: number
  max?:  number
  tone?: keyof typeof FILL
  label?:      React.ReactNode
  valueLabel?: React.ReactNode
  className?: string
}) {
  const pct = Math.min(100, Math.max(0, (value / (max || 1)) * 100))
  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || valueLabel) && (
        <div className="flex items-baseline justify-between gap-2 text-sm">
          {label && <span className="text-foreground">{label}</span>}
          {valueLabel && <span className="tabular-nums text-muted-foreground">{valueLabel}</span>}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-[width]', FILL[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
