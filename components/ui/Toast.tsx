'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconChip } from './IconChip'
import { Button } from './Button'
import { useToastProvider, useToastEnterAnimation } from './useToastProvider'

/**
 * Global toast system. The single ephemeral-feedback channel for the app —
 * action confirmations ("Saved"), the 5-second undo affordance, and inline
 * failure messages. Mounted once in the root layout via
 * {@link ToastProvider}; any client component reads {@link useToast} and calls
 * `toast({ message, tone, action, duration })`.
 *
 * The `action` field powers undo: a forward lifecycle flip persists immediately,
 * then surfaces a toast whose action button fires the compensating revert.
 */

export type ToastTone = 'default' | 'success' | 'destructive'

export type ToastAction = {
  label:   string
  onClick: () => void
}

export type ToastInput = {
  message: string
  tone?:   ToastTone
  action?: ToastAction
  /** ms before auto-dismiss; default 5000. Pass 0 to keep it until dismissed. */
  duration?: number
}

export type ToastItem = ToastInput & { id: number }

type ToastApi = {
  toast:   (t: ToastInput) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { items, toast, dismiss } = useToastProvider()

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom)]"
        aria-live="polite"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const TONE_ICON = {
  default:     Info,
  success:     CheckCircle2,
  destructive: AlertCircle,
} as const

const TONE_CHIP = {
  default:     'info',
  success:     'success',
  destructive: 'destructive',
} as const

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const entered = useToastEnterAnimation()

  const tone = item.tone ?? 'default'
  const Icon = TONE_ICON[tone]

  return (
    <div
      role={tone === 'destructive' ? 'alert' : 'status'}
      style={{ transition: 'opacity 200ms ease-out, transform 200ms ease-out' }}
      className={cn(
        'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-border bg-card p-3 pr-2 text-card-foreground shadow-card',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      <IconChip tone={TONE_CHIP[tone]} size="sm"><Icon aria-hidden="true" /></IconChip>
      <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{item.message}</p>
      {item.action && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          block={false}
          className="shrink-0"
          onClick={() => { item.action!.onClick(); onDismiss() }}
        >
          {item.action.label}
        </Button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
