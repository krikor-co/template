/**
 * Single source of truth for "is this workspace's subscription active?"
 *
 * Active === Stripe status ∈ {'active','trialing'}. EVERYTHING else — null
 * (never subscribed), 'canceled', 'past_due', 'incomplete', 'unpaid', etc. —
 * counts as NOT active and is gated out of the billing-gated (app) area.
 *
 * Both the (app)-layout gate and the subscribe paywall import this so they can
 * never drift to a different definition (which would otherwise reopen the
 * redirect-loop risk).
 */
const ACTIVE_STATUSES = new Set(['active', 'trialing'])

export function isSubscriptionActive(status: string | null | undefined): boolean {
  return status != null && ACTIVE_STATUSES.has(status)
}
