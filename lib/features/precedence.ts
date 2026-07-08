/**
 * Pure precedence math for feature-flag resolution — most-specific-wins:
 *   user ▸ workspace ▸ global ▸ registry default.
 * Kept free of db/server imports so it can be unit-tested directly;
 * `lib/features/resolve.ts` (server-only) feeds it the override rows.
 */
export type FlagScope = 'global' | 'workspace' | 'user'

export type OverrideRow = { scope: string; featureKey: string; enabled: boolean }

export function applyOverrides(
  defaults: Record<string, boolean>,
  rows: OverrideRow[],
): Record<string, boolean> {
  const result = { ...defaults }

  // Bucket overrides by scope, then apply least- → most-specific so the most
  // specific present override wins for each key.
  const byScope: Record<FlagScope, Record<string, boolean>> = { global: {}, workspace: {}, user: {} }
  for (const r of rows) {
    if (r.scope === 'global' || r.scope === 'workspace' || r.scope === 'user') {
      byScope[r.scope][r.featureKey] = r.enabled
    }
  }

  for (const k of Object.keys(defaults)) {
    if (k in byScope.global) result[k] = byScope.global[k]
    if (k in byScope.workspace) result[k] = byScope.workspace[k]
    if (k in byScope.user) result[k] = byScope.user[k]
  }

  return result
}
