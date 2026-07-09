'use client'

import { SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { ListSearch } from '@/components/ui/ListSearch'
import { useListFilter } from '@/components/ui/useListFilter'

export type FilterableRow = {
  /** Stable key (the row's id) — also used as the React key. */
  key:      string
  /** Searchable text for this row (name, phone, email, category, …). */
  keywords: string
  /** The already server-rendered row element. */
  node:     ReactNode
}

type Props = {
  rows:        FilterableRow[]
  /** Search input placeholder + aria-label. */
  placeholder?: string
  /** Accessible label for the clear button. */
  clearLabel?:  string
  /** "No results" template — the `{q}` token is replaced with the live query. */
  noResults?:   string
  /**
   * How to wrap the surviving rows so each list keeps its own chrome:
   *  - `'card-list'` → `<Card><ul className={listClassName}>{rows}</ul></Card>`
   *  - `'list'`      → `<ul className={listClassName}>{rows}</ul>` (caller owns the Card)
   *  - `'fragment'`  → rows rendered bare (caller's Card wraps the whole island)
   * Declarative (a string, not a render function) so this stays serialisable
   * across the server→client boundary.
   */
  variant?:    'card-list' | 'list' | 'fragment'
  /** Class for the inner `<ul>` (when `variant` renders one). */
  listClassName?: string
  /** Extra attrs forwarded to the `<ul>` (e.g. data-testid). */
  listProps?:  Record<`data-${string}`, string>
  /** Optional extra classes for the toolbar row holding the search box. */
  toolbarClassName?: string
}

/**
 * FilterableList — a small client island that adds instant, client-side
 * search to an already-loaded list. The list is fully rendered server-side
 * (no new query); this only filters the visible rows by their `keywords`.
 *
 * When the query is empty it renders every row untouched (preserving the
 * server-rendered order). When a query matches nothing it keeps the search
 * chrome and shows a friendly empty state instead of a blank void.
 *
 * All props are serialisable — the row JSX comes in as `ReactNode` (allowed
 * across the server→client boundary); the wrapper shape is described by the
 * `variant` string rather than a render function (functions are not).
 */
export function FilterableList({
  rows,
  placeholder = 'Search…',
  clearLabel = 'Clear search',
  noResults = 'No results for “{q}”',
  variant = 'card-list',
  listClassName = 'divide-y divide-border',
  listProps,
  toolbarClassName,
}: Props) {
  const filter = useListFilter(rows)
  const visibleNodes = rows.filter((r) => filter.isVisible(r.key)).map((r) => r.node)

  let body: ReactNode
  if (filter.isEmpty) {
    body = (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <SearchX aria-hidden="true" className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{noResults.replace('{q}', filter.query.trim())}</p>
      </div>
    )
  } else if (variant === 'fragment') {
    body = <>{visibleNodes}</>
  } else if (variant === 'list') {
    body = <ul className={listClassName} {...listProps}>{visibleNodes}</ul>
  } else {
    body = (
      <Card>
        <ul className={listClassName} {...listProps}>{visibleNodes}</ul>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className={toolbarClassName ?? ''}>
        <ListSearch
          value={filter.query}
          onValueChange={filter.setQuery}
          placeholder={placeholder}
          clearLabel={clearLabel}
        />
      </div>
      {body}
    </div>
  )
}
