import { Suspense } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { getCurrentLocale } from '@/lib/i18n/getLocale'
import { t } from '@/lib/i18n/messages'
import { getBillingState } from '@/lib/stripe/billing'
import { planByTier } from '@/lib/stripe/plans'
import { route } from './contract'
import { BillingPanel } from './_sections/BillingPanel/Component'

type Props = {
  params: Promise<{ workspaceId: string }>
}

/**
 * BILLING page — subscription management for the workspace owner.
 *
 * Inside the `(app)` billing gate, so only an ACTIVE workspace reaches it.
 * Reads the webhook-synced billing state (no Stripe call) and composes the
 * BillingPanel. Cancel/resume/portal actions are owner-gated server-side.
 */
export default function BillingPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <BillingContent params={params} />
    </Suspense>
  )
}

async function BillingContent({ params }: Props) {
  const { workspaceId } = await params
  const parsed = route.entry.parse({ params: { workspaceId }, searchParams: {}, cookies: {} })

  const billing = await getBillingState(Number(parsed.workspaceId))
  const m = t(await getCurrentLocale())
  const plan = planByTier(billing.plan)
  const planLabel = plan ? m.subscribe.plans[plan.tier].name : m.billing.unknownPlan

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <PageHeader kicker={m.billing.kicker} title={m.billing.title} subtitle={m.billing.subtitle} />
      <div className="mt-8">
        <BillingPanel workspaceId={parsed.workspaceId} billing={billing} planLabel={planLabel} />
      </div>
    </main>
  )
}
