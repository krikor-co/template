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

```tsx
'use client'

import { ShellBase, type ShellProps } from './shell-base'

export function Modal({
  children, open, onClose, ...props
}: ShellProps & { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
        <ShellBase {...props}>{children}</ShellBase>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
```

### Drawer (`lib/shell/drawer.tsx`)

```tsx
'use client'

import { cn } from '../utils'
import { ShellBase, type ShellProps } from './shell-base'

export function Drawer({
  children, open, onClose, side = 'right', ...props
}: ShellProps & { open: boolean; onClose: () => void; side?: 'left' | 'right' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={cn(
        'relative z-50 flex h-full w-full max-w-md flex-col bg-background p-6 shadow-xl',
        side === 'right' ? 'ml-auto' : 'mr-auto'
      )}>
        <ShellBase {...props}>{children}</ShellBase>
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
