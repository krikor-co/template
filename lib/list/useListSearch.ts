'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Debounced `?q=` search hook for server-paginated LIST pages. Owns the input value plus
 * the 300ms debounce that pushes the query into the URL — the list re-runs
 * server-side (filtered + paginated) and resets to page 1 because the push
 * REPLACES the whole query string (dropping any `?page=`, so a new search
 * resets to page 1). Keeps `components/ui/ListSearchBox.tsx` a pure consumer
 * per the section convention (hooks live in `.ts` files).
 */
export function useListSearch(initialValue?: string) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue ?? '')
  const lastPushed = useRef(initialValue ?? '')

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = value.trim()
      if (next === lastPushed.current.trim()) return
      lastPushed.current = next
      const qs = next.length > 0 ? `?q=${encodeURIComponent(next)}` : ''
      router.push(qs.length > 0 ? qs : '?', { scroll: false })
    }, 300)
    return () => clearTimeout(handle)
  }, [value, router])

  return { value, setValue }
}
