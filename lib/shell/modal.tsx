'use client'

import { useScrollLock } from '../hooks/useScrollLock'
import { useDialogBehavior } from '../hooks/useDialogBehavior'
import { ShellBase, type ShellProps } from './shell-base'

export function Modal({
  children, open, onClose, closeLabel = 'Close', title, ...props
}: ShellProps & {
  open: boolean
  onClose: () => void
  /** Accessible label for the pinned ✕ button. Override for non-English UIs. */
  closeLabel?: string
}) {
  // Lock body scroll while the modal is open (ref-counted; safe to stack with
  // a drawer underneath). Hooks run before the early return so their cleanup
  // fires when `open` flips back to false.
  useScrollLock(open)
  // Modal keyboard/focus contract: Escape→onClose (topmost of a stack first),
  // initial focus into the panel, Tab focus trap, focus restore on close.
  const panelRef = useDialogBehavior(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Focus target of last resort (no focusable children) — outline
        // suppressed; the ✕ button is normally focused first.
        tabIndex={-1}
        // max-h pairs with the container's p-4 (2rem top+bottom): the panel
        // never exceeds the dynamic viewport; a tall body scrolls inside.
        className="relative z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-lg bg-background shadow-lg outline-none"
      >
        {/* ✕ pinned to the (non-scrolling) panel so it stays reachable while
            a tall modal body scrolls inside. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          ✕
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          <ShellBase title={title} {...props}>{children}</ShellBase>
        </div>
      </div>
    </div>
  )
}
