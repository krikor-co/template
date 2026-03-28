import { integer, pgTable, timestamp } from 'drizzle-orm/pg-core'
import { persons } from './persons'

export const users = pgTable('users', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  personId:  integer('person_id').notNull().references(() => persons.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
