import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Custom OTel span storage — every `Effect.withSpan(...)` boundary call
 * ends up here via `lib/effect/db-span-exporter.ts`.
 *
 * Indexed for common queries:
 *   - "what's slow right now"          → (name, created_at)
 *   - "what's failing in workspace X"  → (workspace_id, created_at)
 *   - "recent activity"                → (created_at DESC)
 *
 * workspace_id / user_id are denormalized from span attributes for fast
 * filtering. BOTH stay plain nullable integers on purpose — no FK: spans are
 * observation infrastructure and must never be rejected by referential
 * integrity. The `workspaceId` attribute is stamped at the boundary from RAW
 * caller input before validation, so a single span carrying a nonexistent id
 * would FK-abort the exporter's whole batch INSERT and silently drop every
 * span in it (the exporter fails open by design). Same rationale as user_id:
 * spans must also survive row deletion of what they reference. Purge old rows
 * with a retention cron. If error volume grows, add a partial index on
 * status = 'error' via custom SQL.
 */
export const traceSpan = pgTable('trace_span', {
  spanId:       text('span_id').primaryKey(),
  traceId:      text('trace_id').notNull(),
  parentSpanId: text('parent_span_id'),
  name:         text('name').notNull(),
  startTs:      timestamp('start_ts', { withTimezone: true }).notNull(),
  durationMs:   integer('duration_ms').notNull(),
  status:       text('status').notNull(),        // 'ok' | 'error' | 'unset'
  attributes:   jsonb('attributes').notNull().default({}),
  errorMessage: text('error_message'),
  workspaceId:  integer('workspace_id'),         // denormalized from attributes for fast tenant filtering — deliberately NO FK (see above)
  userId:       integer('user_id'),              // denormalized from attributes — WHO acted
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('trace_span_created_at_idx').on(t.createdAt),
  index('trace_span_workspace_created_at_idx').on(t.workspaceId, t.createdAt),
  index('trace_span_name_created_at_idx').on(t.name, t.createdAt),
  index('trace_span_user_created_at_idx').on(t.userId, t.createdAt),
  index('trace_span_trace_id_idx').on(t.traceId),
])

export type TraceSpan = typeof traceSpan.$inferSelect
