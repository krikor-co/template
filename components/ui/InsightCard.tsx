'use client'

import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, X, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Tile } from './Tile'
import { IconChip } from './IconChip'
import { SectionLabel } from './SectionLabel'

/**
 * The ✨ AI insight card — the workhorse of the AI widget family. One primitive,
 * four variants: `info` (a generic suggestion), `forecast` (a projection),
 * `anomaly` (an out-of-band metric), `nudge` (a gentle prompt). Soft-`info` is
 * the calm default surface; anomalies escalate to warning/destructive; an optional
 * solid `accent` surface anchors a dark AI brief.
 *
 * Anatomy: ✨ IconChip(info) + a `text-info` kicker → a headline → one body line
 * → an optional CTA + a `1/N` pager + dismiss/feedback affordances. The cool
 * accent is reserved for AI/info ONLY — never money/status/KPI.
 *
 * Logic-free: pagination/feedback/dismiss are presentational callbacks the
 * mounting widget owns. Reduced-motion-safe (the only motion is a `Reveal`-style
 * fade, gated by `motion-reduce:`).
 *
 * All aria/microcopy defaults are English and overridable via `labels` (i18n via props).
 */

type InsightVariant = 'info' | 'forecast' | 'anomaly' | 'nudge'
type Surface = 'soft' | 'accent'

const VARIANT_ICON: Record<InsightVariant, typeof Sparkles> = {
  info:     Sparkles,
  forecast: TrendingUp,
  anomaly:  AlertTriangle,
  nudge:    Lightbulb,
}

/** Default kicker per variant (English), overridable via `kicker` — swap "AI" for your product's persona. */
const VARIANT_KICKER: Record<InsightVariant, string> = {
  info:     'AI · SUGGESTION',
  forecast: 'AI · FORECAST',
  anomaly:  'AI · ALERT',
  nudge:    'AI · TIP',
}

/**
 * The soft surface per variant. `info`/`forecast`/`nudge` ride the calm cool
 * accent; `anomaly` escalates to warning (watch) and may go destructive via
 * `severity`. On soft fills text rides the tone's `-deep` ink (WCAG pairing rule).
 */
const surfaceVariants = cva('relative flex flex-col gap-4', {
  variants: {
    surface: {
      soft:   '',
      accent: '',
    },
  },
  defaultVariants: { surface: 'soft' },
})

/** English defaults for the card's aria/microcopy — override for i18n. */
export type InsightCardLabels = {
  dismiss:    string
  helpful:    string
  notHelpful: string
  prev:       string
  next:       string
  pager:      (index: number, total: number) => string
  region:     string
}

const DEFAULT_LABELS: InsightCardLabels = {
  dismiss:    'Dismiss insight',
  helpful:    'Helpful',
  notHelpful: 'Not helpful',
  prev:       'Previous insight',
  next:       'Next insight',
  pager:      (index, total) => `Insight ${index} of ${total}`,
  region:     'AI insight',
}

export type InsightCardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof surfaceVariants> & {
    /** The AI insight category — drives the icon, kicker, and default tone. */
    variant?: InsightVariant
    /** `soft` (default tinted tile) or `accent` (solid AI-brief anchor). */
    surface?: Surface
    /** Escalates an `anomaly` from warning (watch) to destructive (alarm). */
    severity?: 'watch' | 'alarm'
    /** Override the default per-variant kicker (e.g. "ACME · FORECAST"). */
    kicker?: React.ReactNode
    /** The one-line insight headline (the hero of the card). */
    headline: React.ReactNode
    /** One supporting line of plain-language body. */
    body?: React.ReactNode
    /** Optional CTA — a link-style affordance ("ver detalhes →"). */
    cta?: { label: React.ReactNode; onClick?: () => void; href?: string }
    /** Pager: 1-based current index + total count. Hidden when `total <= 1`. */
    page?: { index: number; total: number; onPrev?: () => void; onNext?: () => void }
    /** Dismiss handler — renders the ✕ control when provided. */
    onDismiss?: () => void
    /** Feedback handlers — render 👍/👎 when either is provided. */
    onFeedback?: (vote: 'up' | 'down') => void
    /** Override the English aria/microcopy defaults. */
    labels?: Partial<InsightCardLabels>
    /** Extra slot rendered between body and footer (e.g. a forecast Sparkline). */
    children?: React.ReactNode
  }

