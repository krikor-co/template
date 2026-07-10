import { sql } from 'drizzle-orm'
import { boolean, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * The tenant. Everything tenant-scoped hangs off `workspaces.id`
 * (memberships, invites, feature-flag overrides, audit/trace rows).
 * Deliberately minimal — apps add their own business columns.
 */
export const workspaces = pgTable(
  'workspaces',
  {
    id:   integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    /**
     * Subdomain slug (e.g. "acme" → acme.<APP_BASE_DOMAIN>). Nullable until
     * claimed; unique among non-null values (partial index below). Powers the
     * host-resolution middleware (lib/tenant/resolve-host.ts).
     */
    slug:      text('slug'),
    /**
     * Stripe SaaS billing (the workspace's subscription to THIS app — synced by
     * the webhook + post-checkout sync; the app reads its own row, never Stripe,
     * on the read path):
     *   plan               → 'basic' | 'pro' | 'premium' (null = no subscription)
     *   subscriptionStatus → Stripe status ('active' | 'trialing' | 'past_due' |
     *                        'canceled' | …); active gate = status ∈ {active,trialing}
     */
    stripeCustomerId:     text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    plan:                 text('plan'),
    subscriptionStatus:   text('subscription_status'),
    currentPeriodEnd:     timestamp('current_period_end', { withTimezone: true }),
    /**
     * Whether the subscription is set to cancel at the end of the current period
     * (Stripe `cancel_at_period_end`). The sub stays `active` until
     * `currentPeriodEnd`, then the webhook flips `subscriptionStatus` to
     * 'canceled'. Synced from Stripe.
     */
    cancelAtPeriodEnd:    boolean('cancel_at_period_end').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    slugUnique: uniqueIndex('workspaces_slug_unique').on(t.slug).where(sql`${t.slug} IS NOT NULL`),
  }),
)

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
