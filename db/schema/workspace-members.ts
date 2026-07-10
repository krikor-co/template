import { integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'

/**
 * Workspace membership. `role` is TEXT (not a pg enum) so apps can extend the
 * role vocabulary without a migration. The template seeds 'owner' | 'member'
 * (see WORKSPACE_ROLES in lib/invite/roles.ts); guards take the required
 * role(s) as parameters, so new roles need no schema change.
 */
export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id:          integer('id').primaryKey().generatedAlwaysAsIdentity(),
    workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
    userId:      integer('user_id').notNull().references(() => users.id),
    role:        text('role').notNull(),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt:   timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    workspaceUserUnique: unique().on(t.workspaceId, t.userId),
  }),
)

export type WorkspaceMember = typeof workspaceMembers.$inferSelect
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert
