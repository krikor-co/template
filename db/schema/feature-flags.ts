import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Feature-flag overrides — the only persisted state behind the feature system.
 * The catalog of features (keys, labels, roles, defaults) lives in the PURE
 * registry at `lib/features/registry.ts`; this table only stores OVERRIDES of
 * the registry default at one of three scopes:
 *
 *   scope='global'    → platform-wide override   (scope_id NULL)
 *   scope='workspace' → per-workspace override   (scope_id = workspaces.id)
 *   scope='user'      → per-user override        (scope_id = users.id)
 *
 * Resolution is most-specific-wins: user ▸ workspace ▸ global ▸ registry
 * default (see `lib/features/resolve.ts`). A missing row simply means "no
 * override at this scope" — never delete-vs-disable ambiguity.
 *
 * Uniqueness is enforced by two PARTIAL unique indexes (Postgres can't express
 * "unique per feature_key when global, else unique per (scope,scope_id,key)"
 * with a single constraint because scope_id is NULL for global rows):
 *   - one global override per feature_key   (WHERE scope = 'global')
 *   - one scoped override per (scope, scope_id, feature_key) otherwise
 *
 * `scope_id` is intentionally FK-less: it points at workspaces.id OR users.id
 * depending on `scope`, which a single FK cannot express.
 */
export const featureFlag = pgTable(
  'feature_flag',
  {
    id:         integer('id').primaryKey().generatedAlwaysAsIdentity(),
    scope:      text('scope').notNull(),
    /** NULL for global; workspaces.id or users.id otherwise. */
    scopeId:    integer('scope_id'),
    featureKey: text('feature_key').notNull(),
    enabled:    boolean('enabled').notNull(),
    updatedAt:  timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    scopeCheck: check('feature_flag_scope_check', sql`${table.scope} IN ('global', 'workspace', 'user')`),
    globalKeyUnique: uniqueIndex('feature_flag_global_key_unique')
      .on(table.featureKey)
      .where(sql`${table.scope} = 'global'`),
    scopedUnique: uniqueIndex('feature_flag_scoped_unique')
      .on(table.scope, table.scopeId, table.featureKey)
      .where(sql`${table.scope} <> 'global'`),
    scopeLookup: index('feature_flag_scope_lookup').on(table.scope, table.scopeId),
  }),
)

export type FeatureFlag = typeof featureFlag.$inferSelect
export type NewFeatureFlag = typeof featureFlag.$inferInsert
