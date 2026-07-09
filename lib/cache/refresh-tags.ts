'use server'

import { getSession } from '@/lib/auth/session'
import { REFRESHABLE, type RefreshTagName } from './refreshable'

/**
 * User-triggered cache refresh for dashboard widgets.
 *
 * A widget's <WidgetRefresh> hands over the REFRESHABLE names its `'use cache'`
 * query is registered under; this invalidates them (`updateTag` —
 * read-your-own-writes) so the client's subsequent `router.refresh()` re-renders
 * the widget against FRESH data (a bare `router.refresh()` alone would serve the
 * cached snapshot).
 *
 * Session-gated. Unknown names are ignored defensively (the typed
 * `RefreshTagName` union already constrains callers). Passing `[]` is a valid
 * no-op. When a registered widget is workspace-scoped, tighten its entry's
 * auth by checking membership here (requireWorkspaceRole, phase 6+).
 */
export async function refreshTags(tags: RefreshTagName[]): Promise<{ ok: boolean }> {
  const session = await getSession()
  if (!session) return { ok: false }
  const registry: Record<string, (() => void) | undefined> = REFRESHABLE
  for (const name of tags) registry[name]?.()
  return { ok: true }
}
