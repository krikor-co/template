import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { getCurrentLocale } from '@/lib/i18n/getLocale'
import { t } from '@/lib/i18n/messages'
import { isStripeConfigured } from '@/lib/stripe/client'
import { getBillingState } from '@/lib/stripe/billing'
import { isSubscriptionActive } from '@/lib/stripe/active'
import { PLANS } from '@/lib/stripe/plans'
import { route } from './contract'
import { SubscribePanel } from './_sections/SubscribePanel/Component'

type Props = {
  params: Promise<{ workspaceId: string }>
}

/**
 * SUBSCRIBE page — plan paywall (the `(app)` billing gate's escape route).
 *
 * If Stripe isn't configured the gate is inert and there is nothing to sell →
 * forward home. If the workspace is ALREADY active (status ∈ {active,trialing})
 * there is nothing to buy → forward home. Otherwise render the plan picker.
 * Membership is enforced by the parent [workspaceId] layout; the checkout
 * ACTION additionally gates on the `owner` role.
 */
export default function SubscribePage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <SubscribeContent params={params} />
    </Suspense>
  )
}

async function SubscribeContent({ params }: Props) {
  const { workspaceId } = await params
  const parsed = route.entry.parse({ params: { workspaceId }, searchParams: {}, cookies: {} })

  if (!isStripeConfigured()) {
    redirect(route.exits.home({ workspaceId: parsed.workspaceId }))
  }

  const billing = await getBillingState(Number(parsed.workspaceId))
  if (isSubscriptionActive(billing.status)) {
    redirect(route.exits.home({ workspaceId: parsed.workspaceId }))
  }

  const m = t(await getCurrentLocale())

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <PageHeader
        kicker={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            {m.subscribe.kicker}
          </span>
        }
        title={m.subscribe.title}
        subtitle={m.subscribe.subtitle}
      />
      <div className="mt-8">
        <SubscribePanel workspaceId={parsed.workspaceId} plans={PLANS} />
      </div>
    </main>
  )
}
