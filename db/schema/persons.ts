import { integer, pgTable, text, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const persons = pgTable(
  'persons',
  {
    id:            integer('id').primaryKey().generatedAlwaysAsIdentity(),
    /**
     * Nullable natural keys: a person signs up with email OR phone (dual-
     * identifier auth), so each is optional. Uniqueness is enforced by the
     * partial unique indexes below (`WHERE ... IS NOT NULL`) — the template
     * pattern for optional natural keys (see docs/schema.md).
     */
    email:         text('email'),
    /**
     * Durable "this inbox was proven" marker for flows that need it beyond
     * the session itself (e.g. an emailed invite accepted → true). Plain OTP
     * login doesn't persist it — the minted session is its own proof.
     */
    emailVerified: boolean('email_verified').notNull().default(false),
    /** E.164-ish (+digits) — normalized by lib/auth/identifier normalizePhone. */
    phoneNumber:   text('phone_number'),
    name:          text('name'),
    // UI language for this person ('en' | 'pt-BR' — see lib/i18n/types.ts).
    // Middle link of the authed locale chain: app.locale cookie → persons.locale → DEFAULT_LOCALE.
    locale:        text('locale').notNull().default('en'),
    createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:     timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailUnique: uniqueIndex('persons_email_unique').on(t.email).where(sql`${t.email} IS NOT NULL`),
    phoneUnique: uniqueIndex('persons_phone_unique').on(t.phoneNumber).where(sql`${t.phoneNumber} IS NOT NULL`),
  })
)

export type Person = typeof persons.$inferSelect
export type NewPerson = typeof persons.$inferInsert
