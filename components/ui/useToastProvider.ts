import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToastInput, ToastItem } from './Toast'

/**
 * Hook logic for {@link ToastProvider} (HOOK-1: hooks live in a companion
 * `useXxx.ts`, not inline in the component body). Owns the toast queue, the
 * auto-dismiss timers, and the unmount cleanup; the provider component is left
 * as pure presentation over `{ items, toast, dismiss }`. Behavior is identical
 * to the previous inline version.
 */
export function useToastProvider() {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id))
    const tm = timers.current.get(id)
    if (tm) { clearTimeout(tm); timers.current.delete(id) }
  }, [])

  const toast = useCallback((input: ToastInput) => {
    const id = nextId.current++
    setItems((cur) => [...cur, { ...input, id }])
    const duration = input.duration ?? 5000
    if (duration > 0) {
      timers.current.set(id, setTimeout(() => dismiss(id), duration))
    }
  }, [dismiss])

  useEffect(() => {
    const map = timers.current
    return () => { map.forEach(clearTimeout); map.clear() }
  }, [])

  return { items, toast, dismiss }
}

/**
 * One-shot enter-animation flag for a {@link ToastItem} card — flips true after
 * the first paint so the card transitions in. Extracted per HOOK-1.
 */
export function useToastEnterAnimation() {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(r)
  }, [])
  return entered
}
