import { cn } from '@/lib/utils'
import { Delta } from './Delta'
import { chartColor } from './chart-tone'

/**
 * A ratio / percent dial for a rate or score (occupancy %, repeat-rate, goal %,
 * setup readiness, collection rate). Two shapes from one component:
 *   - `variant="semi"` (default) — the references' semicircle GAUGE.
 *   - `variant="ring"` — a full 0–100 progress RING with a center figure.
 *
 * Pure-SVG arc, no deps, SSR-safe (mirrors the Donut build). The arc is tinted
 * by threshold band (good → success, watch → warning, bad → destructive) unless an
 * explicit `tone` is given. Center carries the huge tabular-nums value + a
 * `.label-micro` sub; an optional `Delta` pill rides beneath.
 *
 * @example
 *   <Gauge value={0.82} label="Occupancy" delta="+4%" />          // semicircle
 *   <Gauge variant="ring" value={64} label="Setup" tone="info" /> // full ring
 */
export type GaugeTone = 'success' | 'warning' | 'destructive' | 'brand' | 'info'

/** Threshold bands when `tone` is auto: ≥0.7 good, ≥0.4 watch, else bad. */
function bandTone(fraction: number): GaugeTone {
  if (fraction >= 0.7) return 'success'
  if (fraction >= 0.4) return 'warning'
  return 'destructive'
}

export function Gauge({
  value,
  label,
  sub,
  delta,
  deltaInvert,
  tone,
  variant = 'semi',
  size = 180,
  format,
  className,
}: {
  /** 0–1 (fraction) or 0–100 (percent) — both are normalized to a 0–1 sweep. */
  value: number
  label?: React.ReactNode
  sub?: React.ReactNode
  /** A signed change string (e.g. "+4%") rendered as a Delta pill. */
  delta?: string
  deltaInvert?: boolean
  /** Force an arc tone; omit to band by threshold. */
  tone?: GaugeTone
  /** `semi` = semicircle gauge (default); `ring` = full-circle progress ring. */
  variant?: 'semi' | 'ring'
  size?: number
  /** Render the center value; defaults to a whole-percent string. */
  format?: (fraction: number) => React.ReactNode
  className?: string
}) {
  const fraction = Math.min(1, Math.max(0, value > 1 ? value / 100 : value))
  const hasValue = Number.isFinite(value)
  // At 0% the arc draws nothing, leaving a bare track that reads as "broken".
  // Treat 0 (and a missing value) as an honest EMPTY state: the center figure
  // goes muted and a small start-cap nub sits on the track so the dial reads as
  // a real scale resting at zero, not a failed render.
  const isEmpty = !hasValue || fraction <= 0
  const arcColor = chartColor(tone ?? bandTone(fraction))
  const trackColor = 'hsl(var(--muted))'
  const capColor = 'hsl(var(--muted-foreground))'
  const stroke = Math.max(10, Math.round(size * 0.09))

  const centerCls = 'text-foreground'
  const subCls = 'text-muted-foreground'

  const centerValue = (
    <p
      className={cn(
        'font-semibold leading-none tracking-tight tabular-nums',
        isEmpty ? cn(subCls, 'font-medium') : centerCls,
      )}
      style={{ fontSize: Math.round(size * 0.2) }}
    >
      {hasValue ? (format ? format(fraction) : `${Math.round(fraction * 100)}%`) : '—'}
    </p>
  )
  const centerMeta = (
    <>
      {label && <p className="label-micro mt-1">{label}</p>}
      {sub && <p className={cn('mt-0.5 text-xs', subCls)}>{sub}</p>}
    </>
  )
  const deltaPill = delta ? (
    <div className="mt-2">
      <Delta value={delta} invert={deltaInvert} />
    </div>
  ) : null
  const ariaLabel =
    typeof label === 'string' ? `${label} ${Math.round(fraction * 100)}%` : `${Math.round(fraction * 100)}%`

  // ── Full ring ────────────────────────────────────────────────────────────
  if (variant === 'ring') {
    const r = (size - stroke) / 2
    const circ = 2 * Math.PI * r
    return (
      <div
        className={cn('inline-flex flex-col items-center', className)}
        role="img"
        aria-label={ariaLabel}
      >
        <div className="relative" style={{ width: size, height: size }}>
          {/* -90° so the ring fills clockwise from the top */}
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
            {isEmpty && (
              // Start-cap nub at the ring's dash origin (3 o'clock pre-rotation →
              // 12 o'clock after the -90° rotation), muted, so the empty dial
              // still reads as a live scale resting at zero.
              <circle cx={size / 2 + r} cy={size / 2} r={stroke * 0.34} fill={capColor} opacity={0.55} />
            )}
            {hasValue && fraction > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={arcColor}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${fraction * circ} ${circ}`}
                className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
              />
            )}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              {centerValue}
              {centerMeta}
            </div>
          </div>
        </div>
        {deltaPill}
      </div>
    )
  }

  // ── Semicircle (default) ──────────────────────────────────────────────────
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const start = { x: cx - r, y: cy }
  const end = { x: cx + r, y: cy }
  const semiLen = Math.PI * r
  const height = cy + stroke / 2

  return (
    <div className={cn('inline-flex flex-col items-center', className)} role="img" aria-label={ariaLabel}>
      <div className="relative" style={{ width: size, height }}>
        <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} aria-hidden>
          <path
            d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {isEmpty && (
            // Start-cap nub at the gauge's left origin — the empty dial reads as
            // a real scale sitting at zero, not a broken arc.
            <circle cx={start.x} cy={start.y} r={stroke * 0.34} fill={capColor} opacity={0.55} />
          )}
          {hasValue && fraction > 0 && (
            <path
              d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
              fill="none"
              stroke={arcColor}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${fraction * semiLen} ${semiLen}`}
              className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
            />
          )}
        </svg>
        <div className="absolute inset-x-0 bottom-0 grid place-items-center text-center">
          {centerValue}
          {centerMeta}
        </div>
      </div>
      {deltaPill}
    </div>
  )
}
