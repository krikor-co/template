import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getBillingState, syncWorkspaceFromCheckoutSession } from '@/lib/stripe/billing'
import { isSubscriptionActive } from '@/lib/stripe/active'
import { isStripeConfigured } from '@/lib/stripe/client'
import { route } from './contract'
import { CheckoutSuccess } from './_sections/CheckoutSuccess/Component'

type Props = {
  params:       Promise<{ workspaceId: string }>
  searchParams: Promise<{ session_id?: string }>
}

/**
 * SUBSCRIBE / SUCCESS page — Stripe Checkout return.
 *
 * Handles the webhook race: rather than sending the owner straight home (where
 * the `(app)` gate could bounce them before `customer.subscription.created`
 * fires), we RETRIEVE the Checkout Session and sync the workspaces row
 * immediately. If that lands active → straight home. If it's still settling →
 * render the client poller, which polls until active then forwards. Robust to
 * a missing/invalid session_id (just polls). Membership is enforced by the
 * parent [workspaceId] layout; this route is NOT subscription-gated.
 */
export default function SubscribeSuccessPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={null}>
      <SuccessContent params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function SuccessContent({ params, searchParams }: Props) {
  const { workspaceId } = await params
  const { session_id } = await searchParams
  const parsed = route.entry.parse({
    params: { workspaceId },
    searchParams: { session_id },
    cookies: {},
  })

  // Immediate sync from the Checkout Session (sidesteps the webhook delay).
  // Best-effort: any failure falls through to the client poller. NOTE: the
  // `redirect()` is kept OUTSIDE this try/catch — `redirect` throws a control
  // signal that the catch must not swallow.
  let syncedStatus: string | null = null
  if (isStripeConfigured() && parsed.sessionId) {
    try {
      syncedStatus = await syncWorkspaceFromCheckoutSession({
        workspaceId: Number(parsed.workspaceId),
        sessionId:   parsed.sessionId,
      })
    } catch {
      // ignore — the poller will catch up once the webhook lands.
    }
  }
  if (isSubscriptionActive(syncedStatus)) {
    redirect(route.exits.home({ workspaceId: parsed.workspaceId }))
  }

  // Maybe the webhook already landed even without a session_id.
  const billing = await getBillingState(Number(parsed.workspaceId))
  if (isSubscriptionActive(billing.status)) {
    redirect(route.exits.home({ workspaceId: parsed.workspaceId }))
  }

  return <CheckoutSuccess workspaceId={parsed.workspaceId} />
}
