'use client'

import { useCallback, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { IconChip } from './IconChip'

/**
 * On-brand confirmation dialog — the design-language replacement for the
 * browser-native `window.confirm()`. Radix-backed (focus trap, ESC, scroll
 * lock, portal), styled with the card tokens (`bg-card`, `shadow-card`,
 * rounded-3xl). Use this before any destructive or role-changing inline action
 * so the surface matches the consequence.
 *
 * Two ways to use it:
 *
 *  1. Declarative — render `<ConfirmDialog open … onConfirm />` and drive the
 *     `open` state yourself.
 *  2. Imperative — `const confirm = useConfirmDialog()`; await `confirm({…})`
 *     wherever you would have called `window.confirm()`. Resolves `true`/`false`.
 *     Render the returned `<dialog />` element once in the component tree.
 */

type ConfirmTone = 'destructive' | 'default'

export type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Short, direct title — e.g. "Delete item?" */
  title: string
  /** Optional supporting line — the consequence, e.g. "This action cannot be undone." */
  description?: string
  /** Confirm-button label. Defaults to "Confirm". */
  confirmLabel?: string
  /** Cancel-button label. Defaults to "Cancel". */
  cancelLabel?: string
  /** Visual weight of the confirm button. Destructive → red. */
  tone?: ConfirmTone
  /** Disables the confirm button + shows it as busy while an async action runs. */
  pending?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'destructive',
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o) }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[110] bg-foreground/40 backdrop-blur-[2px]"
        />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => { if (pending) e.preventDefault() }}
          className={cn(
            'fixed left-1/2 top-1/2 z-[111] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2',
            'rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-card outline-none',
          )}
        >
          <div className="flex items-start gap-3">
            {tone === 'destructive' && (
              <IconChip tone="destructive" size="sm">
                <AlertTriangle aria-hidden="true" />
              </IconChip>
            )}
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-base font-semibold leading-snug text-foreground">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1.5 text-sm leading-snug text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              block={false}
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={tone === 'destructive' ? 'destructive' : 'default'}
              size="sm"
              block={false}
              disabled={pending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

type ConfirmRequest = Omit<ConfirmDialogProps, 'open' | 'onOpenChange' | 'onConfirm' | 'pending'>

/**
 * Imperative bridge that mirrors the `window.confirm()` shape: call
 * `await confirm({ title, description, tone })` and get a `Promise<boolean>`.
 * Render the returned `dialog` element once (it carries the live ConfirmDialog).
 *
 *   const { confirm, dialog } = useConfirmDialog()
 *   …
 *   if (!(await confirm({ title: 'Delete?', description: '…' }))) return
 *   …
 *   return <>{dialog}{rest}</>
 */
export function useConfirmDialog() {
  const [state, setState] = useState<
    { request: ConfirmRequest; resolve: (ok: boolean) => void } | null
  >(null)

  const confirm = useCallback((request: ConfirmRequest) => {
    return new Promise<boolean>((resolve) => {
      setState({ request, resolve })
    })
  }, [])

  const settle = useCallback((ok: boolean) => {
    setState((cur) => {
      cur?.resolve(ok)
      return null
    })
    // Note: resolving inside the updater is intentional — it reads the live
    // pending promise without an extra ref. The updater is pure aside from
    // settling a one-shot promise, which is idempotent (resolve after the
    // first call is a no-op).
  }, [])

  const dialog = (
    <ConfirmDialog
      open={state !== null}
      onOpenChange={(o) => { if (!o) settle(false) }}
      title={state?.request.title ?? ''}
      description={state?.request.description}
      confirmLabel={state?.request.confirmLabel}
      cancelLabel={state?.request.cancelLabel}
      tone={state?.request.tone}
      onConfirm={() => settle(true)}
    />
  )

  return { confirm, dialog }
}
