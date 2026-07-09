'use client'

import { X } from 'lucide-react'
import { cn } from '../utils'
import { useScrollLock } from '../hooks/useScrollLock'
import { ShellBase, type ShellProps } from './shell-base'

export function Drawer({
  children, open, onClose, side = 'right', closeLabel = 'Close', fill = false, title, ...props
}: ShellProps & {
  open: boolean
  onClose: () => void
  side?: 'left' | 'right'
  /** Accessible label for the pinned ✕ button. Override for non-English UIs. */
  closeLabel?: string
  /** Non-scrolling full-height flex column; the content owns the scroll (e.g. chat: scrolling messages + pinned composer). */
  fill?: boolean
}) {
  // Lock body scroll while the drawer is open so the page underneath can't
  // scroll behind it (ref-counted shared hook — overflow:hidden + scrollbar
  // compensation). Drawer content gets its own scroll container below
  // (`overflow-y-auto` on the inner body). Runs before the early return so
  // its cleanup fires when `open` flips back to false.
  useScrollLock(open)

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          // `overflow-hidden` on the panel + `overflow-y-auto` on the inner
          // body means the title row stays pinned at the top while long
          // content scrolls inside the drawer.
          // `h-[100dvh]` (not `h-full`) so the panel tracks the DYNAMIC
          // viewport: when the mobile keyboard opens, the root viewport's
          // `interactiveWidget: 'resizes-content'` shrinks the layout
          // viewport and the panel shrinks with it — keeping any
          // bottom-pinned content (e.g. a chat composer) just above the
          // keyboard. Form drawers are unaffected (their body still scrolls
          // under the same fixed height).
          'relative z-50 flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-background shadow-xl',
          side === 'right' ? 'ml-auto' : 'mr-auto'
        )}
      >
        {/* A single, consistent close affordance on EVERY drawer — a clear ✕
            icon, pinned top-right, so users never hunt for a close (and it's
            unambiguous vs. content actions like "Cancel booking"). */}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
          className="absolute right-4 top-4 z-10 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X aria-hidden className="size-5" />
        </button>
        {/* Default drawers scroll their whole body (`overflow-y-auto`). A
            `fill` drawer instead becomes a non-scrolling full-height flex
            COLUMN so its content can own the scroll internally. The
            `min-h-0 flex-1` chain is forwarded to ShellBase so the column
            actually reaches the panel's full height. */}
        <div className={cn(
          'p-6 pr-14',
          fill ? 'flex min-h-0 flex-1 flex-col' : 'flex-1 overflow-y-auto overscroll-contain',
        )}>
          <ShellBase title={title} {...props} className={fill ? 'flex min-h-0 flex-1 flex-col' : undefined}>
            {children}
          </ShellBase>
        </div>
      </div>
    </div>
  )
}
