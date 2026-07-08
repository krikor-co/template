import { integer, text, pgTable, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Generic audit trail: who did what to which entity.
 *
 * `workspaceId` is a plain integer for now — the `workspaces` table lands in
 * the tenancy phase, which converts this column to a real FK
 * (`references(() => workspaces.id)`). Nullable on purpose: platform-level
 * actions (e.g. admin role edits) have no workspace scope.
 */
export const auditLog = pgTable('audit_log', {
  id:          integer('id').primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: integer('workspace_id'),
  userId:      integer('user_id').references(() => users.id),
  action:      text('action').notNull(),
  entityType:  text('entity_type').notNull(),
  entityId:    integer('entity_id'),
  details:     jsonb('details'),
  ipAddress:   text('ip_address'),
  userAgent:   text('user_agent'),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type AuditLog = typeof auditLog.$inferSelect
export type NewAuditLog = typeof auditLog.$inferInsert
