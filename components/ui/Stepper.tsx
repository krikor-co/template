import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Stepper — the wizard step rail for multi-step create flows, and a vertical
 * event Timeline for detail-page history. Three step states, tonal: **done** =
 * success with a check, **current** = brand (the active anchor), **upcoming** =
 * muted/quiet. A connector line links the markers.
 *
 * Pure presentation: it's driven by the wizard scene state (UNCHANGED). The
 * current step carries `aria-current="step"`; the rail is an ordered list.
 *
 * For an event history, see `Timeline` below (same visual rail, event rows).
 */

export type StepStatus = 'done' | 'current' | 'upcoming'

export type Step = {
  label: React.ReactNode
  description?: React.ReactNode
  /** Optional glyph to show in the marker (overrides the number / check). */
  icon?: React.ReactNode
  status: StepStatus
}

const markerTone: Record<StepStatus, string> = {
  done:     'bg-success-soft text-success-deep ring-1 ring-inset ring-success-deep/15',
  current:  'bg-brand text-brand-foreground',
  upcoming: 'bg-secondary text-muted-foreground',
}

const labelTone: Record<StepStatus, string> = {
  done:     'text-foreground',
  current:  'text-foreground font-semibold',
  upcoming: 'text-muted-foreground',
}

function Marker({ step, index }: { step: Step; index: number }) {
  return (
    <span
      className={cn(
        'relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
        markerTone[step.status],
      )}
      aria-hidden
    >
      {step.icon ?? (step.status === 'done' ? <Check className="size-4" /> : index + 1)}
    </span>
  )
}

export function Stepper({
  steps,
  orientation = 'vertical',
  className,
}: {
  steps: Step[]
  orientation?: 'vertical' | 'horizontal'
  className?: string
}) {
  const lineCls = 'bg-border'

  if (orientation === 'horizontal') {
    return (
      <ol className={cn('flex items-start', className)}>
        {steps.map((step, i) => {
          const last = i === steps.length - 1
          return (
            <li
              key={i}
              aria-current={step.status === 'current' ? 'step' : undefined}
              className={cn('flex flex-1 flex-col items-center text-center', last && 'flex-none')}
            >
              <div className="flex w-full items-center">
                <span className={cn('h-px flex-1', i === 0 ? 'opacity-0' : lineCls)} />
                <Marker step={step} index={i} />
                <span className={cn('h-px flex-1', last ? 'opacity-0' : lineCls)} />
              </div>
              <div className="mt-2 px-1">
                <p className={cn('text-sm', labelTone[step.status])}>{step.label}</p>
                {step.description && (
                  <p className={cn('mt-0.5 text-xs text-muted-foreground')}>
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol className={cn('flex flex-col', className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1
        return (
          <li
            key={i}
            aria-current={step.status === 'current' ? 'step' : undefined}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {/* connector */}
            {!last && (
              <span className={cn('absolute left-[13px] top-7 bottom-0 w-px', lineCls)} aria-hidden />
            )}
            <Marker step={step} index={i} />
            <div className="min-w-0 pt-0.5">
              <p className={cn('text-sm leading-tight', labelTone[step.status])}>{step.label}</p>
              {step.description && (
                <p className={cn('mt-0.5 text-xs text-muted-foreground')}>
                  {step.description}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export type TimelineEvent = {
  /** When it happened (e.g. "14:32", "yesterday"). */
  when: React.ReactNode
  title: React.ReactNode
  meta?: React.ReactNode
  icon?: React.ReactNode
  /** Tints the marker dot. */
  tone?: 'plain' | 'success' | 'brand' | 'warning' | 'info' | 'destructive'
}

const dotTone: Record<NonNullable<TimelineEvent['tone']>, string> = {
  plain:       'bg-secondary text-muted-foreground',
  success:     'bg-success-soft text-success-deep',
  brand:       'bg-brand-soft text-brand-deep',
  warning:     'bg-warning-soft text-warning-deep',
  info:        'bg-info-soft text-info-deep',
  destructive: 'bg-destructive-soft text-destructive-deep',
}

/**
 * Vertical event timeline — detail-page history (entity history, activity
 * feeds). Same rail visual as the Stepper, but each node is a past event with a
 * timestamp.
 */
export function Timeline({
  events,
  className,
}: {
  events: TimelineEvent[]
  className?: string
}) {
  const lineCls = 'bg-border'
  return (
    <ol className={cn('flex flex-col', className)}>
      {events.map((ev, i) => {
        const last = i === events.length - 1
        return (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className={cn('absolute left-[13px] top-7 bottom-0 w-px', lineCls)} aria-hidden />}
            <span
              className={cn(
                'relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5',
                dotTone[ev.tone ?? 'plain'],
              )}
              aria-hidden
            >
              {ev.icon}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className={cn('text-sm font-medium leading-tight')}>{ev.title}</p>
                <span className={cn('text-xs tabular-nums text-muted-foreground')}>
                  {ev.when}
                </span>
              </div>
              {ev.meta && (
                <p className={cn('mt-0.5 text-xs text-muted-foreground')}>
                  {ev.meta}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
