import { cn } from '@/lib/utils'
import { SectionLabel } from './SectionLabel'

/**
 * Metric display — a mono uppercase label over a big tabular-mono value, with
 * an optional sub-line. The editorial "big number" used on dashboards + tiles.
 */
export function Stat({
  label,
  value,
  sub,
  size = 'md',
  className,
}: {
  label?: React.ReactNode
  value:  React.ReactNode
  sub?:   React.ReactNode
  size?:  'sm' | 'md' | 'lg'
  className?: string
}) {
  const valueCls = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl sm:text-5xl',
  }[size]
  return (
    <div className={cn('space-y-1', className)}>
      {label && <SectionLabel as="p">{label}</SectionLabel>}
      <p className={cn('tabular-nums font-semibold tracking-tight text-foreground', valueCls)}>{value}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  )
}
