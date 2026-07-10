'use client'

import { ExternalLink, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Tile } from '@/components/ui/Tile'
import { Button } from '@/components/ui/Button'
import { useT, useLocale } from '@/lib/i18n/LocaleProvider'
import { formatDate } from '@/lib/i18n/format'
import type { BillingState } from '@/lib/stripe/billing'
import { route } from '../../contract'
import { scene } from './scene'
import { fixtures } from './fixtures'
import { openPortal, cancelSubscriptionAtPeriodEnd, resumeSubscription } from './actions'
import type { State } from './state'

type Props = {
  workspaceId:   string
  billing:       BillingState
  /** Resolved display name of the current plan (page passes it via i18n). */
  planLabel:     string
  initialState?: State
}

/**
 * BillingPanel — the workspace owner's view of the SaaS subscription.
 *
 * Slim template surface: current plan + period end, in-app
 * cancel-at-period-end / resume, and a Stripe Customer Portal handoff for
 * everything else (payment method, invoices, plan changes). We mutate, then
 * `router.refresh()` re-reads the synced billing state from the server page.
 */
export function BillingPanel({ workspaceId, billing, planLabel, initialState }: Props) {
  const m = useT().billing
  const locale = useLocale()
  const router = useRouter()
  const [view, send] = scene.useScene(initialState ?? fixtures.idle)

  const periodEnd = billing.currentPeriodEnd
    ? formatDate(billing.currentPeriodEnd, locale)
    : null

  const portal = async () => {
    send({ type: 'PORTAL' })
    const result = await openPortal({
      workspaceId,
      returnUrl: `${window.location.origin}${route.entry.href({ workspaceId })}`,
    })
    if (result.success) {
      window.location.assign(result.url)
    } else {
      send({ type: 'ERROR', message: result.error })
    }
  }

  const setCancel = async (action: 'cancel' | 'resume') => {
    send({ type: 'MUTATE', action })
    const result =
      action === 'cancel'
        ? await cancelSubscriptionAtPeriodEnd({ workspaceId })
        : await resumeSubscription({ workspaceId })
    if (result.success) {
      send({ type: 'DONE' })
      router.refresh()
    } else {
      send({ type: 'ERROR', message: result.error })
    }
  }

  const busy = view.status === 'redirecting' || view.status === 'mutating'

  return (
    <div className="space-y-4">
      {view.status === 'error' && (
        <Tile tone="destructive" className="p-4">
          <p className="text-sm font-medium">{view.message}</p>
        </Tile>
      )}

      <Tile className="flex flex-col gap-4 p-6">
        <div className="space-y-1">
          <p className="label-micro text-muted-foreground">{m.currentPlan}</p>
          <p className="text-2xl font-semibold tracking-tight">{planLabel}</p>
          {periodEnd && (
            <p className="text-sm text-muted-foreground">
              {billing.cancelAtPeriodEnd ? m.endsOn(periodEnd) : m.renewsOn(periodEnd)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {billing.hasSubscription && !billing.cancelAtPeriodEnd && (
            <Button variant="outline" block={false} disabled={busy} onClick={() => setCancel('cancel')}>
              {view.status === 'mutating' && view.action === 'cancel' && <Loader2 className="animate-spin" />}
              {m.cancel}
            </Button>
          )}
          {billing.hasSubscription && billing.cancelAtPeriodEnd && (
            <Button variant="brand" block={false} disabled={busy} onClick={() => setCancel('resume')}>
              {view.status === 'mutating' && view.action === 'resume' && <Loader2 className="animate-spin" />}
              {m.resume}
            </Button>
          )}
          <Button variant="ghost" block={false} disabled={busy} onClick={portal}>
            {view.status === 'redirecting' && <Loader2 className="animate-spin" />}
            <ExternalLink />
            {m.manage}
          </Button>
        </div>
      </Tile>
    </div>
  )
}
