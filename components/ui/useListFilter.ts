'use client'

import { useMemo, useState } from 'react'
import { matchesQuery } from '@/lib/list/normalize'

/** One filterable entry: an opaque key + the text its row is searched on. */
export type FilterEntry = { key: string; keywords: string }

/**
 * Client-side instant filter for an already-loaded list. Owns the query
 * string and derives the set of matching keys (accent/case-insensitive,
 * token-AND). Returns the visible-key set so the caller can show/hide its
 * server-rendered rows without re-fetching.
 *
 * Per the hooks rule, all `useState`/`useMemo` lives here — `ListSearch` and
 * the filtering island stay pure consumers.
 */
export function useListFilter(entries: FilterEntry[]) {
  const [query, setQuery] = useState('')

  const visibleKeys = useMemo(() => {
    const trimmed = query.trim()
    if (trimmed.length === 0) return null // null = "no filter, show everything"
    const next = new Set<string>()
    for (const e of entries) {
      if (matchesQuery(e.keywords, trimmed)) next.add(e.key)
    }
    return next
  }, [entries, query])

  const trimmed = query.trim()
  const isFiltering = trimmed.length > 0
  const matchCount = visibleKeys ? visibleKeys.size : entries.length
  const isEmpty = isFiltering && matchCount === 0

  /** Whether a given row key should be visible under the current query. */
  const isVisible = (key: string) => visibleKeys === null || visibleKeys.has(key)

  return {
    query,
    setQuery,
    clear: () => setQuery(''),
    isFiltering,
    isEmpty,
    matchCount,
    isVisible,
  }
}
