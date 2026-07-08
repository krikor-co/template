import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const persons = pgTable('persons', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email:     text('email').notNull().unique(),
  name:      text('name'),
  /**
   * BCP-47 tag for this person's preferred UI language (e.g. 'en', 'pt-BR').
   * Read by getCurrentLocale() as the authed fallback below the app.locale
   * cookie. Keep the default in sync with DEFAULT_LOCALE in lib/i18n/types.ts.
   */
  locale:    text('locale').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Person = typeof persons.$inferSelect
export type NewPerson = typeof persons.$inferInsert
