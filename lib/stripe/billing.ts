import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { workspaces } from '@/db/schema'
import { getStripe } from './client'
import { planByPriceId, type PlanTier } from './plans'

/**
 * Core Stripe billing operations for a workspace's subscription. Plain server
 * helpers — route `'use server'` actions wrap these with the workspace-owner
 * guard + map results to route exits. The webhook keeps the workspaces row in
 * sync; these read that row (no Stripe call on the read path).
 */

export type BillingState = {
  plan: PlanTier | null
  status: string | null
  /** ISO timestamp of the current period end, or null. */
  currentPeriodEnd: string | null
  hasSubscription: boolean
  /**
   * Whether the subscription is set to cancel at the end of the current period
   * (Stripe `cancel_at_period_end`). The sub stays active until
   * `currentPeriodEnd`; the webhook then flips `status` to 'canceled'.
   */
  cancelAtPeriodEnd: boolean
}

export async function getBillingState(workspaceId: number): Promise<BillingState> {
  const [row] = await db
    .select({
      plan: workspaces.plan,
      status: workspaces.subscriptionStatus,
      cpe: workspaces.currentPeriodEnd,
      subId: workspaces.stripeSubscriptionId,
      cancelAtPeriodEnd: workspaces.cancelAtPeriodEnd,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  return {
    plan: (row?.plan ?? null) as PlanTier | null,
    status: row?.status ?? null,
    currentPeriodEnd: row?.cpe ? row.cpe.toISOString() : null,
    hasSubscription: Boolean(row?.subId),
    cancelAtPeriodEnd: Boolean(row?.cancelAtPeriodEnd),
  }
}

/**
 * Schedule (or undo) cancellation of the workspace's subscription at the end
 * of the current billing period. Calls Stripe
 * `subscriptions.update(subId, { cancel_at_period_end })` — access is KEPT until
 * `currentPeriodEnd`, then the webhook flips `subscriptionStatus` to 'canceled'.
 *
 * Writes the resulting flag + period end back to the workspaces row immediately
 * (read-your-own-writes; the `customer.subscription.updated` webhook later
 * confirms identical data, last-writer-wins). Idempotent: re-cancelling an
 * already-canceling sub (or re-resuming) is a no-op on Stripe's side.
 *
 * Returns a `no_subscription` sentinel when the workspace has no Stripe
 * subscription to act on (e.g. a seeded/granted plan) — the caller maps it to a
 * graceful message rather than throwing.
 */
export async function setSubscriptionCancellation(input: {
  workspaceId: number
  cancel: boolean
}): Promise<
  | { ok: true; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null }
  | { ok: false; reason: 'no_subscription' }
> {
  const stripe = getStripe()
  const [row] = await db
    .select({ subId: workspaces.stripeSubscriptionId, cpe: workspaces.currentPeriodEnd })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1)
  if (!row?.subId) return { ok: false, reason: 'no_subscription' }

  const sub = await stripe.subscriptions.update(row.subId, {
    cancel_at_period_end: input.cancel,
  })

  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items.data[0]?.current_period_end ??
    null
  const cpe = periodEnd ? new Date(periodEnd * 1000) : row.cpe

  await db
    .update(workspaces)
    .set({
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd: cpe,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, input.workspaceId))

  return {
    ok: true,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: cpe ? cpe.toISOString() : null,
  }
}

/** Find or lazily create the workspace's Stripe customer; returns the customer id. */
async function ensureStripeCustomer(workspaceId: number): Promise<string> {
  const stripe = getStripe()
  const [row] = await db
    .select({ name: workspaces.name, custId: workspaces.stripeCustomerId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)
  if (!row) throw new Error('workspace not found')
  if (row.custId) return row.custId

  const customer = await stripe.customers.create({
    name: row.name ?? undefined,
    metadata: { workspaceId: String(workspaceId) },
  })
  await db
    .update(workspaces)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
  return customer.id
}

/** Create a subscription Checkout session for a price; returns the hosted URL. */
export async function createCheckoutSession(input: {
  workspaceId: number
  priceId: string
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  const stripe = getStripe()
  const customer = await ensureStripeCustomer(input.workspaceId)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { workspaceId: String(input.workspaceId) },
  })
  if (!session.url) throw new Error('checkout session missing url')
  return session.url
}

/** Create a Customer Portal session (manage/cancel/update); returns the URL. */
export async function createPortalSession(input: {
  workspaceId: number
  returnUrl: string
}): Promise<string> {
  const stripe = getStripe()
  const customer = await ensureStripeCustomer(input.workspaceId)
  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: input.returnUrl,
  })
  return session.url
}

/**
 * Post-checkout sync — sidesteps the `customer.subscription.created` webhook
 * race. On the Stripe success_url return, the webhook may not have fired yet,
 * so we RETRIEVE the completed Checkout Session (+ its subscription) directly
 * and write the same fields the webhook would, scoped to this workspace.
 * Idempotent with the webhook (last-writer-wins on identical data).
 *
 * Defensive: validates the session's `metadata.workspaceId` matches the
 * workspace we expect (a checkout session can't be used to mutate a different
 * workspace). On any mismatch / missing subscription it returns the current DB
 * status without writing — the caller can fall back to polling getBillingState.
 *
 * Returns the resulting subscription status (e.g. 'active'), or `null`.
 */
export async function syncWorkspaceFromCheckoutSession(input: {
  workspaceId: number
  sessionId: string
}): Promise<string | null> {
  const stripe = getStripe()

  const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
    expand: ['subscription'],
  })

  // The session must belong to THIS workspace (we set metadata.workspaceId at creation).
  if (session.metadata?.workspaceId && Number(session.metadata.workspaceId) !== input.workspaceId) {
    return getBillingState(input.workspaceId).then((s) => s.status)
  }

  const sub = session.subscription
  if (!sub || typeof sub === 'string') {
    return getBillingState(input.workspaceId).then((s) => s.status)
  }

  const priceId = sub.items.data[0]?.price?.id ?? null
  const plan = planByPriceId(priceId)?.tier ?? null
  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items.data[0]?.current_period_end ??
    null

  await db
    .update(workspaces)
    .set({
      stripeSubscriptionId: sub.id,
      plan,
      subscriptionStatus: sub.status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, input.workspaceId))

  return sub.status
}
