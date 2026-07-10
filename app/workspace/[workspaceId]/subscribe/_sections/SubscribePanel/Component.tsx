'use client'

import { Check, CreditCard, Loader2, Sparkles } from 'lucide-react'
import { Tile } from '@/components/ui/Tile'
import { Button } from '@/components/ui/Button'
import { IconChip } from '@/components/ui/IconChip'
import { useT, useLocale } from '@/lib/i18n/LocaleProvider'
import { formatCurrency } from '@/lib/i18n/format'
import type { Plan, PlanTier } from '@/lib/stripe/plans'
import { route } from '../../contract'
import { scene } from './scene'
import { fixtures } from './fixtures'
import { startCheckout } from './actions'
import type { State } from './state'

type Props = {
  workspaceId:   string
  plans:         Plan[]
  initialState?: State
}

/**
 * SubscribePanel — the paywall plan picker.
 *
 * Renders the placeholder plans (pro highlighted). Selecting one calls
 * `startCheckout`, which returns a hosted Stripe Checkout URL we assign to
 * `window.location`. The success/cancel URLs are built HERE (the section owns
 * the route contract) and passed to the action as plain strings. Stripe's
 * success_url lands on the subscribe success page (webhook-race-safe);
 * cancel_url returns here.
 */
export function SubscribePanel({ workspaceId, plans, initialState }: Props) {
  const m = useT().subscribe
  const locale = useLocale()
  const [view, send] = scene.useScene(initialState ?? fixtures.idle)

  const planName = (tier: PlanTier) => m.plans[tier]?.name ?? String(tier)
  const price = (amount: number, cur: string) =>
    `${formatCurrency(amount / 100, locale, cur)}${m.perMonth}`

  const subscribe = async (priceId: string) => {
    send({ type: 'START', target: priceId })
    const origin = window.location.origin
    const result = await startCheckout({
      workspaceId,
      priceId,
      successUrl: `${origin}${route.exits.success({ workspaceId })}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:  `${origin}${route.exits.self({ workspaceId })}`,
    })
    if (result.success) {
      window.location.assign(result.url)
    } else {
      send({ type: 'ERROR', message: result.error })
    }
  }

  const errorMessage = view.status === 'error' ? view.message : null
  const busyTarget = view.status === 'redirecting' ? view.target : null

  return (
    <div className="space-y-6" onChange={() => send({ type: 'RETRY' })}>
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-3xl bg-destructive-soft p-4 shadow-card ring-1 ring-inset ring-destructive-deep/10">
          <IconChip size="sm" className="bg-destructive/15 text-destructive-deep"><CreditCard aria-hidden="true" /></IconChip>
          <p className="text-sm font-medium text-destructive-deep">{errorMessage}</p>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.tier}
            name={planName(plan.tier)}
            priceLabel={price(plan.amount, plan.currency)}
            features={plan.features.map((f) => m.features[f as keyof typeof m.features] ?? f)}
            subscribeLabel={m.subscribe}
            recommended={plan.recommended ?? false}
            recommendedLabel={m.recommended}
            busy={busyTarget === plan.priceId}
            disabled={busyTarget !== null}
            onSubscribe={() => subscribe(plan.priceId)}
          />
        ))}
      </div>
    </div>
  )
}

function PlanCard(props: {
  name:             string
  priceLabel:       string
  features:         string[]
  subscribeLabel:   string
  recommended:      boolean
  recommendedLabel: string
  busy:             boolean
  disabled:         boolean
  onSubscribe:      () => void
}) {
  const rec = props.recommended
  return (
    <Tile
      tone={rec ? 'accent' : 'plain'}
      className={
        rec
          ? 'relative flex flex-col gap-5 p-7 shadow-card-lg ring-2 ring-brand lg:-translate-y-2'
          : 'flex flex-col gap-5'
      }
    >
      {rec && (
        <span className="absolute -top-3 left-5 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground shadow-sm">
          <Sparkles aria-hidden="true" className="size-3" />
          {props.recommendedLabel}
        </span>
      )}

      <div className="space-y-1.5">
        <h3 className={rec ? 'label-micro text-accent-foreground/80' : 'label-micro text-muted-foreground'}>
          {props.name}
        </h3>
        <p
          className={
            'font-semibold leading-none tracking-tight tabular-nums text-3xl sm:text-4xl ' +
            (rec ? 'text-accent-foreground' : '')
          }
        >
          {props.priceLabel}
        </p>
      </div>

      <ul className="flex-1 space-y-2.5">
        {props.features.map((feature) => (
          <li
            key={feature}
            className={`flex items-start gap-2 text-sm ${rec ? 'text-accent-foreground/85' : 'text-muted-foreground'}`}
          >
            <Check className={`mt-0.5 size-4 shrink-0 ${rec ? 'text-warning' : 'text-success-deep'}`} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={rec ? 'brand' : 'outline'}
        disabled={props.disabled}
        onClick={props.onSubscribe}
      >
        {props.busy && <Loader2 className="animate-spin" />}
        {props.subscribeLabel}
      </Button>
    </Tile>
  )
}
