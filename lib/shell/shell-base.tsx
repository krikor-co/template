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
