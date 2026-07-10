'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'

type Props = {
  value:       string
  onValueChange: (next: string) => void
  /** Placeholder + aria-label for the input. */
  placeholder?: string
  /** Accessible label for the clear button (only shown when value is set). */
  clearLabel?:  string
  className?:  string
}

/**
 * ListSearch — a labelled, accessible search input with a clear affordance.
 *
 * A pure primitive: it owns no state, just renders the controlled input plus
 * a clear button. The query state + filtering live in `useListFilter`.
 * Styled by the shared `Input` chrome.
 */
export function ListSearch({ value, onValueChange, placeholder = 'Search…', clearLabel = 'Clear search', className }: Props) {
  return (
    <div className={`relative w-full max-w-xs ${className ?? ''}`}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-10 pr-9"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label={clearLabel}
          className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  )
}
