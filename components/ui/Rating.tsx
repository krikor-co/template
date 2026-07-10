import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { chartColor } from './chart-tone'

/**
 * Rating — an HONEST star score for a reputation metric. A 5-star average must
 * read AS a rating ("4.9" + ★★★★★ out of 5), NEVER as a percent gauge (a 4.9/5
 * shown as "98%" is misleading). Use this anywhere a review average surfaces.
 *
 * Pure presentational, SSR-safe, tone-aware (the filled stars take `tone`).
 * `value` drives the partial fill; `display` is the localized figure shown big
 * (e.g. "4.9", or "4,9" with a comma decimal in pt-BR). `count` renders the
 * "N reviews" sub when provided.
 *
 * @example
 *   <Rating value={4.9} display="4.9" count={8} countLabel="reviews" />
 */
export function Rating({
  value,
  max = 5,
  display,
  label,
  count,
  countLabel,
  tone = 'warning',
  size = 'md',
  className,
}: {
  /** The score, 0–`max`, driving the partial star fill. */
  value: number
  /** Star count (default 5). */
  max?: number
  /** The big localized figure (e.g. "4,9"); defaults to `value` rounded to 1dp. */
  display?: React.ReactNode
  /** Small caption under the score (e.g. "Sua reputação"). */
  label?: React.ReactNode
  /** Review count → renders "N {countLabel}" (e.g. "8 reviews"). */
  count?: number
  /** Plural noun for the count (e.g. "reviews"); omit to hide the count line. */
  countLabel?: React.ReactNode
  tone?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const color = chartColor(tone)
  const clamped = Math.min(max, Math.max(0, Number.isFinite(value) ? value : 0))
  const fig = display ?? clamped.toFixed(1)

  const dims = size === 'lg' ? { star: 22, fig: 'text-4xl' } : size === 'sm' ? { star: 14, fig: 'text-xl' } : { star: 18, fig: 'text-3xl' }
  const figCls = 'text-foreground'
  const subCls = 'text-muted-foreground'
  const trackCls = 'text-muted-foreground/30'

  const ariaLabel =
    `${typeof label === 'string' ? label + ' ' : ''}${clamped.toFixed(1)} ${typeof max === 'number' ? 'of ' + max : ''}`.trim()

  return (
    <div className={cn('flex flex-col items-start gap-2', className)} role="img" aria-label={ariaLabel}>
      <div className="flex items-baseline gap-2">
        <span className={cn('font-semibold leading-none tracking-tight tabular-nums', dims.fig, figCls)}>
          {fig}
        </span>
        <span className={cn('text-sm tabular-nums', subCls)}>/ {max}</span>
      </div>

      {/* Star row — a track of outlined stars with a clipped colored overlay so a
          fractional score (4,9) fills proportionally. */}
      <div className="relative inline-flex" style={{ color }} aria-hidden>
        <div className={cn('flex', trackCls)}>
          {Array.from({ length: max }).map((_, i) => (
            <Star key={i} width={dims.star} height={dims.star} strokeWidth={1.75} className="fill-current" />
          ))}
        </div>
        <div
          className="absolute inset-y-0 left-0 flex overflow-hidden"
          style={{ width: `${(clamped / max) * 100}%`, color }}
        >
          {Array.from({ length: max }).map((_, i) => (
            <Star key={i} width={dims.star} height={dims.star} strokeWidth={1.75} className="shrink-0 fill-current" />
          ))}
        </div>
      </div>

      {(label != null || (count != null && countLabel != null)) && (
        <div className="space-y-0.5">
          {label != null && <p className="label-micro">{label}</p>}
          {count != null && countLabel != null && (
            <p className={cn('text-xs tabular-nums', subCls)}>
              {count} {countLabel}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
