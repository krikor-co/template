import { pgTable, text, timestamp, boolean, integer, index } from 'drizzle-orm/pg-core'

export const otpCodes = pgTable(
  'otp_codes',
  {
    id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
    email:     text('email').notNull(),
    code:      text('code').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    used:      boolean('used').notNull().default(false),
    attempts:  integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    emailIdx:     index('otp_codes_email_idx').on(t.email),
    expiresAtIdx: index('otp_codes_expires_at_idx').on(t.expiresAt),
  })
)
