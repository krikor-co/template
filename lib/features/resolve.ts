import 'server-only'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { featureFlag } from '@/db/schema'
import { FEATURE_REGISTRY, getFeature } from './registry'
import { applyOverrides } from './precedence'

/** The three override scopes, narrowing the persisted `feature_flag.scope` column. */
export type FeatureScope = 'global' | 'workspace' | 'user'

/** Resolution context — which workspace / user is asking. Both optional. */
export type FeatureContext = { workspaceId?: number; userId?: number }

/** Snapshot of registry defaults — the safe answer when the DB read fails. */
function registryDefaults(): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const f of FEATURE_REGISTRY) out[f.key] = f.defaultEnabled
  return out
}

/**
 * Resolve EVERY registry key to an effective boolean for the given context.
 *
 * Precedence is most-specific-wins:
 *   user override ▸ workspace override ▸ global override ▸ registry defaultEnabled
 *
 * ONE query fetches all relevant override rows; precedence is applied in JS
 * (`applyOverrides`) so the DB never has to express the layering. On any DB
 * error we log and fall back to the full set of registry defaults — this
 * function never throws.
 */
export async function resolveFeatureFlags(ctx: FeatureContext): Promise<Record<string, boolean>> {
  const defaults = registryDefaults()

  // Build the OR of scope predicates: always global, plus workspace/user when present.
  const conds = [eq(featureFlag.scope, 'global')]
  if (ctx.workspaceId != null) {
    conds.push(and(eq(featureFlag.scope, 'workspace'), eq(featureFlag.scopeId, ctx.workspaceId))!)
  }
  if (ctx.userId != null) {
    conds.push(and(eq(featureFlag.scope, 'user'), eq(featureFlag.scopeId, ctx.userId))!)
  }

  let rows: { scope: string; featureKey: string; enabled: boolean }[]
  try {
    rows = await db
      .select({
        scope:      featureFlag.scope,
        featureKey: featureFlag.featureKey,
        enabled:    featureFlag.enabled,
      })
      .from(featureFlag)
      .where(or(...conds))
  } catch (err) {
    console.error('[features] resolveFeatureFlags DB read failed; using registry defaults', err)
    return defaults
  }

  return applyOverrides(defaults, rows)
}

/** Resolve a single feature key for a context. Unknown keys resolve to `false`. */
export async function isFeatureEnabled(key: string, ctx: FeatureContext): Promise<boolean> {
  const flags = await resolveFeatureFlags(ctx)
  if (key in flags) return flags[key]
  return getFeature(key)?.defaultEnabled ?? false
}

/**
 * Upsert an override at the given scope onto the matching partial unique index.
 * Global rows always store `scope_id = NULL`. Setting a flag never clears it —
 * use `clearFeatureFlag` to remove an override and fall back to a broader scope.
 */
export async function setFeatureFlag(input: {
  scope: FeatureScope
  scopeId?: number | null
  featureKey: string
  enabled: boolean
}): Promise<void> {
  const { scope, featureKey, enabled } = input

  if (scope === 'global') {
    await db
      .insert(featureFlag)
      .values({ scope, scopeId: null, featureKey, enabled })
      .onConflictDoUpdate({
        target: featureFlag.featureKey,
        targetWhere: sql`${featureFlag.scope} = 'global'`,
        set: { enabled, updatedAt: sql`now()` },
      })
    return
  }

  await db
    .insert(featureFlag)
    .values({ scope, scopeId: input.scopeId ?? null, featureKey, enabled })
    .onConflictDoUpdate({
      target: [featureFlag.scope, featureFlag.scopeId, featureFlag.featureKey],
      targetWhere: sql`${featureFlag.scope} <> 'global'`,
      set: { enabled, updatedAt: sql`now()` },
    })
}

/** Remove an override row, restoring fall-through to the next-broader scope / registry default. */
export async function clearFeatureFlag(input: {
  scope: FeatureScope
  scopeId?: number | null
  featureKey: string
}): Promise<void> {
  const { scope, featureKey } = input
  const conds = [eq(featureFlag.scope, scope), eq(featureFlag.featureKey, featureKey)]
  if (scope === 'global') {
    conds.push(isNull(featureFlag.scopeId))
  } else {
    conds.push(eq(featureFlag.scopeId, input.scopeId ?? -1))
  }
  await db.delete(featureFlag).where(and(...conds))
}
