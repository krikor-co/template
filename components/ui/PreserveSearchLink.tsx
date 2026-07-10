'use client'

import Link from 'next/link'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { useKeepQs } from '@/lib/flow-params'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  /**
   * Search-param keys to carry onto the destination URL. Page-specific by
   * nature — define the list once per page (e.g.
   * `const KEEP = ['view', 'date', 'page'] as const`) so every site that
   * preserves them stays in lockstep. Keep the param being toggled (e.g. a
   * `?openDrawer=` key) OUT of the list, or closing would re-open it.
   */
  keep: readonly string[]
  children: ReactNode
}

/**
 * Drop-in `<Link>` replacement that appends the current values of `keep`
 * keys to the destination URL. Used for any link that navigates WITHIN a
 * page (e.g. opening a detail drawer via a search-param toggle) and must
 * preserve the page's filter state.
 */
export function PreserveSearchLink({ href, keep, children, ...rest }: Props) {
  const qs = useKeepQs(keep)
  const sep = qs.length === 0 ? '' : href.includes('?') ? '&' : '?'
  return (
    // scroll={false}: these navigate WITHIN the page (open a drawer, step a
    // filter) — Next's default scroll-to-top would yank the user away from
    // the row they just clicked. Overridable via `...rest`.
    <Link href={`${href}${sep}${qs}`} scroll={false} {...rest}>
      {children}
    </Link>
  )
}
