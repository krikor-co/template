'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { withFrom } from '@/lib/flow-params'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href:     string
  children: ReactNode
}

/**
 * Drop-in `<Link>` replacement that appends `?from=<currentLocation>` so
 * the destination's `<ContextualBackLink>` can return the user to the
 * exact list state they came from (filters + pagination intact).
 *
 * Use this for row-clicks on list pages where the destination is its own
 * page (detail / edit). Apps that render entity names as inline links can
 * build their own entity-link primitives on top of `withFrom` — same
 * mechanism, typography of their choosing.
 *
 * The `?from=` only sticks on links built via this component. Every other
 * navigator naturally drops it — see `lib/flow-params.ts`.
 */
export function OriginLink({ href, children, ...rest }: Props) {
  const pathname = usePathname() ?? ''
  const search   = useSearchParams()
  const current = (() => {
    if (!search) return pathname
    const next = new URLSearchParams(search.toString())
    next.delete('from')
    const qs = next.toString()
    return qs ? `${pathname}?${qs}` : pathname
  })()
  return (
    <Link href={withFrom(href, current)} {...rest}>
      {children}
    </Link>
  )
}
