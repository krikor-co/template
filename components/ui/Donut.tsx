import { cn } from '@/lib/utils'
import { chartColor } from './chart-tone'

/** Default categorical cycle when a segment omits its `tone`. */
const PALETTE = ['brand', 'accent', 'info', 'success', 'warning', 'neutral'] as const

/**
 * Shorten a person's name to "First L." so a donut/leaderboard legend never
 * clips into an ambiguous "Tatiana …". A single token is returned as-is; an
 * already-short name is left intact. Non-string nodes pass through untouched.
 */
export function shortenName(name: React.ReactNode): React.ReactNode {
  if (typeof name !== 'string') return name
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  const initial = parts[parts.length - 1][0]
  if (!initial) return parts[0]
  return `${parts[0]} ${initial.toUpperCase()}.`
}

export type DonutSegment = { value: number; tone?: string; label?: string }

export type DonutLegendRow = {
  /** Displayed name — shortened to "First L." automatically when it's a string. */
  label:  React.ReactNode
  /** Right-aligned figure (already formatted). */
  figure?: React.ReactNode
  /** Dot color; defaults to the segment's palette color at this index. */
  tone?:  string
}

/**
 * Pure-SVG donut chart with a meaningful center + optional legend. Segments are
 * colored by tone token (a known name → its CSS var, or any raw CSS color);
 * segments without one cycle the default palette in order. No deps, SSR-safe.
 * Renders a muted ring when total is 0 (empty state).
 *
 * The center NEVER shows a bare ambiguous number: pass an explicit `centerLabel`
 * (e.g. the formatted total), or omit it and the donut falls back to the top
 * segment's share % with a "largest" sub — never a naked segment count.
 *
 * Pass `legend` to render a co-located legend whose names are auto-shortened
 * (first name + initial) and wrap to two lines rather than clipping.
 */
export function Donut({
  segments,
  size = 160,
  thickness = 18,
  centerLabel,
  centerSub,
  legend,
  legendTopShare = false,
  className,
}: {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  centerLabel?: React.ReactNode
  centerSub?:   React.ReactNode
  /** Optional legend rows rendered beside the ring (names auto-shortened). */
  legend?: DonutLegendRow[]
  /** When no `centerLabel` is given, fill the center with the top share %. */
  legendTopShare?: boolean
  className?: string
}) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0)

  // Resolve a meaningful center. Prefer an explicit label; otherwise show the
  // dominant share % so the middle always means something (never a bare count).
  const topShare = total > 0 ? Math.max(...segments.map((s) => s.value)) / total : 0
  const resolvedCenter =
    centerLabel != null
      ? centerLabel
      : legendTopShare && total > 0
        ? `${Math.round(topShare * 100)}%`
        : null
  const resolvedSub =
    centerSub != null ? centerSub : centerLabel == null && resolvedCenter != null ? 'largest' : null

  let offset = 0
  const ring = (
    <div className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const frac = s.value / total
            const dash = frac * c
            const segTone = s.tone ?? PALETTE[i % PALETTE.length]
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={chartColor(segTone)}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(dash - 3, 0)} ${c}`}
                strokeDashoffset={-offset * c}
              />
            )
            offset += frac
            return el
          })}
      </svg>
      {(resolvedCenter != null || resolvedSub != null) && (
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            {resolvedCenter != null && (
              <div className="tabular-nums text-xl font-semibold tracking-tight">{resolvedCenter}</div>
            )}
            {resolvedSub != null && <div className="label-micro mt-0.5 text-muted-foreground">{resolvedSub}</div>}
          </div>
        </div>
      )}
    </div>
  )

  if (!legend || legend.length === 0) {
    return <div className={cn('inline-grid place-items-center', className)}>{ring}</div>
  }

  return (
    <div className={cn('flex items-center gap-5', className)}>
      {ring}
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {legend.map((row, i) => {
          const dot = chartColor((row.tone as string) ?? PALETTE[i % PALETTE.length])
          return (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="mt-1 size-2.5 shrink-0 self-start rounded-full" style={{ backgroundColor: dot }} aria-hidden />
                <span className="min-w-0 break-words line-clamp-2">{shortenName(row.label)}</span>
              </span>
              {row.figure != null && <span className="shrink-0 font-medium tabular-nums">{row.figure}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