export function InsightCard({
  variant = 'info',
  surface = 'soft',
  severity = 'watch',
  kicker,
  headline,
  body,
  cta,
  page,
  onDismiss,
  onFeedback,
  labels,
  className,
  children,
  ...rest
}: InsightCardProps) {
  const L = { ...DEFAULT_LABELS, ...labels }
  const Icon = VARIANT_ICON[variant]
  const onDark = surface === 'accent'
  const alarm = variant === 'anomaly' && severity === 'alarm'

  // Tile tone: solid accent anchor, escalated anomaly (destructive/warning soft), or
  // the calm info-soft default. Anomalies never use the cool info surface —
  // they are status, so they stay warm.
  const tileTone = onDark
    ? 'accent'
    : variant === 'anomaly'
      ? (alarm ? undefined : 'warning')
      : 'info'

  // Anomaly-alarm has no Tile tone token; paint it as a destructive-soft tile.
  const alarmCls = alarm && !onDark
    ? 'bg-destructive-soft text-destructive-deep ring-1 ring-inset ring-destructive-deep/10'
    : undefined

  // The signature ✨ chip + kicker. On the accent anchor the cool accent reads bright
  // via the light-theme DEFAULT; on a soft anomaly tile it matches the warning.
  const chipTone =
    variant === 'anomaly'
      ? (alarm ? 'plain' : 'warning')
      : 'info'
  const kickerCls = onDark
    ? 'text-info'
    : variant === 'anomaly'
      ? (alarm ? 'text-destructive-deep' : 'text-warning-deep')
      : 'text-info'

  // On the solid accent surface the ✨ chip needs its own raised fill, not bare ink.
  const chipOnDarkCls = onDark ? 'bg-accent-foreground/10 text-info' : undefined

  return (
    <Tile
      tone={tileTone}
      className={cn(
        surfaceVariants({ surface }),
        alarmCls,
        className,
      )}
      role="region"
      aria-label={typeof headline === 'string' ? headline : L.region}
      {...rest}
    >
      {/* Header: ✨ chip + AI kicker, dismiss on the far right. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconChip tone={chipTone} size="sm" className={cn(chipOnDarkCls)}>
            <Icon aria-hidden />
          </IconChip>
          <SectionLabel as="span" className={cn('truncate', kickerCls)}>
            {kicker ?? VARIANT_KICKER[variant]}
          </SectionLabel>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={L.dismiss}
            className={cn(
              'inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
              onDark ? 'text-current/70 hover:bg-accent-foreground/10 hover:text-current' : 'text-current/60 hover:bg-card/60 hover:text-current',
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>

      {/* Body: headline (hero line) + one supporting line. */}
      <div className="min-w-0 space-y-1">
        <p className="text-base font-semibold leading-snug tracking-tight">{headline}</p>
        {body && <p className={cn('text-sm leading-relaxed', onDark ? 'text-current opacity-80' : 'text-current/85')}>{body}</p>}
      </div>

      {/* Optional inline slot (forecast spark, mini-bars, etc.). */}
      {children}

      {/* Footer: CTA + feedback + pager. */}
      {(cta || onFeedback || (page && page.total > 1)) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            {cta && (
              cta.href ? (
                <a
                  href={cta.href}
                  onClick={cta.onClick}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full text-sm font-medium underline-offset-4 transition-colors hover:underline',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
                    onDark ? 'text-info' : 'text-info-deep',
                  )}
                >
                  {cta.label}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={cta.onClick}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full text-sm font-medium underline-offset-4 transition-colors hover:underline',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
                    onDark ? 'text-info' : 'text-info-deep',
                  )}
                >
                  {cta.label}
                </button>
              )
            )}
            {onFeedback && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onFeedback('up')}
                  aria-label={L.helpful}
                  className={cn(
                    'inline-flex size-7 items-center justify-center rounded-full transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
                    onDark ? 'text-current/70 hover:bg-accent-foreground/10 hover:text-current' : 'text-current/60 hover:bg-card/60 hover:text-current',
                  )}
                >
                  <ThumbsUp aria-hidden className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onFeedback('down')}
                  aria-label={L.notHelpful}
                  className={cn(
                    'inline-flex size-7 items-center justify-center rounded-full transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
                    onDark ? 'text-current/70 hover:bg-accent-foreground/10 hover:text-current' : 'text-current/60 hover:bg-card/60 hover:text-current',
                  )}
                >
                  <ThumbsDown aria-hidden className="size-3.5" />
                </button>
              </div>
            )}
          </div>

          {page && page.total > 1 && (
            <div className="flex items-center gap-1.5" role="group" aria-label={L.pager(page.index, page.total)}>
              <button
                type="button"
                onClick={page.onPrev}
                disabled={page.index <= 1}
                aria-label={L.prev}
                className={cn(
                  'inline-flex size-7 items-center justify-center rounded-full transition-colors disabled:opacity-40',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
                  onDark ? 'text-current/70 enabled:hover:bg-accent-foreground/10' : 'text-current/60 enabled:hover:bg-card/60',
                )}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <span className={cn('tabular-nums text-xs font-medium', onDark ? 'text-current opacity-80' : 'text-current/70')}>
                {page.index}/{page.total}
              </span>
              <button
                type="button"
                onClick={page.onNext}
                disabled={page.index >= page.total}
                aria-label={L.next}
                className={cn(
                  'inline-flex size-7 items-center justify-center rounded-full transition-colors disabled:opacity-40',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info',
                  onDark ? 'text-current/70 enabled:hover:bg-accent-foreground/10' : 'text-current/60 enabled:hover:bg-card/60',
                )}
              >
                <ChevronRight aria-hidden className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </Tile>
  )
}
