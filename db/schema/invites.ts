import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'

/**
 * Team invite. A workspace owner invites someone (by email) to join a
 * workspace in a given role. The invitee opens `/invite/<token>` and accepts —
 * which provisions their `workspace_members` row and signs them in
 * (magic-link accept: the token IS the credential).
 *
 * `token` is a `crypto.randomUUID()` and is the only credential needed to
 * view/accept the invite, so it is unique. `status` walks
 * pending → accepted | revoked | expired. An invite is also treated as
 * expired once `expiresAt < now()` regardless of the stored status.
 * SINGLE-USE: the accept transaction flips status to 'accepted' guarded by
 * `status = 'pending'`, so a second accept finds no pending row.
 *
 * `role` is TEXT mirroring `workspace_members.role` (app-extensible union;
 * template seeds 'owner' | 'member' — see lib/invite/roles.ts).
 */
export const invites = pgTable('invites', {
  id:              integer('id').primaryKey().generatedAlwaysAsIdentity(),
  workspaceId:     integer('workspace_id').notNull().references(() => workspaces.id),
  email:           text('email').notNull(),
  role:            text('role').notNull(),
  token:           text('token').notNull().unique(),
  status:          text('status').notNull().default('pending'), // pending | accepted | revoked | expired
  invitedByUserId: integer('invited_by_user_id').notNull().references(() => users.id),
  expiresAt:       timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt:      timestamp('accepted_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Invite = typeof invites.$inferSelect
export type NewInvite = typeof invites.$inferInsert
