import { cn } from '@/lib/utils'
import { chartColor } from './chart-tone'

/**
 * AreaTrend — a line + soft-area trend for a single number series, with an
 * optional baseline reference line. The richer sibling of `Sparkline`: it is
 * tone-aware (the integrator passes the color), responsive by default
 * (stretches to its container width via a `none` aspect ratio), and can draw a
 * dashed baseline (target / previous-period average / break-even).
 *
 * Pure SVG, no deps, no client JS — safe in a server component. Color is driven
 * entirely by `tone`: a semantic tone or accent-slot name resolves via
 * `chartColor`, OR pass any raw CSS color string. The svg
 * inherits that color via `currentColor`, so both the stroke and the area fade
 * share it without needing a unique gradient id (avoids cross-instance id
 * collisions on a page full of charts).
 *
 * @example
 *   // today's pace over the last 4-week weekday average
 *   <AreaTrend data={[12, 18, 9, 22, 31, 28, 40]} tone="success" baseline={20} className="w-full" />
 *   // reputation trend, raw color, no fill
 *   <AreaTrend data={[4.2, 4.3, 4.1, 4.5, 4.6]} tone="#7c4dff" fill={false} />
 */
export function AreaTrend({
  data,
  tone = 'info',
  baseline,
  width = 240,
  height = 64,
  strokeWidth = 2,
  fill = true,
  showDot = true,
  emptyLabel = 'No movement',
  className,
  'aria-label': ariaLabel,
}: {
  /** The series. Needs ≥2 points to draw a line. */
  data: number[]
  /** Tone name (semantic or accent-slot, e.g. `success`/`brand`/`muted`) or any raw CSS color — resolved by `chartColor`. */
  tone?: string
  /** Optional reference line, in the same units as `data` (target / average / break-even). */
  baseline?: number
  /** viewBox dimensions; the svg stretches to its container width by default. */
  width?: number
  height?: number
  strokeWidth?: number
  /** Soft area fade under the line. */
  fill?: boolean
  /** Marker on the latest point. */
  showDot?: boolean
  /** Caption for the honest empty/no-movement state (defaults to "No movement"). */
  emptyLabel?: React.ReactNode
  /** Pass `w-full` (default) to fill the container; pass a fixed width to inline it. */
  className?: string
  'aria-label'?: string
}) {
  const color = tone === 'muted' ? 'hsl(var(--muted-foreground))' : chartColor(tone as string)

  if (data.length < 2) {
    return <div style={{ width: '100%', height }} className={className} aria-hidden />
  }

  // ── Honest empty / no-movement treatment ──────────────────────────────────
  // A series that is all-zero, or only declines to zero (e.g. a value+Δ trend
  // synthesized for a zero-revenue day), must NOT slope down like a
  // loss. Render a calm flat baseline + a muted "no movement" caption so a
  // genuinely-quiet metric reads as quiet, not broken.
  const seriesMax = Math.max(...data)
  const last = data[data.length - 1]
  const nonIncreasing = data.every((v, i) => i === 0 || v <= data[i - 1])
  const noMovement = seriesMax <= 0 || (last <= 0 && nonIncreasing)
  if (noMovement) {
    const baseY = Math.round(height * 0.68)
    return (
      <div className={cn('relative w-full', className)} style={{ height }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaLabel ?? (typeof emptyLabel === 'string' ? emptyLabel : 'No movement')}
          className="block text-muted-foreground"
        >
          <line
            x1={0}
            x2={width}
            y1={baseY}
            y2={baseY}
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.35}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="label-micro text-[10px] text-muted-foreground">{emptyLabel}</span>
        </span>
      </div>
    )
  }

  // Fold the baseline into the domain so the reference line stays on-canvas.
  const lo = Math.min(...data, baseline ?? Infinity)
  const hi = Math.max(...data, baseline ?? -Infinity)
  const min = Number.isFinite(lo) ? lo : Math.min(...data)
  const max = Number.isFinite(hi) ? hi : Math.max(...data)
  const span = max - min || 1

  const pad = strokeWidth + 1
  const stepX = width / (data.length - 1)
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span)

  const pts = data.map((v, i) => `${i * stepX},${y(v)}`)
  const line = `M${pts.join(' L')}`
  const area = `${line} L${width},${height} L0,${height} Z`
  const lastY = y(data[data.length - 1])

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      className={cn('overflow-visible', className)}
      style={{ color }}
    >
      {fill && <path d={area} fill="currentColor" opacity={0.1} />}
      {baseline !== undefined && (
        <line
          x1={0}
          x2={width}
          y1={y(baseline)}
          y2={y(baseline)}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.4}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showDot && (
        <circle cx={(data.length - 1) * stepX} cy={lastY} r={strokeWidth + 0.5} fill="currentColor" />
      )}
    </svg>
  )
}
