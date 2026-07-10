import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tile } from './Tile'
import { IconChip } from './IconChip'
import { SectionLabel } from './SectionLabel'
import { Delta } from './Delta'

/**
 * The solid-accent forecast hero — a dark AI anchor that
 * contrasts an **actual** figure against a **projected** figure
 * (the cool `info` accent), with a small trend line beneath. The projection is
 * visually distinct: cool-toned, with a dashed series, so actuals never read as
 * blue (chart rule: the cool accent marks projection/AI only).
 *
 * Server-by-default (pure SVG, no state) — the trend overlay is rendered inline.
 * Numbers wrap `tabular-nums`; on the solid anchor the metric rides full-opacity foreground,
 * sub-lines dim by opacity. All microcopy is prop-overridable (English defaults).
 */

export type AiForecastHeroProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Mono kicker above the metric (AI signature). */
  kicker?: React.ReactNode
  /** Short label under the kicker (e.g. "Monthly revenue"). */
  label?: React.ReactNode
  /** The realized-so-far value (the warm actual). */
  actual: { value: React.ReactNode; caption?: React.ReactNode }
  /** The AI projection (the cool `info` figure). */
  projected: { value: React.ReactNode; caption?: React.ReactNode }
  /** Label over the actual figure. */
  actualLabel?: string
  /** Label over the projected figure. */
  projectedLabel?: string
  /** Aria label for the region when `label` isn't a string. */
  regionLabel?: string
  /** Aria label for the trend SVG. */
  trendLabel?: string
  /** Optional signed delta pill (projected vs baseline). */
  delta?: string
  /** Whether a positive delta is "good" (default true). */
  deltaInvert?: boolean
  /** Trend series: actuals (solid warm) then the projected tail (dashed info). */
  trend?: {
    /** Realized points. */
    actual: number[]
    /** Projected points — drawn dashed in `info`. First point should equal the
     * last actual point for a continuous line (caller's responsibility). */
    projected: number[]
  }
}

export function AiForecastHero({
  kicker = 'AI · FORECAST',
  label,
  actual,
  projected,
  actualLabel = 'Actual',
  projectedLabel = 'Projected',
  regionLabel = 'AI forecast',
  trendLabel = 'Trend: actual and projection',
  delta,
  deltaInvert,
  trend,
  className,
  ...rest
}: AiForecastHeroProps) {
  return (
    <Tile
      tone="accent"
      className={cn('flex flex-col justify-between gap-6 p-7', className)}
      role="region"
      aria-label={typeof label === 'string' ? label : regionLabel}
      {...rest}
    >
      {/* Header: ✨ chip + the only blue kicker on a dark brief. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconChip tone="info" size="sm" className="bg-accent-foreground/10 text-info">
            <Sparkles aria-hidden />
          </IconChip>
          <div className="min-w-0">
            <SectionLabel as="span" className="text-info">{kicker}</SectionLabel>
            {label && <p className="truncate text-sm text-current opacity-75">{label}</p>}
          </div>
        </div>
        {delta && <Delta value={delta} invert={deltaInvert} className="bg-card/15 text-current" />}
      </div>

      {/* Actual vs projected pair — two nested sub-surfaces on the accent block. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-accent-foreground/10 p-4">
          <p className="label-micro text-current opacity-75">{actualLabel}</p>
          <p className="mt-1.5 whitespace-nowrap text-3xl font-semibold leading-none tracking-tight tabular-nums text-current">
            {actual.value}
          </p>
          {actual.caption && <p className="mt-2 truncate text-xs text-current opacity-70">{actual.caption}</p>}
        </div>
        <div className="rounded-2xl bg-accent-foreground/10 p-4 ring-1 ring-inset ring-info/30">
          <p className="label-micro text-info">{projectedLabel}</p>
          <p className="mt-1.5 whitespace-nowrap text-3xl font-semibold leading-none tracking-tight tabular-nums text-info">
            {projected.value}
          </p>
          {projected.caption && <p className="mt-2 truncate text-xs text-current opacity-70">{projected.caption}</p>}
        </div>
      </div>

      {/* Trend overlay: solid warm actuals + dashed info projection. */}
      {trend && trend.actual.length + trend.projected.length > 1 && (
        <ForecastTrend actual={trend.actual} projected={trend.projected} ariaLabel={trendLabel} />
      )}
    </Tile>
  )
}

/**
 * Inline pure-SVG trend: a solid foreground actuals line and a dashed `info`
 * projection tail, sharing one auto-scaled coordinate space. SSR-safe.
 */
function ForecastTrend({
  actual,
  projected,
  ariaLabel,
  width = 320,
  height = 56,
}: {
  actual: number[]
  projected: number[]
  ariaLabel: string
  width?: number
  height?: number
}) {
  const all = [...actual, ...projected]
  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = max - min || 1
  const count = all.length
  const stepX = width / Math.max(count - 1, 1)
  const pad = 3
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span)
  const x = (i: number) => i * stepX

  const actualPts = actual.map((v, i) => `${x(i)},${y(v)}`)
  // The projection continues from the last actual index so the dashed tail
  // visually extends the solid line.
  const startIdx = actual.length - 1
  const projPts = projected.map((v, i) => `${x(startIdx + i)},${y(v)}`)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="overflow-visible"
      role="img"
      aria-label={ariaLabel}
    >
      {actualPts.length > 1 && (
        <path
          d={`M${actualPts.join(' L')}`}
          fill="none"
          stroke="hsl(var(--accent-foreground))"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {projPts.length > 1 && (
        <path
          d={`M${projPts.join(' L')}`}
          fill="none"
          stroke="hsl(var(--info))"
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {projPts.length > 0 && (() => {
        const last = projected[projected.length - 1]
        return <circle cx={x(startIdx + projected.length - 1)} cy={y(last)} r={2.5} fill="hsl(var(--info))" />
      })()}
    </svg>
  )
}
