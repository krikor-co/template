import { cn } from '@/lib/utils'

/**
 * Vertical gradient bar chart — a row of tall rounded bars with a warm vertical
 * gradient fill, ONE highlighted bar carrying a floating value pill, and a day
 * (or category) labels row. The references' "vertical GRADIENT BAR w/ value
 * pill": a single salient bar against quieter siblings (today's total vs the
 * week, a ranked top item, a target). Pure CSS, SSR-safe.
 *
 * Tones: the highlighted bar fills with a soft→solid vertical gradient of its
 * accent slot; quiet bars are `secondary`. The value pill rides above the
 * highlighted fill height. Numbers are tabular.
 */
export type GradientBarDatum = { label: string; value: number }

const TONE_FILL = {
  brand:   'from-brand-soft to-brand',
  success: 'from-success-soft to-success',
  warning: 'from-warning-soft to-warning',
  info:    'from-info-soft to-info',
} as const

export function GradientBar({
  data,
  activeIndex = 0,
  valueLabel,
  tone = 'brand',
  height = 160,
  className,
}: {
  data: GradientBarDatum[]
  /** Which bar is the salient one (carries the gradient + value pill). */
  activeIndex?: number
  /** The pill text over the active bar; defaults to the active datum's value. */
  valueLabel?: React.ReactNode
  tone?: keyof typeof TONE_FILL
  height?: number
  className?: string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const activeFill = cn('bg-gradient-to-t', TONE_FILL[tone])
  const quietFill = 'bg-secondary'
  const labelMuted = 'text-muted-foreground'
  const labelActive = 'text-foreground font-medium'

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const isActive = i === activeIndex
          const pct = Math.max((d.value / max) * 100, 4)
          return (
            <div key={i} className="relative flex flex-1 items-end" style={{ height }}>
              {isActive && (
                <span
                  className="absolute inset-x-0 z-10 mx-auto w-fit -translate-y-1 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold tabular-nums text-background shadow-card"
                  style={{ bottom: `${pct}%` }}
                >
                  {valueLabel ?? d.value}
                </span>
              )}
              <div
                className={cn(
                  'w-full rounded-full transition-[height] duration-500 motion-reduce:transition-none',
                  isActive ? activeFill : quietFill,
                )}
                style={{ height: `${pct}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((d, i) => (
          <span
            key={i}
            className={cn(
              'flex-1 truncate text-center text-[10px] leading-tight',
              i === activeIndex ? labelActive : labelMuted,
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}
