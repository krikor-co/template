'use client'

import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'
import { cn } from './utils'

// ─── ShellBase ────────────────────────────────────────────────────────────────

type ShellBaseProps = {
  children:    React.ReactNode
  title?:      string
  onRefresh?:  () => void
  onFeedback?: () => void
  className?:  string
}

function ShellBase({ children, title, onRefresh, onFeedback, className }: ShellBaseProps) {
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

// ─── Shell types ──────────────────────────────────────────────────────────────

type ShellProps = Omit<ShellBaseProps, 'className'>

/** The Scene IS the page. Use for single-focus steps. */
function FullPage({ children, ...props }: ShellProps) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <ShellBase {...props}>{children}</ShellBase>
    </main>
  )
}

/** Inline section on a multi-section page. */
function Card({ children, ...props }: ShellProps) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <ShellBase {...props}>{children}</ShellBase>
    </div>
  )
}

/** Overlay that blocks the UI. Requires explicit dismiss. */
function Modal({
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

/** Slides in from the side. For detail views and settings. */
function Drawer({
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

/**
 * Animates between sub-Scenes in an Orchestrating Scene.
 * When stepKey changes, old content exits, new content enters.
 */
function AnimatedStep({ stepKey, children }: { stepKey: string; children: React.ReactNode }) {
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

// ─── Error boundary ───────────────────────────────────────────────────────────

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

// ─── Export ───────────────────────────────────────────────────────────────────

export const Shell = { FullPage, Card, Modal, Drawer, AnimatedStep }
