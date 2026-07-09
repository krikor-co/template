'use client'

import Link from 'next/link'
import { useReturnTo } from '@/lib/flow-params'
import { BackLink } from './BackLink'

/**
 * Renders the canonical `<BackLink>` (always) AND a contextual back link
 * (when `?from=` resolves to a valid in-app path).
 *
 * The canonical link is the page's "go up to my parent" affordance and is
 * never hidden — users always have it as their stable mental model. The
 * contextual link appears only when:
 *
 *   - `?from=` is present, in-app, and (when `prefix` is given) inside it
 *   - it is not the same as the canonical `fallbackHref` (no duplicate)
 *   - it is not the current pathname (no self-loop)
 *
 * If you want the canonical-only behavior anywhere, just keep using
 * `<BackLink>` directly. Adopt this wrapper everywhere a flow can land you
 * coming from another flow's row (most detail pages).
 */
export function ContextualBackLink(props: {
  fallbackHref:  string
  fallbackLabel: string
  /** Label for the contextual back. Defaults to English; pass a translated string. */
  contextualLabel?: string
  /** Restrict which `?from=` values are honoured (e.g. `'/dashboard'`). */
  prefix?: string
}) {
  const returnTo = useReturnTo({ fallback: props.fallbackHref, prefix: props.prefix })

  return (
    <div className="mb-4 flex items-center gap-3">
      {returnTo && (
        <Link
          href={returnTo}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          <span aria-hidden="true">←</span>
          <span>{props.contextualLabel ?? 'Back to where you came from'}</span>
        </Link>
      )}
      <BackLink href={props.fallbackHref} label={props.fallbackLabel} className="" />
    </div>
  )
}
