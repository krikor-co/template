/**
 * SaaS subscription plans (what a workspace pays to use this app). Three
 * PLACEHOLDER tiers, billed monthly. Amounts/price ids are placeholders — create
 * real prices in your Stripe dashboard and point the env vars at them so prod
 * switches without a code change. Display names/features come from `lib/i18n`
 * (`subscribe.plans.*` / `subscribe.features.*`).
 */
export type PlanTier = 'basic' | 'pro' | 'premium'

export type Plan = {
  tier: PlanTier
  /** i18n key under `subscribe.plans.*` for the display name. */
  name: string
  priceId: string
  /** Monthly amount in the currency's minor unit (cents). */
  amount: number
  currency: string
  /** i18n keys under `subscribe.features.*`. */
  features: string[]
  /** Highlighted as the recommended tier in the paywall UI. */
  recommended?: boolean
}

export const PLANS: Plan[] = [
  {
    tier: 'basic',
    name: 'basic',
    priceId: process.env.STRIPE_PRICE_BASIC ?? 'price_basic_placeholder',
    amount: 900,
    currency: 'USD',
    features: ['core', 'oneWorkspace'],
  },
  {
    tier: 'pro',
    name: 'pro',
    priceId: process.env.STRIPE_PRICE_PRO ?? 'price_pro_placeholder',
    amount: 2900,
    currency: 'USD',
    features: ['everythingBasic', 'advanced', 'team'],
    recommended: true,
  },
  {
    tier: 'premium',
    name: 'premium',
    priceId: process.env.STRIPE_PRICE_PREMIUM ?? 'price_premium_placeholder',
    amount: 9900,
    currency: 'USD',
    features: ['everythingPro', 'priority', 'api'],
  },
]

export function planByTier(tier: PlanTier | null | undefined): Plan | undefined {
  return tier ? PLANS.find((p) => p.tier === tier) : undefined
}

export function planByPriceId(priceId: string | null | undefined): Plan | undefined {
  return priceId ? PLANS.find((p) => p.priceId === priceId) : undefined
}
