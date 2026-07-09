import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { isStripeConfigured } from '@/lib/stripe/client'
import { getBillingState } from '@/lib/stripe/billing'
import { isSubscriptionActive } from '@/lib/stripe/active'
import { entry as subscribeEntry } from '../subscribe/entry'

/**
 * Billing chokepoint for the workspace app area (gate topology — docs/billing.md),
 * in the Suspense guard shell shape (docs/guards.md → "Suspense guard shells"):
 *
 * - ONE gate for everything inside `(app)`. Membership is already enforced by
 *   the parent `[workspaceId]` layout — this layout adds ONLY the subscription
 *   check, reading the webhook-synced `workspaces` row (no Stripe call).
 * - The redirect targets live OUTSIDE this group: `/workspace/[id]/subscribe`
 *   (+ `/success`) are SIBLINGS of `(app)`, so the gate can never redirect-loop.
 * - FAIL-OPEN: when STRIPE_SECRET_KEY is absent the gate is inert — a template
 *   app without billing must not lock every workspace out. Configure Stripe
 *   (see docs/billing.md) and the gate activates.
 * - The layout is SYNC; the billing read (uncached DB I/O) resolves in an
 *   async child inside `<Suspense>`, where `redirect()` still works.
 */
export default function BillingGateLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  return (
    <Suspense fallback={<BillingGateFallback />}>
      <BillingGate params={params}>{children}</BillingGate>
    </Suspense>
  )
}

async function BillingGate({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  if (isStripeConfigured()) {
    const billing = await getBillingState(Number(workspaceId))
    if (!isSubscriptionActive(billing.status)) {
      redirect(subscribeEntry.href({ workspaceId }))
    }
  }
  return <>{children}</>
}

/**
 * Footprint-matched fallback: mirrors the (app) home page's centered
 * min-h-screen frame so the fallback → content swap doesn't shift layout.
 */
function BillingGateFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
    </main>
  )
}
