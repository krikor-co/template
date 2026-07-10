import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { workspaces } from '@/db/schema'
import { stripe } from '@/lib/stripe/client'
import { planByPriceId } from '@/lib/stripe/plans'

/**
 * Stripe webhook — syncs the workspace's subscription state into the `workspaces` row so
 * the app reads its own DB rather than calling Stripe on every page load.
 *
 * Public endpoint (no session): it MUST live under /api (outside the workspace
 * layout guards) and is authenticated by Stripe's signature, verified against
 * STRIPE_WEBHOOK_SECRET. Test mode for now.
 *
 * Local dev: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) {
    return NextResponse.json({ ok: false, error: 'stripe not configured' }, { status: 503 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ ok: false, error: 'missing signature' }, { status: 400 })
  }

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid signature'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object as Stripe.Subscription)
        break
      }
      default:
        // ignore the long tail of events we don't model
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'handler error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, received: event.type })
}

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const deleted = sub.status === 'canceled'

  const priceId = sub.items.data[0]?.price?.id ?? null
  const plan = planByPriceId(priceId)?.tier ?? null
  // current_period_end is unix seconds at the subscription (or item) level.
  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items.data[0]?.current_period_end ??
    null

  await db
    .update(workspaces)
    .set({
      stripeSubscriptionId: deleted ? null : sub.id,
      plan: deleted ? null : plan,
      subscriptionStatus: sub.status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: deleted ? false : sub.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.stripeCustomerId, customerId))
}
