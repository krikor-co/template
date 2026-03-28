import { integer, pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { users } from './users'

export const sessions = pgTable('sessions', {
  id:                integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId:            integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:             text('token').notNull().unique(),
  expiresAt:         timestamp('expires_at').notNull(),
  userAgent:         text('user_agent'),
  ipAddress:         text('ip_address'),
  forceDeactivation: boolean('force_deactivation').notNull().default(false),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
  lastActiveAt:      timestamp('last_active_at').defaultNow().notNull(),
})

export type Session = typeof sessions.$inferSelect
