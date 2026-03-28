import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const persons = pgTable('persons', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email:     text('email').notNull().unique(),
  name:      text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Person = typeof persons.$inferSelect
export type NewPerson = typeof persons.$inferInsert
