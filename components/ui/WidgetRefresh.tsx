'use client'

import { RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWidgetRefresh, type WidgetRefreshSource } from './useWidgetRefresh'

/**
 * Refresh icon-button for a widget's top-right actions bar. Spins + disables
 * while refreshing; toasts on failure. The freshness logic (cache-tag invalidate
 * + `router.refresh()`, or a client-loader re-fetch) lives in {@link useWidgetRefresh}.
 * Generic primitive — a widget passes only its `source` (copy is overridable
 * via props for i18n).
 */
export function WidgetRefresh({
  source,
  label = 'Refresh',
  errorMessage = 'Couldn’t refresh.',
  className,
}: {
  source: WidgetRefreshSource
  /** Accessible name + tooltip for the button. */
  label?: string
  /** Toast message when the refresh fails. */
  errorMessage?: string
  className?: string
}) {
  const { pending, refresh } = useWidgetRefresh(source, errorMessage)
  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      aria-label={label}
      aria-busy={pending}
      title={label}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <RotateCw aria-hidden="true" className={cn('size-4', pending && 'animate-spin')} />
    </button>
  )
}
