import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useScrollLock } from '@/lib/hooks/useScrollLock'
import type { CommandGroup, CommandItem } from './SearchCommand'

/**
 * Hook logic for {@link SearchCommand} (HOOK-1: hooks live in a companion
 * `useXxx.ts`, not inline in the component body). Owns the open/query/active
 * state, the ⌘F + external-bus + focus effects, the flatten/filter memo, and
 * the keyboard-nav handlers; the component is left as pure presentation over the
 * returned bag. Behavior is identical to the previous inline version.
 */
export function useSearchCommand(opts: {
  groups: CommandGroup[]
  serverDriven: boolean
  onQueryChange?: (q: string) => void
  subscribeOpen?: (open: () => void) => () => void
  onSubmitQuery?: (query: string, hasRealResult: boolean) => boolean
}) {
  const { groups, serverDriven, onQueryChange, subscribeOpen, onSubmitQuery } = opts

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  // Lock body scroll while the command palette overlay is open.
  useScrollLock(open)

  // Keep the latest `onQueryChange` in a ref so the ⌘F / bus effects don't have
  // to resubscribe when the host passes a fresh callback identity each render.
  // Assigned in an effect (not during render) per the react-hooks/refs rule.
  const onQueryChangeRef = useRef(onQueryChange)
  useEffect(() => { onQueryChangeRef.current = onQueryChange })

  // Global ⌘F / Ctrl+F to open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setQuery('')
        setActiveIndex(0)
        setOpen(true)
        onQueryChangeRef.current?.('')
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // External open signal (the sidebar rail pill via the search bus).
  useEffect(() => {
    if (!subscribeOpen) return
    return subscribeOpen(() => {
      setQuery('')
      setActiveIndex(0)
      setOpen(true)
      onQueryChangeRef.current?.('')
    })
  }, [subscribeOpen])

  // Focus the input after the overlay paints.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  function openPalette() {
    setQuery('')
    setActiveIndex(0)
    setOpen(true)
    onQueryChangeRef.current?.('')
  }

  // Flatten + filter; keep group boundaries for rendering. In `serverDriven`
  // mode the host already filtered the hits, so we pass them through verbatim
  // (only flattening for keyboard nav) — no double client-side narrowing.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const flat: CommandItem[] = []
    const view = groups
      .map((g) => {
        const items = g.items.filter((it) =>
          serverDriven || !q
            ? true
            : `${it.label} ${it.hint ?? ''} ${it.keywords ?? ''}`.toLowerCase().includes(q),
        )
        items.forEach((it) => flat.push(it))
        return { heading: g.heading, items }
      })
      .filter((g) => g.items.length > 0)
    return { view, flat }
  }, [groups, query, serverDriven])

  function move(delta: number) {
    const n = filtered.flat.length
    if (n === 0) return
    setActiveIndex((i) => (i + delta + n) % n)
  }

  function runItem(it: CommandItem) {
    it.onSelect?.()
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const q = query.trim()
      // Give the host first refusal on the submit: when inline answers are on and
      // nothing strong matched, it runs the assistant here and marks it handled,
      // so we must NOT also navigate to whatever happens to be highlighted.
      if (onSubmitQuery && q) {
        const hasRealResult = filtered.flat.some((it) => !it.pinned)
        if (onSubmitQuery(q, hasRealResult)) return
      }
      const it = filtered.flat[activeIndex]
      if (it) {
        if (it.href) window.location.assign(it.href)
        else runItem(it)
      }
    }
  }

  function onInputChange(value: string) {
    setQuery(value)
    setActiveIndex(0)
    onQueryChange?.(value)
  }

  const activeId = filtered.flat[activeIndex]
    ? `${listId}-opt-${filtered.flat[activeIndex].id}`
    : undefined

  return {
    open, setOpen, query, activeIndex, setActiveIndex,
    inputRef, listId, filtered, activeId,
    openPalette, onKeyDown, runItem, onInputChange,
  }
}
