'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from './Toast'
import { refreshTags } from '@/lib/cache/refresh-tags'
import type { RefreshTagName } from '@/lib/cache/refreshable'

/**
 * Where a widget's Refresh button gets its freshness from — one of two modes:
 *   - `{ tags }` — a SERVER cached widget. Invalidate its REFRESHABLE entries,
 *     then `router.refresh()` so the `'use cache'` query re-runs fresh.
 *   - `{ onRefresh }` — a CLIENT-loader widget (the Type-6 pattern). Re-call the
 *     loader; no server action, no `router.refresh()`.
 */
export type WidgetRefreshSource =
  | { tags: RefreshTagName[] }
  | { onRefresh: () => Promise<void> }

/**
 * Drives a widget Refresh button. Hook-only file (Flow invariant) — the
 * `<WidgetRefresh>` component is a pure consumer. Uses an async `useTransition`
 * so `pending` stays true through BOTH the action/loader AND the resulting
 * re-render (the spinner holds until fresh data lands). Toasts on failure.
 */
export function useWidgetRefresh(source: WidgetRefreshSource, errorMessage: string) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  function refresh() {
    if (pending) return
    startTransition(async () => {
      try {
        if ('onRefresh' in source) {
          await source.onRefresh()
        } else {
          const res = await refreshTags(source.tags)
          if (!res.ok) throw new Error('refresh failed')
          router.refresh()
        }
      } catch {
        toast({ message: errorMessage, tone: 'destructive' })
      }
    })
  }

  return { pending, refresh }
}
