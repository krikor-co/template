import { sql } from 'drizzle-orm'
import { integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * The tenant. Everything tenant-scoped hangs off `workspaces.id`
 * (memberships, invites, feature-flag overrides, audit/trace rows).
 * Deliberately minimal — apps add their own business columns.
 */
export const workspaces = pgTable(
  'workspaces',
  {
    id:   integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    /**
     * Subdomain slug (e.g. "acme" → acme.<APP_BASE_DOMAIN>). Nullable until
     * claimed; unique among non-null values (partial index below). Powers the
     * host-resolution middleware (lib/tenant/resolve-host.ts).
     */
    slug:      text('slug'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    slugUnique: uniqueIndex('workspaces_slug_unique').on(t.slug).where(sql`${t.slug} IS NOT NULL`),
  }),
)

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
