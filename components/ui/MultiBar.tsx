import { cn } from '@/lib/utils'
import { chartColor } from './chart-tone'

/**
 * Pure-SVG grouped / period bar chart (the "split-expense" income-vs-expense
 * reference) — N period groups along the x-axis, each holding one bar per
 * series. Supports SIGNED data: with `signed` the chart grows a zero baseline
 * and renders negatives below it (e.g. expense vs income, net cashflow). Each
 * series carries its own `tone` PROP (a token key or any CSS color string).
 * No deps, SSR-safe, responsive (the SVG scales to its container width).
 *
 * @example
 * // income vs expense by week — green up, destructive down
 * <MultiBar
 *   labels={['W1','W2','W3','W4']}
 *   signed
 *   series={[
 *     { label: 'Income',   tone: 'success',     values: [1200, 1800, 900, 2100] },
 *     { label: 'Expenses', tone: 'destructive', values: [-700, -500, -1100, -650] },
 *   ]}
 *   format={(n) => `$${Math.abs(n)}`}
 * />
 * // plain grouped bars (no negatives) — omit `signed`
 * <MultiBar labels={['Mon','Tue','Wed']} series={[{ label: 'Sessions', tone: 'info', values: [4,7,3] }]} />
 */

export type MultiBarSeries = {
  label: string
  /** Tone name (semantic `positive`/… or slot `brand`/`success`/…) or any raw CSS color string — resolved by `chartColor`. */
  tone: string
  values: number[]
}

export function MultiBar({
  series,
  labels,
  signed = false,
  height = 140,
  barWidth = 14,
  barGap = 3,
  groupGap = 22,
  radius = 3,
  showLegend = true,
  format,
  className,
  'aria-label': ariaLabel,
}: {
  series: MultiBarSeries[]
  /** One label per period group (x-axis). */
  labels: string[]
  /** Allow negatives below a zero baseline. */
  signed?: boolean
  /** Plot area height in px (excludes the label row). */
  height?: number
  barWidth?: number
  barGap?: number
  groupGap?: number
  radius?: number
  showLegend?: boolean
  /** Format a value for the bar's accessible `<title>`. */
  format?: (value: number) => string
  className?: string
  'aria-label'?: string
}) {
  const groups = labels.length
  const perGroup = series.length
  const groupWidth = perGroup * barWidth + (perGroup - 1) * barGap

  const labelH = 18
  const padX = groupGap / 2
  const width = padX * 2 + groups * groupWidth + (groups - 1) * groupGap
  const plotH = height - labelH

  // Domain: include 0 so the baseline is meaningful; for signed data the range
  // straddles zero, otherwise it sits on the floor.
  const all = series.flatMap((s) => s.values)
  const rawMax = all.length ? Math.max(...all) : 0
  const rawMin = all.length ? Math.min(...all) : 0
  const top = Math.max(rawMax, 0)
  const bottom = signed ? Math.min(rawMin, 0) : 0
  const span = top - bottom || 1
  const zeroY = (top / span) * plotH // pixels from the top to the value-0 line

  const fmt = format ?? ((n: number) => `${n}`)

  return (
    <figure className={cn('flex w-full flex-col gap-2', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        className="block max-w-full overflow-visible"
        style={{ maxHeight: height }}
        role="img"
        aria-label={ariaLabel ?? `Grouped bars — ${series.map((s) => s.label).join(', ')}`}
      >
        {/* Zero baseline */}
        <line
          x1={0}
          x2={width}
          y1={zeroY}
          y2={zeroY}
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />
        {labels.map((label, g) => {
          const gx = padX + g * (groupWidth + groupGap)
          return (
            <g key={g}>
              {series.map((s, si) => {
                const v = s.values[g] ?? 0
                const x = gx + si * (barWidth + barGap)
                const barH = (Math.abs(v) / span) * plotH
                const y = v >= 0 ? zeroY - barH : zeroY
                const color = chartColor(s.tone)
                return (
                  <rect
                    key={si}
                    x={x}
                    y={Math.min(y, zeroY)}
                    width={barWidth}
                    height={Math.max(barH, v === 0 ? 0 : 1.5)}
                    rx={radius}
                    ry={radius}
                    fill={color}
                  >
                    <title>{`${s.label} · ${label}: ${fmt(v)}`}</title>
                  </rect>
                )
              })}
              <text
                x={gx + groupWidth / 2}
                y={height - 4}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 10 }}
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>

      {showLegend && (
        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {series.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className="size-2.5 rounded-[3px]"
                style={{ backgroundColor: chartColor(s.tone) }}
              />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  )
}
