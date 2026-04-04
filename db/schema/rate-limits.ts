import { integer, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'

export const rateLimits = pgTable('rate_limits', {
  id:          integer('id').primaryKey().generatedAlwaysAsIdentity(),
  key:         text('key').notNull(),
  action:      text('action').notNull(),
  count:       integer('count').notNull().default(1),
  windowStart: timestamp('window_start').defaultNow().notNull(),
}, (t) => ({
  lookupIdx: index('rate_limits_key_action_idx').on(t.key, t.action),
}))

export type RateLimit = typeof rateLimits.$inferSelect
