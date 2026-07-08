import { integer, pgTable, timestamp, unique, pgEnum } from 'drizzle-orm/pg-core'
import { persons } from './persons'

export const platformRoleEnum = pgEnum('platform_role', ['user', 'admin'])

export const users = pgTable(
  'users',
  {
    id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
    personId:  integer('person_id').notNull().references(() => persons.id),
    role:      platformRoleEnum('role').notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    personIdUnique: unique().on(t.personId),
  })
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
