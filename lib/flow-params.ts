'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { isSafeInternalPath } from './return-to'

/**
 * Inter-flow navigation hooks built around a single `?from=` query param.
 *
 * Lifecycle of `?from` (full write-up: docs/flow-params.md):
 *   - Birth   : an `<OriginLink>` (or any opt-in navigator) appends
 *               `?from=<currentPathnameAndSearch>` when the user follows it.
 *   - Use     : the destination calls `useReturnTo({ fallback })` to get a
 *               contextual back href. The hook validates the param so a
 *               malicious or stale value can't be honoured.
 *   - Drop    : every other navigator omits the param naturally — nav
 *               links, canonical back, route exits, etc. Pages that complete
 *               a flow in place (e.g. inline save, no navigation) call
 *               `useDropFlowParam('from')` to scrub it without navigating.
 *
 * Convention: only the origin-link primitives emit `?from`. Custom hand-
 * written links should not — they bypass the lifecycle.
 *
 * Why only one slot, not a stack: in practice, "back to where I came from"
 * is one level deep. A stack would spread state and increase pruning rules
 * for marginal gain. The user can chain navigations and still go back via
 * the canonical BackLink; only the immediate hop is contextual.
 */

const FLOW_PARAM = 'from'

/**
 * Build the `?from=` href emitted by origin-link primitives.
 *
 * - `target`  : the destination href (e.g. `/dashboard/people/2`).
 * - `current` : the current pathname + search (where the user is leaving from).
 *
 * If `target` already has a `?from`, we leave it alone — explicit beats
 * implicit, and overwriting would let nested links accidentally lose state.
 */
export function withFrom(target: string, current: string): string {
  if (!current) return target
  // If target already encodes a `from`, don't override it.
  const [path, query = ''] = target.split('?')
  const params = new URLSearchParams(query)
  if (params.has(FLOW_PARAM)) return target
  params.set(FLOW_PARAM, current)
  return `${path}?${params.toString()}`
}

/**
 * Pure validation core of `useReturnTo` — exported for unit tests and for
 * server-side reuse. Rules (any failure → `null`, caller falls back):
 *   - param must be present and non-empty
 *   - must be an in-app path per `isSafeInternalPath` (lib/return-to.ts):
 *     starts with `/` but not `//`, and contains no backslash / control
 *     chars — blocks absolute, protocol-relative, and WHATWG-parser-bypass
 *     variants like `/\evil.com` or `/<TAB>/evil.com` (open-redirect guard)
 *   - when `prefix` is given, must start with it (area scoping — a
 *     workspace-scoped app passes its workspace route prefix)
 *   - must not be the same as `fallback` (avoid duplicating canonical back)
 *   - must not equal the current pathname (no self-loop)
 */
export function resolveReturnTo(
  raw: string | null,
  opts: { fallback: string; pathname: string; prefix?: string },
): string | null {
  if (!raw) return null
  if (!isSafeInternalPath(raw)) return null
  if (opts.prefix && !raw.startsWith(opts.prefix)) return null
  if (raw === opts.fallback) return null
  if (raw === opts.pathname) return null
  return raw
}

/**
 * Resolve the contextual return href for the current page. See
 * `resolveReturnTo` for the validation rules.
 */
export function useReturnTo(opts: { fallback: string; prefix?: string }): string | null {
  const search   = useSearchParams()
  const pathname = usePathname() ?? ''

  const raw = search?.get(FLOW_PARAM) ?? null
  return resolveReturnTo(raw, { fallback: opts.fallback, pathname, prefix: opts.prefix })
}

/**
 * Strip a flow param from the URL in place — no navigation, no scroll.
 *
 * Use when a flow completes on the same page (e.g. an inline save) and the
 * `?from=` would otherwise stick around polluting future shares / refreshes.
 *
 * Defaults to `from` so call sites read as `useDropFlowParam()()`.
 */
export function useDropFlowParam(param: string = FLOW_PARAM): () => void {
  const router   = useRouter()
  const pathname = usePathname()
  const search   = useSearchParams()
  return useCallback(() => {
    if (!search?.has(param)) return
    const next = new URLSearchParams(search.toString())
    next.delete(param)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, search, param])
}

/**
 * Reads the current search params and returns a `key=value&…` fragment
 * containing only `keys`. Empty string when none are set, so callers can
 * simply concatenate without worrying about leading separators.
 *
 * The key list is page-specific by nature (e.g. a calendar page keeps
 * `['view', 'date', 'page']` across its drawer-open/close transitions) —
 * each page passes its own. Params these helpers are setting or dropping
 * (like the drawer-toggle param itself) must stay OUT of the list, or
 * preserving them would defeat the close behavior.
 */
export function useKeepQs(keys: readonly string[]): string {
  const sp = useSearchParams()
  const parts: string[] = []
  for (const k of keys) {
    const v = sp?.get(k)
    if (v) parts.push(`${k}=${encodeURIComponent(v)}`)
  }
  return parts.join('&')
}
