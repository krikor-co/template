import { cn } from '@/lib/utils'
import { chartColor } from './chart-tone'

/**
 * Pure-SVG contribution / density grid (the "Folked" busy-days reference) —
 * 7 weekday rows × N week columns, each cell tinted by its value relative to
 * the series max. Color comes from a `tone` PROP (a token key or any CSS color
 * string), scaled through discrete opacity buckets so light = quiet day, deep =
 * busy day. No deps, SSR-safe, responsive (the SVG scales to its container).
 *
 * `data` is either a flat `number[]` laid out column-major (index 0..6 = the
 * first column's top→bottom = Sun→Sat, 7..13 = the next week, …) or
 * `{ date, value }[]` which is bucketed into the same grid by the weekday of
 * `date`. A zero / missing day renders as the empty `muted` track — never a
 * misleading faint tint.
 *
 * @example
 * // events per day over the last 12 weeks, busy-day brand scale
 * <Heatmap
 *   tone="brand"
 *   weekdayLabels={['S','M','T','W','T','F','S']}
 *   data={[0,2,5,3,0,8,1, 1,4,6,2,3,9,0]}        // length = weeks*7
 * />
 * // …or date-keyed (auto-bucketed into week columns by weekday)
 * <Heatmap tone="success" data={[{ date: '2026-06-01', value: 4 }]} />
 */

export type HeatmapDatum = { date: string | Date; value: number }

/** Five-step intensity ramp — quiet → busy. */
const BUCKETS = [0.14, 0.32, 0.52, 0.74, 1] as const

function toGrid(data: number[] | HeatmapDatum[]): number[] {
  if (data.length === 0) return []
  if (typeof data[0] === 'number') return data as number[]
  // Date-keyed: place each value at its day-offset from the Sunday of the first
  // datum's week, so columns align to calendar weeks; gaps pad with 0.
  const rows = data as HeatmapDatum[]
  const parsed = rows.map((r) => ({ d: new Date(r.date), v: r.value }))
  const start = new Date(parsed[0].d)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  const DAY = 86_400_000
  const last = parsed[parsed.length - 1].d
  const slots = Math.max(7, Math.round((last.getTime() - start.getTime()) / DAY) + 1)
  const grid = new Array(slots).fill(0)
  for (const { d, v } of parsed) {
    const idx = Math.round((d.getTime() - start.getTime()) / DAY)
    if (idx >= 0 && idx < slots) grid[idx] += v
  }
  return grid
}

export function Heatmap({
  data,
  tone = 'brand',
  weekdayLabels,
  cell = 14,
  gap = 4,
  radius = 3,
  emptyLabel = 'No activity',
  className,
}: {
  data: number[] | HeatmapDatum[]
  /** Tone name (semantic or accent-slot, e.g. `brand` | `success`) or any CSS color string. */
  tone?: string
  /** 7 short labels for the weekday axis, top→bottom (omit to hide it). */
  weekdayLabels?: string[]
  cell?: number
  gap?: number
  radius?: number
  /** Caption for the honest all-zero empty grid (defaults to "No activity"). */
  emptyLabel?: React.ReactNode
  className?: string
}) {
  const grid = toGrid(data)
  const weeks = Math.max(1, Math.ceil(grid.length / 7))
  const color = chartColor(tone)
  const max = grid.reduce((m, v) => Math.max(m, v), 0)

  const labelW = weekdayLabels ? cell + gap + 4 : 0
  const width = labelW + weeks * (cell + gap) - gap
  const height = 7 * (cell + gap) - gap

  /** Map a value to a bucket opacity; 0 → empty track. */
  const level = (v: number): number => {
    if (v <= 0 || max <= 0) return 0
    const i = Math.min(BUCKETS.length - 1, Math.max(0, Math.ceil((v / max) * BUCKETS.length) - 1))
    return BUCKETS[i]
  }

  const total = grid.reduce((s, v) => s + Math.max(v, 0), 0)
  // An all-zero grid must not read as an alarming solid gray block. Draw the
  // cells as faint hollow outlines and float a muted caption over them so an
  // empty calendar reads as honestly empty, not broken.
  const empty = total <= 0

  const svg = (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      // Render at INTRINSIC size, then `max-w-full` shrinks it on a narrow
      // container — it NEVER upscales. A short series (e.g. a 2-week / 2-column
      // density slice) therefore stays a tidy swatch instead of being stretched
      // to fill the tile width into a giant portrait block.
      className={cn('block h-auto max-w-full overflow-visible', !empty && className)}
      role="img"
      aria-label={total > 0 ? `Density map — ${weeks} weeks, ${total} total` : 'No activity'}
    >
      {weekdayLabels?.slice(0, 7).map((l, d) => (
        <text
          key={d}
          x={labelW - gap - 4}
          y={d * (cell + gap) + cell / 2}
          textAnchor="end"
          dominantBaseline="central"
          className="fill-muted-foreground"
          style={{ fontSize: Math.max(8, cell - 5) }}
        >
          {l}
        </text>
      ))}
      {Array.from({ length: weeks }).map((_, w) =>
        Array.from({ length: 7 }).map((__, d) => {
          const v = grid[w * 7 + d] ?? 0
          const op = level(v)
          // Empty grid → faint hollow outline (reads as "nothing scheduled");
          // a populated grid keeps the solid muted track for its quiet days.
          if (empty) {
            return (
              <rect
                key={`${w}-${d}`}
                x={labelW + w * (cell + gap)}
                y={d * (cell + gap)}
                width={cell}
                height={cell}
                rx={radius}
                ry={radius}
                fill="hsl(var(--muted))"
                fillOpacity={0.4}
              />
            )
          }
          return (
            <rect
              key={`${w}-${d}`}
              x={labelW + w * (cell + gap)}
              y={d * (cell + gap)}
              width={cell}
              height={cell}
              rx={radius}
              ry={radius}
              fill={op === 0 ? 'hsl(var(--muted))' : color}
              fillOpacity={op === 0 ? 1 : op}
            >
              <title>{`${v}`}</title>
            </rect>
          )
        }),
      )}
    </svg>
  )

  if (!empty) return svg

  return (
    <span className={cn('relative inline-block', className)}>
      {svg}
      <span className="pointer-events-none absolute inset-0 grid place-items-center">
        <span className="label-micro rounded-full bg-card/70 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
          {emptyLabel}
        </span>
      </span>
    </span>
  )
}
