import { Effect, pipe } from 'effect'
import { getBillingState } from './billing'
import { isSubscriptionActive } from './active'
import { isStripeConfigured } from './client'
import { DbError, SubscriptionInactive } from '@/lib/effect/errors'

/**
 * Effect-flavored subscription gate — action-level defense-in-depth.
 *
 * The `(app)` layout is the primary chokepoint, but a stale client or a direct
 * server-action call could still reach a mutation after a workspace's plan
 * lapses. Tap this in the workspace's MAIN write actions so a paused workspace
 * fails CLOSED with a typed `SubscriptionInactive` the boundary maps to clear
 * "subscription inactive" copy.
 *
 * Active === Stripe status ∈ {active,trialing} (single source of truth in
 * `isSubscriptionActive`). A billing-read failure surfaces as `DbError`
 * (generic fallback copy) rather than a misleading "inactive" message.
 *
 * FAIL-OPEN when Stripe is not configured (no STRIPE_SECRET_KEY): an app
 * without billing has no subscription concept — the gate is inert, exactly
 * like the `(app)` layout gate. Configure Stripe and both gates activate.
 */
export const requireActiveSubscriptionE = (
  workspaceId: number,
): Effect.Effect<void, SubscriptionInactive | DbError> =>
  isStripeConfigured()
    ? pipe(
        Effect.tryPromise({
          try:   () => getBillingState(workspaceId),
          catch: (cause) => new DbError({ cause }),
        }),
        Effect.filterOrFail(
          (billing) => isSubscriptionActive(billing.status),
          () => new SubscriptionInactive({ workspaceId }),
        ),
        Effect.asVoid,
      )
    : Effect.void
