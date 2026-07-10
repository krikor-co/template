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

/**
 * Whether an EXISTING subscription must be managed through the Customer
 * Portal instead of starting a NEW Checkout.
 *
 * Stripe keeps `past_due` / `unpaid` / `incomplete` subscriptions ALIVE on the
 * customer — creating a second subscription Checkout there would stack a
 * duplicate subscription (double-billing once the first recovers). Only a
 * workspace with no live subscription object may start a fresh Checkout:
 * never subscribed (`null` status / no sub id), `canceled`, or
 * `incomplete_expired` (both terminal — Stripe discards the subscription).
 *
 * `active` / `trialing` also return true defensively: the paywall page
 * forwards those home before offering checkout, but a direct action call must
 * not create a second subscription either.
 */
const TERMINAL_STATUSES = new Set(['canceled', 'incomplete_expired'])

export function requiresPortalOverCheckout(
  status: string | null | undefined,
  hasSubscription: boolean,
): boolean {
  return hasSubscription && status != null && !TERMINAL_STATUSES.has(status)
}
