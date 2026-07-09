---
title: Shells
order: 3
category: Core
---

# Shell — Presentation Context

The Shell wraps a Section and provides:

- `@container` queries so sections can respond to their container's width
- An error boundary that catches runtime errors and offers a refresh affordance
- `title`, `onRefresh`, and `onFeedback` global affordances
- Overlay shells (Modal / Drawer) lock body scroll (`useScrollLock`, ref-counted for stacked overlays), carry dialog ARIA (`role="dialog"`, `aria-modal`, `aria-label={title}`), and pin an aria-labeled ✕ (`closeLabel` prop, default `'Close'`) to the non-scrolling panel while the body scrolls inside
- Structural layout (full-page, card, modal, drawer)

Sections **never** import or reference the Shell. The Shell is always the caller's concern — `page.tsx` or a parent component decides which Shell to use.

## The five Shell types

| Situation | Shell |
|-----------|-------|
| Page is the entire content | `Shell.FullPage` |
| Section within a page | `Shell.Card` |
| Blocking confirmation, quick form | `Shell.Modal` |
| Detail view, settings, side panel | `Shell.Drawer` |
| Sub-sections within a client section that animate | `Shell.AnimatedStep` |

## File structure

```
lib/shell/
  index.ts            ← re-exports Shell namespace + ShellProps type
  shell-base.tsx      ← ShellBase: @container, title bar, error boundary
  full-page.tsx       ← Shell.FullPage
  card.tsx            ← Shell.Card
  modal.tsx           ← Shell.Modal
  drawer.tsx          ← Shell.Drawer
  animated-step.tsx   ← Shell.AnimatedStep
```

## Implementation

### ShellBase (`lib/shell/shell-base.tsx`)

Every Shell variant wraps its children in `ShellBase`, which provides the `@container` wrapper, optional title/action bar, and an error boundary.

```tsx
'use client'

import React from 'react'
import { cn } from '../utils'

export type ShellBaseProps = {
  children:    React.ReactNode
  title?:      string
  onRefresh?:  () => void
  onFeedback?: () => void
  className?:  string
}

export type ShellProps = Omit<ShellBaseProps, 'className'>

export function ShellBase({ children, title, onRefresh, onFeedback, className }: ShellBaseProps) {
  return (
    <div className={cn('@container', className)}>
      {(title || onRefresh || onFeedback) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          <div className="flex gap-2">
            {onRefresh  && (
              <button onClick={onRefresh}  className="text-sm text-muted-foreground hover:text-foreground">
                Refresh
              </button>
            )}
            {onFeedback && (
              <button onClick={onFeedback} className="text-sm text-muted-foreground hover:text-foreground">
                Feedback
              </button>
            )}
          </div>
        </div>
      )}
      <SceneErrorBoundary onRefresh={onRefresh}>
        {children}
      </SceneErrorBoundary>
    </div>
  )
}

class SceneErrorBoundary extends React.Component<
  { children: React.ReactNode; onRefresh?: () => void },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-2 p-4 text-center">
          <p className="text-sm text-destructive">Something went wrong.</p>
          {this.props.onRefresh && (
            <button
              onClick={() => {
                this.setState({ hasError: false })
                this.props.onRefresh?.()
              }}
              className="text-sm underline"
            >
              Try again
            </button>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
```

### FullPage (`lib/shell/full-page.tsx`)

```tsx
import { ShellBase, type ShellProps } from './shell-base'

export function FullPage({ children, ...props }: ShellProps) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <ShellBase {...props}>{children}</ShellBase>
    </main>
  )
}
```

### Card (`lib/shell/card.tsx`)

```tsx
import { ShellBase, type ShellProps } from './shell-base'

export function Card({ children, ...props }: ShellProps) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <ShellBase {...props}>{children}</ShellBase>
    </div>
  )
}
```

### Modal (`lib/shell/modal.tsx`)

Caps its height at `max-h-[calc(100dvh-2rem)]` (paired with the container's `p-4`) so tall content scrolls inside `overflow-y-auto overscroll-contain` while the panel and ✕ stay pinned.

```tsx
'use client'

import { useScrollLock } from '../hooks/useScrollLock'
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
  // a drawer underneath). Hook runs before the early return so its cleanup
  // fires when `open` flips back to false.
  useScrollLock(open)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // max-h pairs with the container's p-4 (2rem top+bottom): the panel
        // never exceeds the dynamic viewport; a tall body scrolls inside.
        className="relative z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-lg bg-background shadow-lg"
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
```

### Drawer (`lib/shell/drawer.tsx`)

Uses `h-[100dvh]` so the panel tracks the dynamic viewport (bottom-pinned content stays above the mobile keyboard when the root viewport sets `interactiveWidget: 'resizes-content'`). Default drawers scroll their body; pass `fill` when the content owns its scroll (chat-style: scrolling list + pinned composer).

```tsx
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
```

### AnimatedStep (`lib/shell/animated-step.tsx`)

```tsx
'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type React from 'react'

export function AnimatedStep({ stepKey, children }: { stepKey: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{    opacity: 0, x: -16 }}
        transition={{ duration: 0.15, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

### Barrel export (`lib/shell/index.ts`)

```typescript
import { FullPage } from './full-page'
import { Card } from './card'
import { Modal } from './modal'
import { Drawer } from './drawer'
import { AnimatedStep } from './animated-step'

export { type ShellProps } from './shell-base'
export const Shell = { FullPage, Card, Modal, Drawer, AnimatedStep }
```
