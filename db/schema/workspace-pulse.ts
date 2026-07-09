import { integer, bigint, text, pgTable, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

/**
 * Per-workspace liveness counter (see docs/realtime.md). Mutations that other
 * open sessions should see bump `version` (+ a short `lastEvent` label). The
 * SSE endpoint (app/api/workspace/[workspaceId]/stream) polls this row and
 * streams an event when the version changes; open dashboards then re-run
 * their OWN scoped queries (the auth wall holds — the event carries no
 * payload, just the nudge). Cache tags still handle request-time freshness;
 * this handles in-session liveness.
 */
export const workspacePulse = pgTable('workspace_pulse', {
  workspaceId: integer('workspace_id').primaryKey().references(() => workspaces.id),
  version:     bigint('version', { mode: 'number' }).notNull().default(0),
  lastEvent:   text('last_event'),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
