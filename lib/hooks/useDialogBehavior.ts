'use client'

import { useEffect, useRef } from 'react'

/**
 * The modal keyboard/focus contract for `role="dialog" aria-modal="true"`
 * overlays (Modal, Drawer) — pairs with `useScrollLock` the same way:
 * call it unconditionally BEFORE the component's early `if (!open) return null`
 * so cleanup fires when `open` flips back to false.
 *
 * Implements, per the WAI-ARIA dialog pattern:
 *   - **Escape → onClose** — only the TOPMOST dialog of a stack closes (a
 *     modal opened from a drawer closes first; the drawer needs a second
 *     Escape), tracked by a module-level stack like useScrollLock's refcount.
 *   - **Initial focus** — moves into the panel on open: the first focusable
 *     element, else the panel itself (attach the returned ref AND
 *     `tabIndex={-1}` to the panel element).
 *   - **Focus trap** — Tab / Shift+Tab wrap within the panel; focus that
 *     escaped the panel (e.g. via a click on the backdrop) is pulled back on
 *     the next Tab.
 *   - **Focus restore** — whatever element was focused before the dialog
 *     opened (usually the trigger button) is re-focused on close.
 *
 * Returns the panel ref to attach to the dialog's panel element.
 */
export function useDialogBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Keep the latest onClose without re-running the open/close effect when a
  // caller passes a fresh closure each render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const id = Symbol('dialog')
    dialogStack.push(id)

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    // Initial focus: first focusable child, else the panel itself (tabIndex=-1).
    const panel = panelRef.current
    const initial = panel ? (focusables(panel)[0] ?? panel) : null
    initial?.focus()

    function onKeyDown(e: KeyboardEvent) {
      // Only the topmost dialog of a stack owns the keyboard contract.
      if (dialogStack[dialogStack.length - 1] !== id) return

      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }

      if (e.key === 'Tab') {
        const panel = panelRef.current
        if (!panel) return
        const els = focusables(panel)
        if (els.length === 0) {
          // Nothing tabbable inside — keep focus parked on the panel.
          e.preventDefault()
          panel.focus()
          return
        }
        const first = els[0]
        const last = els[els.length - 1]
        const active = document.activeElement
        const inside = active instanceof Node && panel.contains(active)
        if (e.shiftKey) {
          if (!inside || active === first) {
            e.preventDefault()
            last.focus()
          }
        } else if (!inside || active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    // Capture phase so the trap still runs when an inner widget stops
    // bubbling, and so Escape closes before page-level shortcuts react.
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      dialogStack.splice(dialogStack.indexOf(id), 1)
      previouslyFocused?.focus()
    }
  }, [open])

  return panelRef
}

/** Open-dialog stack — last entry is the topmost overlay. */
const dialogStack: symbol[] = []

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function focusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}
