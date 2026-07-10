'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Drives the ListPager footer: wraps `router.push` in a transition so the
 * existing rows stay on screen (dimmed) while the next page streams in. Keeps
 * the hook logic out of the component body.
 */
export function useListPager() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const go = (href: string | null) => {
    if (!href) return
    // `scroll: false` keeps the viewport in place — the pager sits at the
    // bottom, so the default scroll-to-top would force a scroll-back each click.
    startTransition(() => router.push(href, { scroll: false }))
  }

  return { isPending, go }
}
