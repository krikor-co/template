# Phase 10: Stripe & AI — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Land the two staged sub-efforts: a review-then-port of irene's Stripe subscription billing as a workspace-scoped primitive (gate + escape routes + cancel/resume + post-payment landing), and the generalized AI stack (capability registry skeleton, tools-from-capabilities generator, AI widget family, `ai_call_log` + outcome classification).

**Depends on phases:** 3, 6 (hard). Additionally: tasks using i18n (10.5–10.8) need phase 4; tasks using tokens/components (10.6–10.8, 10.14–10.15) need phases 2 and 8 (`Tile`, `IconChip`, `SectionLabel`, `Delta`, `Sparkline`, `Button`, `PageHeader`). Orchestrators: run 10.6–10.8 and 10.14–10.15 only after phase 8 lands.

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE source: `/Users/luca/dev/winter-park/irene` (read-only reference).
- Tenant concept: **workspace** everywhere irene says salon. `salonId` → `workspaceId` in every identifier, attribute, metadata key, and comment.
- New tables this phase: `ai_call_log` (workspace_id + user_id nullable ints); billing columns added to `workspaces`. Migration story: template has only baseline `0000` — after any schema change run `rm -rf drizzle && npx drizzle-kit generate --name baseline` → `drizzle/0000_baseline.sql` (phase 1 convention). Full `next build`/migrate verification defers to phase 13's gate when no scratch `DATABASE_URL` is configured.
- Effect is adopted: `runAction`, `runQuery`, `mapResult`, `dbE`, `validate` keep irene's names (phase 3). Error union includes `SubscriptionInactive({ workspaceId: number })` (already ported in phase 3 Task 3.3 with `workspaceId`). `boundary.ts` already maps the `'SubscriptionInactive'` kind.
- Guards (phase 6): `requireWorkspaceRole(workspaceId: string, role: string | string[])` from `@/app/workspace/guards`; Effect adapter `requireWorkspaceRoleE(workspaceId: string, role: string | string[]): Effect.Effect<void, Forbidden | Unauthenticated>` from `@/lib/effect/auth`. Workspace roles seeded `'owner' | 'member'`.
- Design tokens (phases 2, 8 — canonical irene→template mapping, no exceptions): `charcoal` (solid dark anchor) → `accent` (`bg-accent text-accent-foreground`, Tile `tone="accent"`); `honey` → `warning`; `sage` → `success`; `terracotta` → `brand`; `charcoal-2`/`charcoal-line` have no slot → use `accent-foreground` opacity fills (`bg-accent-foreground/10`, `ring-accent-foreground/15`); `shadow-bento` → `shadow-card`, `shadow-bento-lg` → `shadow-card-lg`; `label-mono` → `label-micro`. AI widgets IMPORT tone/token classes — never re-declare tone→CSS-var tables.
- Copy: English defaults everywhere. Reusable primitives (`components/ui/*`) take ALL user-facing microcopy via props with English defaults; route-level sections use `lib/i18n` messages (`en` canonical + `pt-BR` second seed). No hardcoded pt-BR in code defaults.
- Identifiers: dev port 3000; `DEFAULT_LOCALE 'en'`; `SUPPORTED_LOCALES ['en','pt-BR']`.
- Docs travel with code: `docs/billing.md` + `docs/capabilities.md` ship in this phase with CLAUDE.md doc-table rows; components port with their Storybook stories.
- Verification gate every task: at minimum `npx tsc --noEmit` clean, plus `npx vitest run` for tested code and `npx storybook build` for story tasks. Every task ends in a git commit with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- STRIPE sub-effort is conditional: Task 10.1's `stripe-review.md` verdicts govern Tasks 10.2–10.9. Each of those tasks starts with a skip-check step keyed to a review-item slug. AI sub-effort (10.10–10.16) is unconditional.

---

## Sub-effort A: Stripe billing (review, then conditional port)

### Task 10.1: Stripe diff-review (mandatory — produces the port/skip/generalize verdicts)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/docs/superpowers/plans/2026-07-08-irene-backport/stripe-review.md`

**Interfaces:**
- Consumes: nothing from other tasks — read-only review of irene.
- Produces: `stripe-review.md` with one verdict row per review item, keyed by these exact slugs (Tasks 10.2–10.9 check them): `workspace-billing-columns`, `stripe-client`, `stripe-plans`, `stripe-active`, `stripe-billing-core`, `require-active-subscription`, `webhook-route`, `billing-gate`, `subscribe-paywall`, `post-payment-landing`, `billing-panel`, `inactive-notice`.

Steps:

- [ ] Step: read ALL of `lib/stripe/` in irene (5 files, 348 lines total) and the webhook route:
  - `/Users/luca/dev/winter-park/irene/lib/stripe/client.ts` (23 lines — env-gated singleton, `getStripe`, `isStripeConfigured`)
  - `/Users/luca/dev/winter-park/irene/lib/stripe/plans.ts` (58 lines — `PlanTier`, `PLANS` with BRL sandbox price ids, `planByTier`, `planByPriceId`)
  - `/Users/luca/dev/winter-park/irene/lib/stripe/active.ts` (16 lines — `isSubscriptionActive`, single source of truth)
  - `/Users/luca/dev/winter-park/irene/lib/stripe/billing.ts` (218 lines — `getBillingState`, `setSubscriptionCancellation`, `ensureStripeCustomer`, `createCheckoutSession`, `createPortalSession`, `syncSalonFromCheckoutSession`; all keyed on the `salon` table)
  - `/Users/luca/dev/winter-park/irene/lib/stripe/require-active-subscription.ts` (33 lines — `requireActiveSubscriptionE(salonId)` failing with `SubscriptionInactive({ salonId })`)
  - `/Users/luca/dev/winter-park/irene/app/api/stripe/webhook/route.ts` (82 lines — signature verify against `STRIPE_WEBHOOK_SECRET`, handles `customer.subscription.{created,updated,deleted}`, syncs the `salon` row by `stripeCustomerId`)
- [ ] Step: enumerate the billing-gate call sites — run:
  ```bash
  grep -rn "isSubscriptionActive\|getBillingState" /Users/luca/dev/winter-park/irene --include="*.ts" --include="*.tsx" -l
  ```
  and read each hit. Expected set (verify, note any new ones):
  - `app/salon/[salonId]/owner/layout.tsx` (lines 113–120 — the paywall chokepoint, commit 9f13a5f; redirects inactive → `/salon/:id/subscribe`, a SIBLING of `owner/`)
  - `app/salon/[salonId]/attendant/layout.tsx` + `professional/layout.tsx` (inactive → `/salon/:id/inactive` read-only notice — NOT the owner paywall)
  - `app/salon/[salonId]/inactive/` (the non-owner notice route)
  - `app/salon/[salonId]/setup/guards.ts` (setup lock interplay — salon-specific)
  - `app/salon/[salonId]/owner/config/_sections/ConfigHub/BillingTile.tsx` + `signals.ts` (config-hub tile — salon UI)
  - `app/salon/[salonId]/owner/billing/page.tsx` + `_sections/BillingPanel/*` (7 files — cancel-at-period-end/resume + portal, commit 6d474f9; `Component.tsx` is 406 lines)
  - `app/salon/[salonId]/subscribe/*` (entry/contract/layout/page + `_sections/SubscribePanel/*` — the paywall)
  - `app/salon/[salonId]/subscribe/success/*` (post-payment landing, commit 1c142ff — `syncSalonFromCheckoutSession` immediate sync + `CheckoutSuccess` poller + `usePollActive`)
  - `lib/stripe/require-active-subscription.ts` consumers: `owner/appointments/.../AppointmentForm/actions.ts`, `owner/transactions/new/.../TransactionHub/actions.ts`, `owner/services/.../ServiceForm/actions.ts` (action-level defense-in-depth taps)
- [ ] Step: read the salon schema's billing columns — `grep -n "stripe\|plan\|subscription\|PeriodEnd" /Users/luca/dev/winter-park/irene/db/schema/salon.ts` (lines 142–160: `stripeCustomerId`, `stripeSubscriptionId`, `plan`, `subscriptionStatus`, `currentPeriodEnd` timestamptz, `cancelAtPeriodEnd` boolean default false).
- [ ] Step: Write `/Users/luca/dev/winter-park/template/docs/superpowers/plans/2026-07-08-irene-backport/stripe-review.md` with a verdict table. Use this skeleton — the expected verdicts below are the plan's default; CONFIRM each against the source you just read, and if you change any verdict to `skip`, later tasks honoring that slug are skipped:

```markdown
# Stripe diff-review — irene → template (2026-07-08)

Reviewed: lib/stripe/ (5 files), app/api/stripe/webhook/route.ts, all
isSubscriptionActive/getBillingState call sites, cancel/resume (6d474f9),
post-payment landing (1c142ff), billing gate (9f13a5f), salon billing columns.

| slug | irene source | salon-couplings found | verdict |
|---|---|---|---|
| workspace-billing-columns | db/schema/salon.ts:142-160 | columns live on `salon`; names themselves are generic | **generalize** → same 6 columns on `workspaces` |
| stripe-client | lib/stripe/client.ts | none (env-gated singleton) | **port verbatim** |
| stripe-plans | lib/stripe/plans.ts | BRL amounts, real sandbox price ids, salon feature keys (catalog/appointments/oneLocation) | **generalize** → USD placeholders, env-overridable ids, generic feature keys |
| stripe-active | lib/stripe/active.ts | comments only ("salon's Irene subscription", "owner dashboard") | **generalize** (comments) |
| stripe-billing-core | lib/stripe/billing.ts | `salon` table + salonId param names + `metadata.salonId` throughout | **generalize** → workspaces/workspaceId; `syncSalonFromCheckoutSession` → `syncWorkspaceFromCheckoutSession` |
| require-active-subscription | lib/stripe/require-active-subscription.ts | salonId + salon-copy comments | **generalize** + add fail-open when Stripe unconfigured |
| webhook-route | app/api/stripe/webhook/route.ts | `salon` table sync target; comment says port 3001 | **generalize** |
| billing-gate | owner/layout.tsx:113-120 | chained with salon setup-lock + owner role model | **generalize shape only** → billing gate in a `(app)` route group layout under /workspace/[workspaceId]; fail-open when Stripe unconfigured (template apps without billing must not lock out) |
| subscribe-paywall | subscribe/* + SubscribePanel/* | salon copy, terracotta/charcoal tokens, requireOwner layout, action imports route contract (irene exception) | **generalize** → workspace route; owner-gated ACTION (no extra layout — parent [workspaceId] layout covers membership); section builds success/cancel URLs (BillingPanel shape) |
| post-payment-landing | subscribe/success/* | forwards to salon /setup; salon copy/tokens | **generalize** → forwards to workspace home; poller + immediate sync kept |
| billing-panel | owner/billing/* (Component 406 lines) | heavy salon UI (plan grid, config-hub links) | **generalize slim** → cancel/resume/portal actions ported; slim template Component (plan+status+period-end+3 buttons); plan-grid checkout stays on /subscribe |
| inactive-notice | app/salon/[salonId]/inactive | attendant/professional role model | **skip** — template gate sends everyone to /subscribe; members see the paywall and the owner-gated action refuses. Documented as an app-extension option in docs/billing.md |

Regression notes:
- `current_period_end` is read defensively at both subscription and item level
  (Stripe API version drift) — KEEP that fallback in billing.ts + webhook.
- `redirect()` must stay OUTSIDE try/catch on the success page (control-flow throw).
- priceId allowlist via `planByPriceId` in the checkout action — KEEP (never let a
  client subscribe to an arbitrary price).
```

- [ ] Step: verification — `test -f docs/superpowers/plans/2026-07-08-irene-backport/stripe-review.md && grep -c '^| ' docs/superpowers/plans/2026-07-08-irene-backport/stripe-review.md` → expected: ≥ 13 (header + 12 slugs).
- [ ] Step: commit:
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add docs/superpowers/plans/2026-07-08-irene-backport/stripe-review.md
  git commit -m "docs(billing): stripe diff-review — port/skip/generalize verdicts per file

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.2: `stripe` dep + `workspaces` billing columns + baseline regen

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/package.json` (add dependency)
- Modify: `/Users/luca/dev/winter-park/template/db/schema/workspaces.ts` (phase 6 Task 6.1 file — append 6 columns)
- Regenerate: `/Users/luca/dev/winter-park/template/drizzle/0000_baseline.sql`

**Interfaces:**
- Consumes: `workspaces` pgTable from phase 6 Task 6.1 (`id`, `name`, `slug`, timestamps, `deletedAt`).
- Produces: `workspaces.stripeCustomerId: text | null`, `workspaces.stripeSubscriptionId: text | null`, `workspaces.plan: text | null`, `workspaces.subscriptionStatus: text | null`, `workspaces.currentPeriodEnd: timestamptz | null`, `workspaces.cancelAtPeriodEnd: boolean NOT NULL default false` — consumed by 10.3 (billing.ts) and 10.4 (webhook). `stripe` package importable — consumed by 10.3, 10.4.

Steps:

- [ ] Step: skip-check — open `docs/superpowers/plans/2026-07-08-irene-backport/stripe-review.md`; if row `workspace-billing-columns` verdict is `skip`, mark this task skipped (and note: 10.3–10.9 will then skip too) and stop here.
- [ ] Step: install dep — Run: `cd /Users/luca/dev/winter-park/template && npm install stripe@^22.2.2` → expected: exit 0; `grep '"stripe"' package.json` shows `"stripe": "^22.2.2"`.
- [ ] Step: edit `/Users/luca/dev/winter-park/template/db/schema/workspaces.ts` — two anchored edits:
  1. In the `drizzle-orm/pg-core` import line, ensure `boolean` is imported (add it to the existing import list if absent).
  2. Immediately BEFORE the `createdAt` column line inside the `workspaces` pgTable, insert:
  ```ts
  /**
   * Stripe SaaS billing (the workspace's subscription to THIS app — synced by
   * the webhook + post-checkout sync; the app reads its own row, never Stripe,
   * on the read path):
   *   plan               → 'basic' | 'pro' | 'premium' (null = no subscription)
   *   subscriptionStatus → Stripe status ('active' | 'trialing' | 'past_due' |
   *                        'canceled' | …); active gate = status ∈ {active,trialing}
   */
  stripeCustomerId:     text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  plan:                 text('plan'),
  subscriptionStatus:   text('subscription_status'),
  currentPeriodEnd:     timestamp('current_period_end', { withTimezone: true }),
  /**
   * Whether the subscription is set to cancel at the end of the current period
   * (Stripe `cancel_at_period_end`). The sub stays `active` until
   * `currentPeriodEnd`, then the webhook flips `subscriptionStatus` to
   * 'canceled'. Synced from Stripe.
   */
  cancelAtPeriodEnd:    boolean('cancel_at_period_end').default(false).notNull(),
  ```
- [ ] Step: regenerate baseline — Run: `cd /Users/luca/dev/winter-park/template && rm -rf drizzle && npx drizzle-kit generate --name baseline` → expected: exit 0, `drizzle/0000_baseline.sql` exists.
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -c 'stripe_customer_id\|cancel_at_period_end' drizzle/0000_baseline.sql` → expected: 2.
- [ ] Step: commit:
  ```bash
  git add package.json package-lock.json db/schema/workspaces.ts drizzle
  git commit -m "backport(billing): stripe dep + workspace billing columns (baseline regen)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.3: Port `lib/stripe/` primitives (client, plans, active + test, billing, require-active-subscription)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/stripe/client.ts` (verbatim port, 23 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/stripe/plans.ts` (rewritten — placeholder plans)
- Create: `/Users/luca/dev/winter-park/template/lib/stripe/active.ts` (port, comment edits)
- Test: `/Users/luca/dev/winter-park/template/lib/stripe/active.test.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/stripe/billing.ts` (port, salon→workspace edits)
- Create: `/Users/luca/dev/winter-park/template/lib/stripe/require-active-subscription.ts` (rewritten — adds fail-open)

**Interfaces:**
- Consumes: `workspaces` columns (10.2); `db` from `@/db/drizzle`; `DbError`, `SubscriptionInactive` from `@/lib/effect/errors` (phase 3.3); `Effect`, `pipe` from `effect` (phase 3.1); `stripe` package (10.2).
- Produces (10.4–10.9 consume):
  - `stripe: Stripe | null`, `getStripe(): Stripe`, `isStripeConfigured(): boolean` from `@/lib/stripe/client`
  - `type PlanTier = 'basic' | 'pro' | 'premium'`, `type Plan = { tier: PlanTier; name: string; priceId: string; amount: number; currency: string; features: string[]; recommended?: boolean }`, `PLANS: Plan[]`, `planByTier(tier: PlanTier | null | undefined): Plan | undefined`, `planByPriceId(priceId: string | null | undefined): Plan | undefined` from `@/lib/stripe/plans`
  - `isSubscriptionActive(status: string | null | undefined): boolean` from `@/lib/stripe/active`
  - `type BillingState = { plan: PlanTier | null; status: string | null; currentPeriodEnd: string | null; hasSubscription: boolean; cancelAtPeriodEnd: boolean }`, `getBillingState(workspaceId: number): Promise<BillingState>`, `setSubscriptionCancellation(input: { workspaceId: number; cancel: boolean }): Promise<{ ok: true; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null } | { ok: false; reason: 'no_subscription' }>`, `createCheckoutSession(input: { workspaceId: number; priceId: string; successUrl: string; cancelUrl: string }): Promise<string>`, `createPortalSession(input: { workspaceId: number; returnUrl: string }): Promise<string>`, `syncWorkspaceFromCheckoutSession(input: { workspaceId: number; sessionId: string }): Promise<string | null>` from `@/lib/stripe/billing`
  - `requireActiveSubscriptionE(workspaceId: number): Effect.Effect<void, SubscriptionInactive | DbError>` from `@/lib/stripe/require-active-subscription`

Steps:

- [ ] Step: skip-check — if `stripe-review.md` row `stripe-billing-core` verdict is `skip`, mark this task skipped and stop.
- [ ] Step: copy client — `mkdir -p /Users/luca/dev/winter-park/template/lib/stripe && cp /Users/luca/dev/winter-park/irene/lib/stripe/client.ts /Users/luca/dev/winter-park/template/lib/stripe/client.ts`. No edits (file is fully generic; verify: `grep -c 'salon\|[Ii]rene' lib/stripe/client.ts` → 0).
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/stripe/plans.ts` with this exact content (replaces irene's BRL sandbox plans — verdict `stripe-plans: generalize`):

```ts
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
```

- [ ] Step: write failing test FIRST — Write `/Users/luca/dev/winter-park/template/lib/stripe/active.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isSubscriptionActive } from './active'

describe('isSubscriptionActive', () => {
  it('treats active and trialing as active', () => {
    expect(isSubscriptionActive('active')).toBe(true)
    expect(isSubscriptionActive('trialing')).toBe(true)
  })

  it('treats every other status as NOT active', () => {
    expect(isSubscriptionActive('past_due')).toBe(false)
    expect(isSubscriptionActive('canceled')).toBe(false)
    expect(isSubscriptionActive('incomplete')).toBe(false)
    expect(isSubscriptionActive('unpaid')).toBe(false)
  })

  it('treats null/undefined (never subscribed) as NOT active', () => {
    expect(isSubscriptionActive(null)).toBe(false)
    expect(isSubscriptionActive(undefined)).toBe(false)
  })
})
```

  Run: `npx vitest run lib/stripe/active.test.ts` → expected: FAIL (module `./active` not found).
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/stripe/active.ts` (irene's 16 lines with comment generalization — "salon's Irene subscription" → "workspace's subscription", "owner dashboard" → "billing-gated (app) area", "owner-layout gate" → "(app)-layout gate"):

```ts
/**
 * Single source of truth for "is this workspace's subscription active?"
 *
 * Active === Stripe status ∈ {'active','trialing'}. EVERYTHING else — null
 * (never subscribed), 'canceled', 'past_due', 'incomplete', 'unpaid', etc. —
 * counts as NOT active and is gated out of the billing-gated (app) area.
 *
 * Both the (app)-layout gate and the subscribe paywall import this so they can
 * never drift to a different definition (which would otherwise reopen the
 * redirect-loop risk).
 */
const ACTIVE_STATUSES = new Set(['active', 'trialing'])

export function isSubscriptionActive(status: string | null | undefined): boolean {
  return status != null && ACTIVE_STATUSES.has(status)
}
```

  Run: `npx vitest run lib/stripe/active.test.ts` → expected: PASS (3 tests).
- [ ] Step: copy billing core — `cp /Users/luca/dev/winter-park/irene/lib/stripe/billing.ts /Users/luca/dev/winter-park/template/lib/stripe/billing.ts`, then apply these enumerated edits (irene line refs):
  1. L4: `import { salon } from '@/db/schema'` → `import { workspaces } from '@/db/schema'`
  2. L8–13 header comment → replace whole block with:
     ```ts
     /**
      * Core Stripe billing operations for a workspace's subscription. Plain server
      * helpers — route `'use server'` actions wrap these with the workspace-owner
      * guard + map results to route exits. The webhook keeps the workspaces row in
      * sync; these read that row (no Stripe call on the read path).
      */
     ```
  3. L29: `export async function getBillingState(salonId: number)` → `export async function getBillingState(workspaceId: number)`
  4. L32–36 (select fields): `salon.plan` → `workspaces.plan`; `salon.subscriptionStatus` → `workspaces.subscriptionStatus`; `salon.currentPeriodEnd` → `workspaces.currentPeriodEnd`; `salon.stripeSubscriptionId` → `workspaces.stripeSubscriptionId`; `salon.cancelAtPeriodEnd` → `workspaces.cancelAtPeriodEnd`
  5. L38–39: `.from(salon).where(eq(salon.id, salonId))` → `.from(workspaces).where(eq(workspaces.id, workspaceId))`
  6. L51–65 doc comment: `the salon's Irene subscription` → `the workspace's subscription`; `back to the salon row` → `back to the workspaces row`; `when the salon has no Stripe subscription` → `when the workspace has no Stripe subscription`
  7. L66–68: `input: { salonId: number; cancel: boolean }` → `input: { workspaceId: number; cancel: boolean }`
  8. L74–78: `select({ subId: salon.stripeSubscriptionId, cpe: salon.currentPeriodEnd }).from(salon).where(eq(salon.id, input.salonId))` → `select({ subId: workspaces.stripeSubscriptionId, cpe: workspaces.currentPeriodEnd }).from(workspaces).where(eq(workspaces.id, input.workspaceId))`
  9. L91–98: `.update(salon)` → `.update(workspaces)`; `.where(eq(salon.id, input.salonId))` → `.where(eq(workspaces.id, input.workspaceId))`
  10. L107: comment `Find or lazily create the salon's Stripe customer` → `Find or lazily create the workspace's Stripe customer`
  11. L108: `async function ensureStripeCustomer(salonId: number)` → `async function ensureStripeCustomer(workspaceId: number)`
  12. L110–114: `select({ name: salon.name, custId: salon.stripeCustomerId }).from(salon).where(eq(salon.id, salonId))` → `select({ name: workspaces.name, custId: workspaces.stripeCustomerId }).from(workspaces).where(eq(workspaces.id, workspaceId))`
  13. L115: `throw new Error('salon not found')` → `throw new Error('workspace not found')`
  14. L120: `metadata: { salonId: String(salonId) }` → `metadata: { workspaceId: String(workspaceId) }`
  15. L122–125: `.update(salon)` → `.update(workspaces)`; `.where(eq(salon.id, salonId))` → `.where(eq(workspaces.id, workspaceId))`
  16. L130–137 (`createCheckoutSession`): input field `salonId: number` → `workspaceId: number`; `ensureStripeCustomer(input.salonId)` → `ensureStripeCustomer(input.workspaceId)`
  17. L144: `metadata: { salonId: String(input.salonId) }` → `metadata: { workspaceId: String(input.workspaceId) }`
  18. L151–156 (`createPortalSession`): input field `salonId: number` → `workspaceId: number`; `ensureStripeCustomer(input.salonId)` → `ensureStripeCustomer(input.workspaceId)`
  19. L164–177 doc comment: `write the same fields the webhook would, scoped to this salon` → `… scoped to this workspace`; `validates the session's \`metadata.salonId\` matches the salon we expect (a checkout session can't be used to mutate a different salon)` → `validates the session's \`metadata.workspaceId\` matches the workspace we expect (a checkout session can't be used to mutate a different workspace)`
  20. L178–181: `export async function syncSalonFromCheckoutSession(input: { salonId: number; sessionId: string })` → `export async function syncWorkspaceFromCheckoutSession(input: { workspaceId: number; sessionId: string })`
  21. L188–191: comment `The session must belong to THIS salon (we set metadata.salonId at creation).` → `The session must belong to THIS workspace (we set metadata.workspaceId at creation).`; `if (session.metadata?.salonId && Number(session.metadata.salonId) !== input.salonId)` → `if (session.metadata?.workspaceId && Number(session.metadata.workspaceId) !== input.workspaceId)`; `return getBillingState(input.salonId).then(…)` → `return getBillingState(input.workspaceId).then(…)`
  22. L195: `return getBillingState(input.salonId).then(…)` → `return getBillingState(input.workspaceId).then(…)`
  23. L205–215: `.update(salon)` → `.update(workspaces)`; `.where(eq(salon.id, input.salonId))` → `.where(eq(workspaces.id, input.workspaceId))`
  24. KEEP unchanged (review regression notes): the two-level `current_period_end` fallback (`(sub as unknown as { current_period_end?: number }).current_period_end ?? sub.items.data[0]?.current_period_end`), the `no_subscription` sentinel, and `planByPriceId` import from `./plans`.
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/stripe/require-active-subscription.ts` with this exact content (irene's Effect gate + NEW fail-open branch when Stripe is unconfigured — matches the layout gate's behavior so a template app without billing never fails closed):

```ts
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
```

- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `npx vitest run lib/stripe` → expected: PASS. Run: `grep -rn 'salon\|[Ii]rene' lib/stripe/` → expected: no matches.
- [ ] Step: commit:
  ```bash
  git add lib/stripe
  git commit -m "backport(billing): workspace-scoped stripe primitives (client/plans/active/billing/gate)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.4: Stripe webhook route (signature-verified subscription sync)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/app/api/stripe/webhook/route.ts` (port of irene's 82 lines)

**Interfaces:**
- Consumes: `stripe` singleton from `@/lib/stripe/client` (10.3); `planByPriceId` from `@/lib/stripe/plans` (10.3); `workspaces` (10.2); `db` from `@/db/drizzle`.
- Produces: `POST /api/stripe/webhook` — public endpoint, Stripe-signature-authenticated, syncing `customer.subscription.{created,updated,deleted}` into the `workspaces` row. Consumed by 10.6/10.7 flows at runtime and docs (10.9).

Steps:

- [ ] Step: skip-check — if `stripe-review.md` row `webhook-route` verdict is `skip`, mark this task skipped and stop.
- [ ] Step: copy source — `mkdir -p "/Users/luca/dev/winter-park/template/app/api/stripe/webhook" && cp /Users/luca/dev/winter-park/irene/app/api/stripe/webhook/route.ts /Users/luca/dev/winter-park/template/app/api/stripe/webhook/route.ts`
- [ ] Step: apply generalization edits (irene line refs):
  1. L5: `import { salon } from '@/db/schema'` → `import { workspaces } from '@/db/schema'`
  2. L9–18 header comment: `syncs the salon's subscription state into the \`salon\` row` → `syncs the workspace's subscription state into the \`workspaces\` row`; `it MUST live under /api (outside the owner layout guard)` → `it MUST live under /api (outside the workspace layout guards)`; `stripe listen --forward-to localhost:3001/api/stripe/webhook` → `stripe listen --forward-to localhost:3000/api/stripe/webhook`
  3. L71–81 (`syncSubscription` write): `.update(salon)` → `.update(workspaces)`; `.where(eq(salon.stripeCustomerId, customerId))` → `.where(eq(workspaces.stripeCustomerId, customerId))`
  4. KEEP unchanged: the 503 unconfigured guard, 400 on missing/invalid signature, `constructEvent` verify, the `deleted = sub.status === 'canceled'` null-out logic, the two-level `current_period_end` fallback, and the `default: break` event long-tail comment.
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -rn 'salon\|3001' app/api/stripe/` → expected: no matches.
- [ ] Step: commit:
  ```bash
  git add app/api/stripe
  git commit -m "backport(billing): stripe webhook route — signature-verified workspace subscription sync

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.5: Billing-inactive gate — `(app)` route group + LocaleProvider mount

**Files:**
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/(app)/layout.tsx` (NEW — the billing chokepoint)
- Move: `git mv "app/workspace/[workspaceId]/page.tsx" "app/workspace/[workspaceId]/(app)/page.tsx"` (phase 6 Task 6.7 stub home moves inside the gate; URL `/workspace/<id>` unchanged — route groups don't affect paths)
- Modify: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/layout.tsx` (phase 6 file — mount LocaleProvider; anchor on JSX, not line numbers)

**Interfaces:**
- Consumes: `isStripeConfigured` (10.3), `getBillingState` (10.3), `isSubscriptionActive` (10.3); `entry` from the subscribe route (10.6 — see ordering note below); `LocaleProvider` from `@/lib/i18n/LocaleProvider` + `getCurrentLocale` from `@/lib/i18n/getLocale` (phase 4).
- Produces: gate topology — `(app)/layout.tsx` redirects billing-inactive workspaces to `/workspace/<id>/subscribe`; `subscribe/` + `subscribe/success/` are ungated siblings (escape routes). LocaleProvider mounted for the whole workspace tree (10.6–10.8 sections call `useT()`).

**Ordering note:** this task imports `../subscribe/entry` which Task 10.6 creates. Execute 10.5 and 10.6 back-to-back and run the verification AFTER 10.6's entry.ts exists — OR create the single `subscribe/entry.ts` file (exact content in 10.6) as part of this task and let 10.6 skip re-creating it. Either way commit boundaries stay as written.

Steps:

- [ ] Step: skip-check — if `stripe-review.md` row `billing-gate` verdict is `skip`, mark this task skipped and stop.
- [ ] Step: move the stub home into the group —
  ```bash
  cd /Users/luca/dev/winter-park/template
  mkdir -p "app/workspace/[workspaceId]/(app)"
  git mv "app/workspace/[workspaceId]/page.tsx" "app/workspace/[workspaceId]/(app)/page.tsx"
  ```
  (page.tsx imports are all `@/`-absolute — no edits needed after the move.)
- [ ] Step: Write `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/(app)/layout.tsx` with this exact content:

```tsx
import { redirect } from 'next/navigation'
import { isStripeConfigured } from '@/lib/stripe/client'
import { getBillingState } from '@/lib/stripe/billing'
import { isSubscriptionActive } from '@/lib/stripe/active'
import { entry as subscribeEntry } from '../subscribe/entry'

/**
 * Billing chokepoint for the workspace app area (gate topology — docs/billing.md):
 *
 * - ONE gate for everything inside `(app)`. Membership is already enforced by
 *   the parent `[workspaceId]` layout — this layout adds ONLY the subscription
 *   check, reading the webhook-synced `workspaces` row (no Stripe call).
 * - The redirect targets live OUTSIDE this group: `/workspace/[id]/subscribe`
 *   (+ `/success`) are SIBLINGS of `(app)`, so the gate can never redirect-loop.
 * - FAIL-OPEN: when STRIPE_SECRET_KEY is absent the gate is inert — a template
 *   app without billing must not lock every workspace out. Configure Stripe
 *   (see docs/billing.md) and the gate activates.
 */
export default async function BillingGateLayout({
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
```

- [ ] Step: edit `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/layout.tsx` (phase 6's membership guard layout) — two anchored edits:
  1. Add imports after the existing `@/app/workspace/guards` import line:
     ```tsx
     import { LocaleProvider } from '@/lib/i18n/LocaleProvider'
     import { getCurrentLocale } from '@/lib/i18n/getLocale'
     ```
  2. In the layout body, after the `try/catch` guard block, resolve the locale and wrap the returned children — replace `return <>{children}</>` with:
     ```tsx
     const locale = await getCurrentLocale()
     return <LocaleProvider locale={locale}>{children}</LocaleProvider>
     ```
     (Client sections under `/workspace/*` — SubscribePanel, CheckoutSuccess, BillingPanel — call `useT()`/`useLocale()`; this is their provider mount, mirroring phase 4's auth-layout mount.)
- [ ] Step: verification (after 10.6's `subscribe/entry.ts` exists) — Run: `npx tsc --noEmit` → expected: exit 0. Run: `ls "app/workspace/[workspaceId]/(app)"` → expected: `layout.tsx  page.tsx`.
- [ ] Step: commit:
  ```bash
  git add "app/workspace/[workspaceId]"
  git commit -m "backport(billing): (app) billing gate + escape-route topology + workspace LocaleProvider

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.6: Subscribe paywall — route + SubscribePanel section + `subscribe` messages

**Files:**
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/entry.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/contract.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/page.tsx`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/_sections/SubscribePanel/state.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/_sections/SubscribePanel/transition.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/_sections/SubscribePanel/scene.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/_sections/SubscribePanel/fixtures.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/_sections/SubscribePanel/actions.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/_sections/SubscribePanel/Component.tsx`
- Modify: `/Users/luca/dev/winter-park/template/lib/i18n/messages.ts` (phase 4 file — add `subscribe` namespace; anchor on structure)

**Interfaces:**
- Consumes: `runAction`/`mapResult`/`validate` + `ExternalServiceError`, `ValidationFailed` (phase 3); `requireWorkspaceRoleE` (phase 6.4); `isStripeConfigured`/`createCheckoutSession`/`getBillingState`/`isSubscriptionActive`/`PLANS`/`planByPriceId`/`Plan`/`PlanTier` (10.3); `createScene` from `@/lib/scene`; `createRoute`/`ParseContext` from `@/lib/route-registry`; `t`/`getCurrentLocale`/`useT`/`useLocale`/`formatCurrency` (phase 4); `Tile`/`Button`/`IconChip`/`PageHeader` (phase 8); workspace `entry` from `../entry` (phase 6.7); success `entry` (10.7 — create `success/entry.ts` in THIS task, exact content below, so the contract compiles; 10.7 skips re-creating it).
- Produces: `entry.href({ workspaceId })` → `/workspace/<id>/subscribe`; `route.exits.home/self/success`; `startCheckout(input: { workspaceId: string; priceId: string; successUrl: string; cancelUrl: string }): Promise<{ success: true; url: string } | { success: false; error: string }>`; `Messages['subscribe']` namespace (10.7's success copy lives here too).

Steps:

- [ ] Step: skip-check — if `stripe-review.md` row `subscribe-paywall` verdict is `skip`, mark this task skipped and stop.
- [ ] Step: Write `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/entry.ts`:

```ts
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

/**
 * SUBSCRIBE — the plan paywall for a workspace with no active subscription.
 *
 * URL: /workspace/:workspaceId/subscribe
 *
 * Deliberately a SIBLING of the `(app)` route group (not inside it) so it is
 * NOT subject to the `(app)` layout's billing gate — an unsubscribed owner must
 * be able to reach this page, otherwise the gate would redirect-loop.
 * Membership is still enforced by the parent `[workspaceId]` layout.
 */
const schema = z.object({
  workspaceId: z.string().regex(/^\d+$/),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params) => `/workspace/${p.workspaceId}/subscribe`,
  parse: (ctx: ParseContext) => schema.parse({ ...ctx.params }),
}
```

- [ ] Step: Write `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/success/entry.ts` (needed by this task's contract; 10.7 consumes it as-is):

```ts
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

/**
 * SUBSCRIBE / SUCCESS — Stripe Checkout return landing.
 *
 * URL: /workspace/:workspaceId/subscribe/success?session_id=cs_...
 *
 * Stripe redirects here after a completed Checkout. It lives UNDER `subscribe/`
 * (outside the `(app)` billing gate) so an owner whose subscription hasn't
 * synced yet isn't bounced before the webhook/sync confirms it.
 */
const schema = z.object({
  workspaceId: z.string().regex(/^\d+$/),
  sessionId:   z.string().optional(),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href: (p: Params) =>
    p.sessionId
      ? `/workspace/${p.workspaceId}/subscribe/success?session_id=${encodeURIComponent(p.sessionId)}`
      : `/workspace/${p.workspaceId}/subscribe/success`,
  parse: (ctx: ParseContext) =>
    schema.parse({
      workspaceId: ctx.params.workspaceId,
      sessionId:   ctx.searchParams.session_id,
    }),
}
```

- [ ] Step: Write `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/contract.ts`:

```ts
import { createRoute } from '@/lib/route-registry'
import { entry as workspaceEntry } from '../entry'
import { entry as successEntry } from './success/entry'
import { entry } from './entry'

/**
 * SUBSCRIBE contract.
 *
 * Exits:
 *   - `home`    → the billing-gated workspace home (once the sub is active).
 *   - `self`    → this paywall (Stripe cancel_url; built absolute by the section).
 *   - `success` → the post-checkout return page that handles the webhook race
 *                 (Stripe success_url; built absolute by the section).
 */
export const route = createRoute({
  entry,
  exits: {
    home:    (p: { workspaceId: string }) => workspaceEntry.href({ workspaceId: p.workspaceId }),
    self:    (p: { workspaceId: string }) => entry.href({ workspaceId: p.workspaceId }),
    success: (p: { workspaceId: string }) => successEntry.href({ workspaceId: p.workspaceId }),
  },
})

export type SubscribeExits = typeof route.exits
```

- [ ] Step: Write `state.ts`, `transition.ts`, `scene.ts`, `fixtures.ts` under `_sections/SubscribePanel/` (irene's, verbatim mechanics — only comments generalized):

`state.ts`:
```ts
/**
 * SubscribePanel state — the paywall plan picker.
 *
 * A click sets `redirecting` (keyed to the plan's priceId), calls the checkout
 * action, then assigns the returned hosted Stripe URL. On failure → `error`.
 * Mirrors the BillingPanel's redirect-via-action shape.
 */
export type State =
  | { status: 'idle' }
  | { status: 'redirecting'; target: string }
  | { status: 'error'; message: string }

export type Event =
  | { type: 'START'; target: string }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }
```

`transition.ts`:
```ts
import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'START') return { status: 'redirecting', target: event.target }
      break
    case 'redirecting':
      // Browser is navigating to Stripe; only an error interrupts.
      if (event.type === 'ERROR') return { status: 'error', message: event.message }
      break
    case 'error':
      if (event.type === 'RETRY') return { status: 'idle' }
      if (event.type === 'START') return { status: 'redirecting', target: event.target }
      break
  }
  return state
}
```

`scene.ts`:
```ts
import { createScene } from '@/lib/scene'
import { transition } from './transition'

export const scene = createScene(transition)
```

`fixtures.ts`:
```ts
import type { State } from './state'

/** One State per status — Suspense fallbacks and stories. */
export const fixtures: Record<State['status'], State> = {
  idle:        { status: 'idle' },
  redirecting: { status: 'redirecting', target: 'price_demo' },
  error:       { status: 'error', message: 'Could not start checkout. Try again.' },
}
```

- [ ] Step: Write `_sections/SubscribePanel/actions.ts` — irene's subscribe action reshaped per the review (`subscribe-paywall: generalize`): success/cancel URLs come from the SECTION as validated string params (the BillingPanel shape — actions never import route contracts), `requireOwnerE` → `requireWorkspaceRoleE(_, 'owner')`, priceId allowlist KEPT:

```ts
'use server'

import { Effect, pipe } from 'effect'
import { z } from 'zod'
import { runAction } from '@/lib/effect/run-action'
import { mapResult } from '@/lib/effect/boundary'
import { requireWorkspaceRoleE } from '@/lib/effect/auth'
import { validate } from '@/lib/effect/validate'
import { ExternalServiceError, ValidationFailed } from '@/lib/effect/errors'
import { isStripeConfigured } from '@/lib/stripe/client'
import { createCheckoutSession } from '@/lib/stripe/billing'
import { planByPriceId } from '@/lib/stripe/plans'
import { t } from '@/lib/i18n/messages'
import { getCurrentLocale } from '@/lib/i18n/getLocale'

/**
 * Subscribe paywall checkout. Gates on workspace OWNER (an owner without a
 * subscription is exactly who needs this; a member gets a typed Forbidden the
 * boundary maps to copy), then opens a Stripe subscription Checkout and RETURNS
 * the hosted URL as domain data — the section navigates. Success/cancel URLs
 * are built by the CLIENT section (which owns the route contract via
 * `route.exits.*`) and passed as plain string params — actions never import a
 * route contract.
 */

const checkoutSchema = z.object({
  workspaceId: z.string(),
  priceId:     z.string().min(1),
  successUrl:  z.string().url(),
  cancelUrl:   z.string().url(),
})

async function checkoutError(): Promise<string> {
  return t(await getCurrentLocale()).subscribe.error
}

const startCheckoutE = (raw: unknown) =>
  pipe(
    Effect.Do,
    Effect.bind('input', () => validate(checkoutSchema, raw)),
    // Allowlist: the priceId MUST be one of our known plan prices — never let a
    // client subscribe their workspace to an arbitrary Stripe price.
    Effect.tap(({ input }) =>
      planByPriceId(input.priceId)
        ? Effect.void
        : Effect.fail(new ValidationFailed({ message: 'Unknown plan price' })),
    ),
    Effect.tap(({ input }) => requireWorkspaceRoleE(input.workspaceId, 'owner')),
    Effect.bind('url', ({ input }) =>
      Effect.tryPromise({
        try: () =>
          createCheckoutSession({
            workspaceId: Number(input.workspaceId),
            priceId:     input.priceId,
            successUrl:  input.successUrl,
            cancelUrl:   input.cancelUrl,
          }),
        catch: (cause) => new ExternalServiceError({ service: 'stripe', cause }),
      }),
    ),
    Effect.map(({ url }) => ({ url })),
  )

export async function startCheckout(input: {
  workspaceId: string
  priceId:     string
  successUrl:  string
  cancelUrl:   string
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  if (!isStripeConfigured()) {
    return { success: false, error: await checkoutError() }
  }
  const result = await runAction(startCheckoutE(input), {
    actionName: 'subscribeCheckout',
    attributes: { workspaceId: input.workspaceId },
  })
  return mapResult(result, { fallback: await checkoutError() })
}
```

- [ ] Step: Write `_sections/SubscribePanel/Component.tsx` — irene's Component with the canonical token mapping applied (`charcoal`→`accent`, `terracotta`→`brand`, `honey`→`warning`, `sage-deep`→`success-deep`, `shadow-bento(-lg)`→`shadow-card(-lg)`, `label-mono`→`label-micro`) and the success/cancel URLs built here:

```tsx
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
```

- [ ] Step: Write `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/page.tsx`:

```tsx
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
```

- [ ] Step: edit `/Users/luca/dev/winter-park/template/lib/i18n/messages.ts` — three anchored edits (the `Messages` type plus BOTH locale objects; the file is phase 4's seed, structure: `export type Messages = { … }` then `const en: Messages = { … }` / `const ptBR: Messages = { … }`):
  1. Add to the `Messages` type as a new top-level key (after the last existing namespace):
     ```ts
     subscribe: {
       kicker:      string
       title:       string
       subtitle:    string
       perMonth:    string
       subscribe:   string
       recommended: string
       error:       string
       plans: {
         basic:   { name: string }
         pro:     { name: string }
         premium: { name: string }
       }
       features: {
         core:            string
         oneWorkspace:    string
         everythingBasic: string
         advanced:        string
         team:            string
         everythingPro:   string
         priority:        string
         api:             string
       }
       success: {
         title:    string
         subtitle: string
         retry:    string
       }
     }
     ```
  2. Add to the `en` object:
     ```ts
     subscribe: {
       kicker:      'Choose a plan',
       title:       'Pick a plan to continue',
       subtitle:    'Your workspace is ready. Choose a subscription to unlock the app.',
       perMonth:    '/mo',
       subscribe:   'Subscribe',
       recommended: 'Recommended',
       error:       'Could not start checkout right now. Please try again.',
       plans: {
         basic:   { name: 'Basic' },
         pro:     { name: 'Pro' },
         premium: { name: 'Premium' },
       },
       features: {
         core:            'Core features',
         oneWorkspace:    'Single workspace',
         everythingBasic: 'Everything in Basic',
         advanced:        'Advanced features',
         team:            'Team management',
         everythingPro:   'Everything in Pro',
         priority:        'Priority support',
         api:             'API access',
       },
       success: {
         title:    'Activating your subscription…',
         subtitle: 'This only takes a moment. We are confirming your payment.',
         retry:    'Taking longer than expected? Refresh this page.',
       },
     },
     ```
  3. Add to the `ptBR` object:
     ```ts
     subscribe: {
       kicker:      'Escolha um plano',
       title:       'Escolha um plano para continuar',
       subtitle:    'Seu workspace está pronto. Escolha uma assinatura para liberar o app.',
       perMonth:    '/mês',
       subscribe:   'Assinar',
       recommended: 'Recomendado',
       error:       'Não foi possível iniciar o checkout agora. Tente novamente.',
       plans: {
         basic:   { name: 'Básico' },
         pro:     { name: 'Pro' },
         premium: { name: 'Premium' },
       },
       features: {
         core:            'Recursos essenciais',
         oneWorkspace:    'Um workspace',
         everythingBasic: 'Tudo do Básico',
         advanced:        'Recursos avançados',
         team:            'Gestão de equipe',
         everythingPro:   'Tudo do Pro',
         priority:        'Suporte prioritário',
         api:             'Acesso à API',
       },
       success: {
         title:    'Ativando sua assinatura…',
         subtitle: 'Isso leva só um instante. Estamos confirmando seu pagamento.',
         retry:    'Demorando mais que o esperado? Atualize esta página.',
       },
     },
     ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0 (also proves 10.5's gate import now resolves). Run: `grep -rn 'salon\|charcoal\|terracotta\|honey\|sage\|bento\|label-mono' "app/workspace/[workspaceId]/subscribe"` → expected: no matches.
- [ ] Step: commit:
  ```bash
  git add "app/workspace/[workspaceId]/subscribe" lib/i18n/messages.ts
  git commit -m "backport(billing): /workspace/[id]/subscribe paywall + SubscribePanel + subscribe messages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.7: Post-payment landing — success route + CheckoutSuccess poller

**Files:**
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/success/contract.ts` (entry.ts was created in 10.6)
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/success/page.tsx`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/success/_sections/CheckoutSuccess/state.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/success/_sections/CheckoutSuccess/transition.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/success/_sections/CheckoutSuccess/scene.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/success/_sections/CheckoutSuccess/fixtures.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/success/_sections/CheckoutSuccess/actions.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/success/_sections/CheckoutSuccess/usePollActive.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/subscribe/success/_sections/CheckoutSuccess/Component.tsx`

**Interfaces:**
- Consumes: `syncWorkspaceFromCheckoutSession`/`getBillingState`/`isSubscriptionActive`/`isStripeConfigured` (10.3); `runAction`/`mapResult`/`validate`/`dbE` (phase 3); `requireWorkspaceRoleE` (phase 6.4); `useRedirectOnSuccess(state, reset, delay?)` from `@/lib/hooks/useRedirectOnSuccess` (existing template); `Tile`/`IconChip` (phase 8); `useT` (phase 4); `m.subscribe.success` messages (10.6).
- Produces: `checkActive(input: { workspaceId: string }): Promise<{ success: true; active: boolean } | { success: false; error: string }>`; success `route.exits.home/subscribe`; the landing behavior (immediate sync → poll → forward home).

Steps:

- [ ] Step: skip-check — if `stripe-review.md` row `post-payment-landing` verdict is `skip`, mark this task skipped and stop.
- [ ] Step: Write `success/contract.ts`:

```ts
import { createRoute } from '@/lib/route-registry'
import { entry as workspaceEntry } from '../../entry'
import { entry as subscribeEntry } from '../entry'
import { entry } from './entry'

/**
 * SUBSCRIBE / SUCCESS contract.
 *
 * Exits:
 *   - `home`      → the billing-gated workspace home — where a freshly
 *                   subscribed workspace lands once the subscription confirms
 *                   active.
 *   - `subscribe` → back to the paywall (e.g. checkout never completed).
 */
export const route = createRoute({
  entry,
  exits: {
    home:      (p: { workspaceId: string }) => workspaceEntry.href({ workspaceId: p.workspaceId }),
    subscribe: (p: { workspaceId: string }) => subscribeEntry.href({ workspaceId: p.workspaceId }),
  },
})

export type SubscribeSuccessExits = typeof route.exits
```

- [ ] Step: Write `_sections/CheckoutSuccess/state.ts`:

```ts
/**
 * CheckoutSuccess state — the post-checkout poller.
 *
 * The page already attempted an immediate sync. If that hasn't landed yet this
 * section polls `checkActive` until the workspace's subscription reads active,
 * then forwards home. `pending` waits; `success` carries the redirect target so
 * `useRedirectOnSuccess` forwards there.
 */
export type State =
  | { status: 'pending' }
  | { status: 'success'; redirectTo: string }

export type Event =
  | { type: 'ACTIVE'; redirectTo: string }
```

- [ ] Step: Write `_sections/CheckoutSuccess/transition.ts`:

```ts
import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  if (state.status === 'pending' && event.type === 'ACTIVE') {
    return { status: 'success', redirectTo: event.redirectTo }
  }
  return state
}
```

- [ ] Step: Write `_sections/CheckoutSuccess/scene.ts`:

```ts
import { createScene } from '@/lib/scene'
import { transition } from './transition'

export const scene = createScene(transition)
```

- [ ] Step: Write `_sections/CheckoutSuccess/fixtures.ts`:

```ts
import type { State } from './state'

/** One State per status — Suspense fallbacks and stories. */
export const fixtures: Record<State['status'], State> = {
  pending: { status: 'pending' },
  success: { status: 'success', redirectTo: '/workspace/1' },
}
```

- [ ] Step: Write `_sections/CheckoutSuccess/actions.ts` (irene's with `requireOwnerE` → `requireWorkspaceRoleE(_, 'owner')`, salonId → workspaceId):

```ts
'use server'

import { Effect, pipe } from 'effect'
import { z } from 'zod'
import { runAction } from '@/lib/effect/run-action'
import { mapResult } from '@/lib/effect/boundary'
import { requireWorkspaceRoleE } from '@/lib/effect/auth'
import { validate } from '@/lib/effect/validate'
import { dbE } from '@/lib/effect/db'
import { getBillingState } from '@/lib/stripe/billing'
import { isSubscriptionActive } from '@/lib/stripe/active'

/**
 * Poll loader for the checkout-return page. Gates on the workspace owner, then
 * reads the workspace's current billing status (synced by the webhook and/or
 * the page's immediate sync) and reports whether it's active yet. The client
 * section polls this until `active` flips true, then forwards home.
 *
 * Returns domain data only — the section maps `active` to a route exit itself.
 */

const schema = z.object({ workspaceId: z.string() })

const checkActiveE = (raw: unknown) =>
  pipe(
    Effect.Do,
    Effect.bind('input', () => validate(schema, raw)),
    Effect.tap(({ input }) => requireWorkspaceRoleE(input.workspaceId, 'owner')),
    Effect.bind('status', ({ input }) =>
      dbE.try(() => getBillingState(Number(input.workspaceId))),
    ),
    Effect.map(({ status }) => ({ active: isSubscriptionActive(status.status) })),
  )

export async function checkActive(input: {
  workspaceId: string
}): Promise<{ success: true; active: boolean } | { success: false; error: string }> {
  const result = await runAction(checkActiveE(input), {
    actionName: 'checkSubscriptionActive',
    attributes: { workspaceId: input.workspaceId },
  })
  return mapResult(result, { fallback: 'error' })
}
```

- [ ] Step: Write `_sections/CheckoutSuccess/usePollActive.ts` (irene's, salonId → workspaceId, forward comment generalized):

```ts
'use client'

import { useEffect } from 'react'
import type { State, Event } from './state'
import { checkActive } from './actions'

/**
 * Polls `checkActive(workspaceId)` every `intervalMs` while in `pending`. When
 * the workspace reads active, sends `ACTIVE` with the post-payment forward
 * target so the section transitions to `success` and `useRedirectOnSuccess`
 * forwards there. Stops as soon as we leave `pending`. Keeps all timer/effect
 * logic out of the component (Flow Framework: hooks live in `.ts` files).
 */
export function usePollActive(
  state: State,
  send: (event: Event) => void,
  args: { workspaceId: string; forwardHref: string; intervalMs?: number },
): void {
  const { workspaceId, forwardHref, intervalMs = 1500 } = args

  useEffect(() => {
    if (state.status !== 'pending') return
    let cancelled = false

    const tick = async () => {
      const result = await checkActive({ workspaceId })
      if (cancelled) return
      if (result.success && result.active) {
        send({ type: 'ACTIVE', redirectTo: forwardHref })
      }
    }

    // Probe immediately, then on an interval until active or unmounted.
    void tick()
    const id = setInterval(() => void tick(), intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [state.status, workspaceId, forwardHref, intervalMs, send])
}
```

- [ ] Step: Write `_sections/CheckoutSuccess/Component.tsx` (irene's with tokens mapped `charcoal`→`accent` and forward target → workspace home):

```tsx
'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { Tile } from '@/components/ui/Tile'
import { IconChip } from '@/components/ui/IconChip'
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
import { useT } from '@/lib/i18n/LocaleProvider'
import { route } from '../../contract'
import { scene } from './scene'
import { fixtures } from './fixtures'
import { usePollActive } from './usePollActive'
import type { State } from './state'

type Props = {
  workspaceId:   string
  initialState?: State
}

/**
 * CheckoutSuccess — post-Stripe-Checkout return.
 *
 * The page already attempted an immediate sync from the Checkout Session. If
 * the subscription is still settling (webhook race), this section polls until
 * the workspace reads active, then forwards home via `useRedirectOnSuccess`.
 * Renders a calm "activating…" state meanwhile.
 */
export function CheckoutSuccess({ workspaceId, initialState }: Props) {
  const [state, send, reset] = scene.useScene(initialState ?? fixtures.pending)
  useRedirectOnSuccess(state, reset, 300)
  usePollActive(state, send, { workspaceId, forwardHref: route.exits.home({ workspaceId }) })
  const m = useT().subscribe.success

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <Tile tone="accent" className="flex w-full flex-col items-center gap-5 p-10">
        <IconChip tone="plain" size="lg" className="bg-accent-foreground/15 text-accent-foreground">
          {state.status === 'success' ? <Sparkles aria-hidden /> : <Loader2 aria-hidden className="animate-spin" />}
        </IconChip>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-accent-foreground">{m.title}</h1>
          <p className="text-sm text-accent-foreground/75">{m.subtitle}</p>
        </div>
        <p className="text-xs text-accent-foreground/55">{m.retry}</p>
      </Tile>
    </main>
  )
}
```

- [ ] Step: Write `success/page.tsx` (irene's with `syncSalonFromCheckoutSession` → `syncWorkspaceFromCheckoutSession`, forward `/setup` → workspace home; KEEP `redirect()` OUTSIDE try/catch — control-flow throw):

```tsx
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
```

- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -rn 'salon\|charcoal\|setup' "app/workspace/[workspaceId]/subscribe/success"` → expected: no matches.
- [ ] Step: commit:
  ```bash
  git add "app/workspace/[workspaceId]/subscribe/success"
  git commit -m "backport(billing): post-payment landing — immediate sync + CheckoutSuccess poller

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.8: Billing page — cancel-at-period-end / resume / portal + `billing` messages

**Files:**
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/(app)/billing/entry.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/(app)/billing/contract.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/(app)/billing/page.tsx`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/(app)/billing/_sections/BillingPanel/state.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/(app)/billing/_sections/BillingPanel/transition.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/(app)/billing/_sections/BillingPanel/scene.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/(app)/billing/_sections/BillingPanel/fixtures.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/(app)/billing/_sections/BillingPanel/actions.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/(app)/billing/_sections/BillingPanel/Component.tsx`
- Modify: `/Users/luca/dev/winter-park/template/lib/i18n/messages.ts` (add `billing` namespace — same 3-place anchored-edit pattern as 10.6)

**Interfaces:**
- Consumes: `createPortalSession`/`setSubscriptionCancellation`/`getBillingState`/`BillingState`/`planByTier`/`isStripeConfigured` (10.3); `runAction`/`mapResult`/`validate` + `ExternalServiceError`, `NotFound` (phase 3); `requireWorkspaceRoleE` (phase 6.4); `formatDate` (phase 4.6); `Tile`/`Button`/`PageHeader` (phase 8); `useT`/`useLocale`/`t`/`getCurrentLocale` (phase 4).
- Produces: `openPortal(input: { workspaceId: string; returnUrl: string })`, `cancelSubscriptionAtPeriodEnd(input: { workspaceId: string })`, `resumeSubscription(input: { workspaceId: string })` — each `Promise<{ success: true; … } | { success: false; error: string }>` (cancel/resume success carries `cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null`); `Messages['billing']`; billing entry `/workspace/<id>/billing`.

Steps:

- [ ] Step: skip-check — if `stripe-review.md` row `billing-panel` verdict is `skip`, mark this task skipped and stop.
- [ ] Step: Write `billing/entry.ts`:

```ts
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

/**
 * BILLING — the workspace owner's subscription management page.
 *
 * URL: /workspace/:workspaceId/billing
 *
 * Lives INSIDE the `(app)` billing gate on purpose: managing (cancel/resume/
 * portal) only makes sense for an active subscription; an inactive workspace
 * is redirected to /subscribe by the gate before reaching this page.
 */
const schema = z.object({
  workspaceId: z.string().regex(/^\d+$/),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params) => `/workspace/${p.workspaceId}/billing`,
  parse: (ctx: ParseContext) => schema.parse({ ...ctx.params }),
}
```

- [ ] Step: Write `billing/contract.ts`:

```ts
import { createRoute } from '@/lib/route-registry'
import { entry as workspaceEntry } from '../../entry'
import { entry as subscribeEntry } from '../../subscribe/entry'
import { entry } from './entry'

/**
 * BILLING contract.
 *
 * Exits:
 *   - `home`      → workspace home.
 *   - `subscribe` → the paywall (e.g. after a cancellation runs out).
 */
export const route = createRoute({
  entry,
  exits: {
    home:      (p: { workspaceId: string }) => workspaceEntry.href({ workspaceId: p.workspaceId }),
    subscribe: (p: { workspaceId: string }) => subscribeEntry.href({ workspaceId: p.workspaceId }),
  },
})

export type BillingExits = typeof route.exits
```

- [ ] Step: Write `_sections/BillingPanel/state.ts` (slim template state machine — irene's 406-line panel is `generalize slim` per the review):

```ts
/**
 * BillingPanel state — the workspace owner's view of the SaaS subscription.
 *
 * Type-5-ish client section (no form, but server actions drive it):
 * `redirecting` covers the Stripe portal handoff (`window.location.assign`);
 * `mutating` covers in-app cancel-at-period-end / resume (then
 * `router.refresh()` re-reads the synced billing state). Failures → `error`.
 */
export type State =
  | { status: 'idle' }
  | { status: 'redirecting' }
  | { status: 'mutating'; action: 'cancel' | 'resume' }
  | { status: 'error'; message: string }

export type Event =
  | { type: 'PORTAL' }
  | { type: 'MUTATE'; action: 'cancel' | 'resume' }
  | { type: 'DONE' }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }
```

- [ ] Step: Write `_sections/BillingPanel/transition.ts`:

```ts
import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'PORTAL') return { status: 'redirecting' }
      if (event.type === 'MUTATE') return { status: 'mutating', action: event.action }
      break
    case 'redirecting':
      // Browser is navigating to Stripe; only an error interrupts.
      if (event.type === 'ERROR') return { status: 'error', message: event.message }
      break
    case 'mutating':
      if (event.type === 'DONE') return { status: 'idle' }
      if (event.type === 'ERROR') return { status: 'error', message: event.message }
      break
    case 'error':
      if (event.type === 'RETRY') return { status: 'idle' }
      if (event.type === 'PORTAL') return { status: 'redirecting' }
      if (event.type === 'MUTATE') return { status: 'mutating', action: event.action }
      break
  }
  return state
}
```

- [ ] Step: Write `_sections/BillingPanel/scene.ts`:

```ts
import { createScene } from '@/lib/scene'
import { transition } from './transition'

export const scene = createScene(transition)
```

- [ ] Step: Write `_sections/BillingPanel/fixtures.ts`:

```ts
import type { State } from './state'

/** One State per status — Suspense fallbacks and stories. */
export const fixtures: Record<State['status'], State> = {
  idle:        { status: 'idle' },
  redirecting: { status: 'redirecting' },
  mutating:    { status: 'mutating', action: 'cancel' },
  error:       { status: 'error', message: 'Could not reach billing. Try again.' },
}
```

- [ ] Step: Write `_sections/BillingPanel/actions.ts` (irene's BillingPanel actions minus `startCheckout` — plan purchase lives on /subscribe; `requireOwnerE` → `requireWorkspaceRoleE(_, 'owner')`; salonId → workspaceId; messages keys per the `billing` namespace added below):

```ts
'use server'

import { Effect, pipe } from 'effect'
import { z } from 'zod'
import { runAction } from '@/lib/effect/run-action'
import { mapResult } from '@/lib/effect/boundary'
import { requireWorkspaceRoleE } from '@/lib/effect/auth'
import { validate } from '@/lib/effect/validate'
import { ExternalServiceError, NotFound } from '@/lib/effect/errors'
import { isStripeConfigured } from '@/lib/stripe/client'
import { createPortalSession, setSubscriptionCancellation } from '@/lib/stripe/billing'
import { t } from '@/lib/i18n/messages'
import { getCurrentLocale } from '@/lib/i18n/getLocale'

/**
 * Billing actions. Each gates on the workspace OWNER (typed), then calls a
 * `lib/stripe/billing.ts` helper and RETURNS the hosted Stripe URL (portal) or
 * the new cancellation state as domain data — the section navigates/refreshes,
 * never these actions. Stripe is an external dependency: its promise is wrapped
 * in `Effect.tryPromise` → `ExternalServiceError`, not `dbE`.
 *
 * The portal return URL is built by the CLIENT section (which owns the route
 * contract via `route.entry.href`) and passed as a plain string param —
 * actions never import a route contract.
 */

const portalSchema = z.object({
  workspaceId: z.string(),
  returnUrl:   z.string().url(),
})

const cancelSchema = z.object({
  workspaceId: z.string(),
})

async function billingError(): Promise<string> {
  return t(await getCurrentLocale()).billing.errors.generic
}

async function noSubscriptionError(): Promise<string> {
  return t(await getCurrentLocale()).billing.errors.noSubscription
}

const openPortalE = (raw: unknown) =>
  pipe(
    Effect.Do,
    Effect.bind('input', () => validate(portalSchema, raw)),
    Effect.tap(({ input }) => requireWorkspaceRoleE(input.workspaceId, 'owner')),
    Effect.bind('url', ({ input }) =>
      Effect.tryPromise({
        try: () =>
          createPortalSession({
            workspaceId: Number(input.workspaceId),
            returnUrl:   input.returnUrl,
          }),
        catch: (cause) => new ExternalServiceError({ service: 'stripe', cause }),
      }),
    ),
    Effect.map(({ url }) => ({ url })),
  )

export async function openPortal(input: {
  workspaceId: string
  returnUrl:   string
}): Promise<{ success: true; url: string } | { success: false; error: string }> {
  if (!isStripeConfigured()) {
    return { success: false, error: await billingError() }
  }
  const result = await runAction(openPortalE(input), {
    actionName: 'openPortal',
    attributes: { workspaceId: input.workspaceId },
  })
  return mapResult(result, { fallback: await billingError() })
}

/**
 * Direct cancel/resume of the workspace's subscription — the in-app alternative
 * to routing the owner through the Stripe Customer Portal. `cancel: true`
 * schedules cancellation at period end (access kept until `currentPeriodEnd`);
 * `false` undoes it. Owner-gated; `setSubscriptionCancellation` is the sole
 * Stripe path and writes the workspaces row (read-your-own-writes). A workspace
 * with no real Stripe subscription fails as `NotFound` → graceful message.
 */
const setCancelE = (raw: unknown, cancel: boolean) =>
  pipe(
    Effect.Do,
    Effect.bind('input', () => validate(cancelSchema, raw)),
    Effect.tap(({ input }) => requireWorkspaceRoleE(input.workspaceId, 'owner')),
    Effect.bind('result', ({ input }) =>
      Effect.tryPromise({
        try: () =>
          setSubscriptionCancellation({ workspaceId: Number(input.workspaceId), cancel }),
        catch: (cause) => new ExternalServiceError({ service: 'stripe', cause }),
      }),
    ),
    Effect.flatMap(({ result }) =>
      result.ok
        ? Effect.succeed({
            cancelAtPeriodEnd: result.cancelAtPeriodEnd,
            currentPeriodEnd:  result.currentPeriodEnd,
          })
        : Effect.fail(new NotFound({ entity: 'subscription' })),
    ),
  )

type CancelResult =
  | { success: true; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null }
  | { success: false; error: string }

export async function cancelSubscriptionAtPeriodEnd(input: {
  workspaceId: string
}): Promise<CancelResult> {
  if (!isStripeConfigured()) {
    return { success: false, error: await billingError() }
  }
  const result = await runAction(setCancelE(input, true), {
    actionName: 'cancelSubscriptionAtPeriodEnd',
    attributes: { workspaceId: input.workspaceId },
  })
  return mapResult(result, {
    fallback: await billingError(),
    notFound: await noSubscriptionError(),
  })
}

export async function resumeSubscription(input: {
  workspaceId: string
}): Promise<CancelResult> {
  if (!isStripeConfigured()) {
    return { success: false, error: await billingError() }
  }
  const result = await runAction(setCancelE(input, false), {
    actionName: 'resumeSubscription',
    attributes: { workspaceId: input.workspaceId },
  })
  return mapResult(result, {
    fallback: await billingError(),
    notFound: await noSubscriptionError(),
  })
}
```

- [ ] Step: Write `_sections/BillingPanel/Component.tsx` (slim template surface — full content, no irene UI copied):

```tsx
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
```

- [ ] Step: Write `billing/page.tsx`:

```tsx
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
```

- [ ] Step: edit `/Users/luca/dev/winter-park/template/lib/i18n/messages.ts` — add the `billing` namespace in the same 3 anchored places as 10.6 (type + `en` + `ptBR`):
  Type:
  ```ts
  billing: {
    kicker:      string
    title:       string
    subtitle:    string
    currentPlan: string
    unknownPlan: string
    manage:      string
    renewsOn:    (date: string) => string
    endsOn:      (date: string) => string
    cancel:      string
    resume:      string
    errors: {
      generic:        string
      noSubscription: string
    }
  }
  ```
  `en`:
  ```ts
  billing: {
    kicker:      'Billing',
    title:       'Plan & billing',
    subtitle:    'Manage your subscription — cancel, resume, or update payment details.',
    currentPlan: 'Current plan',
    unknownPlan: 'Subscription',
    manage:      'Manage subscription',
    renewsOn:    (date: string) => `Renews on ${date}`,
    endsOn:      (date: string) => `Access ends on ${date}`,
    cancel:      'Cancel subscription',
    resume:      'Resume subscription',
    errors: {
      generic:        'Could not reach billing right now. Please try again.',
      noSubscription: 'There is no active subscription to cancel.',
    },
  },
  ```
  `ptBR`:
  ```ts
  billing: {
    kicker:      'Cobrança',
    title:       'Plano e cobrança',
    subtitle:    'Gerencie sua assinatura — cancele, retome ou atualize os dados de pagamento.',
    currentPlan: 'Plano atual',
    unknownPlan: 'Assinatura',
    manage:      'Gerenciar assinatura',
    renewsOn:    (date: string) => `Renova em ${date}`,
    endsOn:      (date: string) => `Acesso encerra em ${date}`,
    cancel:      'Cancelar assinatura',
    resume:      'Retomar assinatura',
    errors: {
      generic:        'Não foi possível acessar a cobrança agora. Tente novamente.',
      noSubscription: 'Não há assinatura ativa para cancelar.',
    },
  },
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -rn 'salon' "app/workspace/[workspaceId]/(app)/billing"` → expected: no matches.
- [ ] Step: commit:
  ```bash
  git add "app/workspace/[workspaceId]/(app)/billing" lib/i18n/messages.ts
  git commit -m "backport(billing): billing page — cancel-at-period-end/resume/portal + billing messages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.9: Billing docs + env vars + CLAUDE.md row

**Files:**
- Create: `/Users/luca/dev/winter-park/template/docs/billing.md`
- Modify: `/Users/luca/dev/winter-park/template/.env.example` (append 3 price-id vars to the Stripe block phase 1 created)
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (doc-table row — anchored)

**Interfaces:**
- Consumes: everything 10.2–10.8 shipped.
- Produces: `docs/billing.md` (living doc served at `/docs`); documented env contract `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASIC/PRO/PREMIUM`.

Steps:

- [ ] Step: skip-check — if ALL of `stripe-review.md` rows 10.2–10.8 reference were `skip`, skip this task. If only SOME were skipped, still write the doc but state what shipped.
- [ ] Step: Write `/Users/luca/dev/winter-park/template/docs/billing.md`:

```markdown
---
title: Billing
order: 17
category: Patterns
---

# Workspace Billing (Stripe)

Workspace-scoped SaaS subscriptions on Stripe. FEATURE-GATED by env presence:
without `STRIPE_SECRET_KEY` every gate is inert and the app runs subscription-free.

## What ships

| Piece | Where |
|---|---|
| Env-gated client (`stripe`, `getStripe`, `isStripeConfigured`) | `lib/stripe/client.ts` |
| Placeholder plans (env-overridable price ids) | `lib/stripe/plans.ts` |
| Active definition (status ∈ {active, trialing}) | `lib/stripe/active.ts` |
| Billing core (checkout, portal, cancel/resume, post-checkout sync) | `lib/stripe/billing.ts` |
| Action-level gate → `SubscriptionInactive({ workspaceId })` | `lib/stripe/require-active-subscription.ts` |
| Webhook (signature-verified subscription sync) | `app/api/stripe/webhook/route.ts` |
| Layout gate + escape routes | `app/workspace/[workspaceId]/(app)/layout.tsx`, `subscribe/`, `subscribe/success/` |
| Cancel/resume/portal UI | `app/workspace/[workspaceId]/(app)/billing/` |

## Gate topology (do not break)

```
app/workspace/[workspaceId]/
  layout.tsx        ← membership guard (requireWorkspaceRole)
  (app)/
    layout.tsx      ← BILLING GATE: inactive → redirect /subscribe
    page.tsx        ← workspace home (gated)
    billing/        ← manage subscription (gated — needs an active sub)
  subscribe/        ← ESCAPE ROUTE: sibling of (app), NEVER inside it
    success/        ← Stripe return; syncs + polls, then forwards home
```

- ONE chokepoint: the `(app)` layout. Everything subscription-gated goes inside
  the group; the redirect targets (`/subscribe`, `/subscribe/success`) stay
  outside it, or the gate redirect-loops.
- The app reads its OWN `workspaces` row (synced by the webhook + the
  post-checkout sync) — never Stripe on the read path.
- `isSubscriptionActive` is the single source of truth for "active". Import it;
  never re-define the status set.
- Defense-in-depth: tap `requireActiveSubscriptionE(workspaceId)` in a
  workspace's MAIN write actions so a stale client fails CLOSED with a typed
  `SubscriptionInactive` (mapped by `mapResult`'s `subscriptionInactive` copy).
- Members vs owners: the gate redirects EVERY member of an inactive workspace
  to `/subscribe`; only the `owner` role can check out (action-gated). If your
  app wants a read-only "workspace paused" notice for non-owners instead, add
  an ungated sibling route (irene's `/inactive` pattern) and branch the gate on
  the viewer's role.

## Setup runbook

1. `STRIPE_SECRET_KEY` — test-mode secret key. Its presence ACTIVATES the gates.
2. Create three monthly prices; set `STRIPE_PRICE_BASIC/PRO/PREMIUM` (placeholder
   amounts live in `lib/stripe/plans.ts`; copy in `lib/i18n` `subscribe.*`).
3. `STRIPE_WEBHOOK_SECRET` — from `stripe listen --forward-to
   localhost:3000/api/stripe/webhook` (dev) or the dashboard endpoint (prod).
4. The webhook handles `customer.subscription.created/updated/deleted`. The
   success page ALSO syncs directly from the Checkout Session to sidestep the
   webhook race — both writes are idempotent (last-writer-wins on identical data).

## Invariants

- Checkout priceId is allowlisted against `PLANS` — never trust a client price.
- `redirect()` stays OUTSIDE try/catch on the success page (control-flow throw).
- Keep the two-level `current_period_end` fallback (subscription → first item) —
  Stripe API versions move this field.
- Actions never import route contracts: success/cancel/return URLs are built by
  the client section that owns the contract and passed as validated strings.
```

- [ ] Step: edit `/Users/luca/dev/winter-park/template/.env.example` — inside the Stripe block (phase 1 created `STRIPE_SECRET_KEY=` / `STRIPE_WEBHOOK_SECRET=`), append after `STRIPE_WEBHOOK_SECRET=`:
  ```
  # Monthly price ids for the placeholder plans (lib/stripe/plans.ts). Create real
  # prices in the Stripe dashboard and point these at them; code has placeholders.
  STRIPE_PRICE_BASIC=
  STRIPE_PRICE_PRO=
  STRIPE_PRICE_PREMIUM=
  ```
- [ ] Step: edit `/Users/luca/dev/winter-park/template/CLAUDE.md` — in the docs table, insert after the `| [\`planning.md\`](docs/planning.md) | Design flow specs, planning process, implementation handoff |` row:
  ```markdown
  | [`billing.md`](docs/billing.md) | Workspace billing: Stripe gates, escape-route topology, cancel/resume, webhook |
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -c 'STRIPE_PRICE' .env.example` → expected: 3.
- [ ] Step: commit:
  ```bash
  git add docs/billing.md .env.example CLAUDE.md
  git commit -m "docs(billing): billing doc + price-id env vars + CLAUDE.md doc row

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

## Sub-effort B: AI stack (unconditional)

### Task 10.10: `ai` dep + `lib/capabilities/` — types (parameterized CapCtx), empty registry, resolve shape

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/package.json` (add dependency)
- Create: `/Users/luca/dev/winter-park/template/lib/capabilities/types.ts` (port of irene's 38 lines — CapCtx defined here instead of imported from `lib/control-panel/assistant/context`)
- Create: `/Users/luca/dev/winter-park/template/lib/capabilities/registry.ts` (EMPTY registry — irene's 89-line salon catalog is NOT copied; only the mechanics)
- Create: `/Users/luca/dev/winter-park/template/lib/capabilities/resolve.ts` (SHAPE only — irene's 192 lines are 100% salon-domain resolvers; only the conventions + helpers port)
- Test: `/Users/luca/dev/winter-park/template/lib/capabilities/resolve.test.ts`

**Interfaces:**
- Consumes: `zod` (existing dep); `type Locale` from `@/lib/i18n/types` (phase 4.1).
- Produces (10.11, 10.16 and app code consume):
  - `interface CapCtx { workspaceId: string; userId: string; locale: Locale; timeZone: string; nowIso: string }` (app-extensible via module augmentation)
  - `type CapNotFound = { error: 'not_found'; searchedFor: string }`; `type CapPreview = { title: string; lines: string[] }`
  - `type AiAdapter<In> = { describe: string; aiSchema?: z.ZodTypeAny; resolve: (ctx: CapCtx, aiArgs: unknown) => Promise<In | CapNotFound>; preview?: (ctx: CapCtx, input: In) => Promise<CapPreview>; summarize?: (ctx: CapCtx, input: In, out: unknown) => { ok: boolean; summary: string } }`
  - `type ActionCapability<In, Out> = { id: string; kind: 'action'; schema: z.ZodType<In>; run: (input: In) => Promise<Out>; ai?: AiAdapter<In> }`
  - `type QueryCapability<In, Out> = { id: string; kind: 'query'; schema: z.ZodType<In>; run: (input: In) => Promise<Out>; ai?: Pick<AiAdapter<In>, 'describe' | 'aiSchema' | 'resolve'> }`
  - `type Capability`; identity helpers `actionCapability`, `queryCapability`
  - `CAPABILITIES: Record<string, Capability>`, `ACTION_CAPS: ActionCapability<unknown, unknown>[]`, `QUERY_CAPS: QueryCapability<unknown, unknown>[]`, `getCapability(id: string): Capability | undefined`
  - `notFound(searchedFor: string): CapNotFound`, `isCapNotFound(x: unknown): x is CapNotFound`, `type EntityResolver<Row> = (workspaceId: string, name: string) => Promise<Row | null>`

Steps:

- [ ] Step: install dep — Run: `cd /Users/luca/dev/winter-park/template && npm install ai@^7.0.2` → expected: exit 0; `grep '"ai"' package.json` shows `"ai": "^7.0.2"`. (No template module imports it yet — it is the AI SDK the generated tool catalog is wired into; `docs/capabilities.md` (10.16) shows the wiring.)
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/capabilities/types.ts` (irene's file with these generalizations: L2 `import type { AssistantCtx } from '@/lib/control-panel/assistant/context'` and L4-5 `CapCtx = AssistantCtx` replaced by a locally-defined, workspace-scoped `CapCtx`; "Irene-only adapter" → "AI-only adapter"; salon comment → workspace):

```ts
import { z } from 'zod'
import type { Locale } from '@/lib/i18n/types'

/**
 * The authorized, workspace-scoped context every capability + AI tool closes
 * over. Built ONCE, AFTER the user is authorized on `workspaceId`, and captured
 * in a closure shared by every tool — a tool can only ever read/write data for
 * `ctx.workspaceId`, so an assistant is EXACTLY as capable as the logged-in
 * user. `workspaceId` is never a tool argument the model can set.
 *
 * Apps extend it (formatter bags, currency, the original question, …) via
 * module augmentation:
 *
 *   declare module '@/lib/capabilities/types' {
 *     interface CapCtx { currency: string; money: (n: number) => string }
 *   }
 */
export interface CapCtx {
  /** The ONLY workspace any tool may touch — fixed at authorization, never an arg. */
  workspaceId: string
  /** The acting user (for audit / rate-limit attribution). */
  userId:      string
  locale:      Locale
  timeZone:    string
  /** The instant `ctx` was built, as an ISO/UTC string — the assistant's "now". */
  nowIso:      string
}

export type CapNotFound = { error: 'not_found'; searchedFor: string }
export type CapPreview  = { title: string; lines: string[] }

/** The AI-only adapter. Present ⇒ the capability is exposed to the agent. */
export type AiAdapter<In> = {
  describe:   string
  /** LLM-facing args (names). Defaults to the capability `schema` when omitted. */
  aiSchema?:  z.ZodTypeAny
  /** Turn loose LLM args into the canonical input (names→ids). Reads only. */
  resolve:    (ctx: CapCtx, aiArgs: unknown) => Promise<In | CapNotFound>
  /** Confirm-card text (writes only). */
  preview?:   (ctx: CapCtx, input: In) => Promise<CapPreview>
  /** Map the canonical action result → a one-line confirm summary (writes only). */
  summarize?: (ctx: CapCtx, input: In, out: unknown) => { ok: boolean; summary: string }
}

export type ActionCapability<In, Out> = {
  id: string; kind: 'action'
  schema: z.ZodType<In>
  run: (input: In) => Promise<Out>           // the EXISTING server action
  ai?: AiAdapter<In>
}
export type QueryCapability<In, Out> = {
  id: string; kind: 'query'
  schema: z.ZodType<In>
  run: (input: In) => Promise<Out>           // the EXISTING 'use cache' query
  ai?: Pick<AiAdapter<In>, 'describe' | 'aiSchema' | 'resolve'>
}
export type Capability = ActionCapability<unknown, unknown> | QueryCapability<unknown, unknown>

export function actionCapability<In, Out>(c: ActionCapability<In, Out>): ActionCapability<In, Out> { return c }
export function queryCapability<In, Out>(c: QueryCapability<In, Out>): QueryCapability<In, Out> { return c }
```

- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/capabilities/registry.ts` (irene's mechanics, EMPTY catalog):

```ts
import type { Capability, ActionCapability, QueryCapability } from './types'

/**
 * The Capability Registry — every app OPERATION registers here exactly once.
 * Ships EMPTY: as features grow, co-locate a `capability.ts` beside the section
 * that owns the operation, import it here, and add it to `ALL`:
 *
 *   import { createProjectCap } from '@/app/workspace/[workspaceId]/(app)/projects/_sections/ProjectForm/capability'
 *   const ALL: Capability[] = [createProjectCap as Capability]
 *
 * See docs/capabilities.md for the full contract and a worked example.
 */
const ALL: Capability[] = []

export const CAPABILITIES: Record<string, Capability> = Object.fromEntries(ALL.map((c) => [c.id, c]))
export const ACTION_CAPS = ALL.filter((c): c is ActionCapability<unknown, unknown> => c.kind === 'action')
export const QUERY_CAPS  = ALL.filter((c): c is QueryCapability<unknown, unknown> => c.kind === 'query')
export function getCapability(id: string): Capability | undefined { return CAPABILITIES[id] }
```

- [ ] Step: write failing test FIRST — Write `/Users/luca/dev/winter-park/template/lib/capabilities/resolve.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isCapNotFound, notFound } from './resolve'

describe('capability not-found sentinel', () => {
  it('builds the sentinel shape', () => {
    expect(notFound('Jane')).toEqual({ error: 'not_found', searchedFor: 'Jane' })
  })

  it('guards the sentinel and rejects everything else', () => {
    expect(isCapNotFound(notFound('x'))).toBe(true)
    expect(isCapNotFound({ error: 'not_found', searchedFor: 'y' })).toBe(true)
    expect(isCapNotFound({ error: 'other' })).toBe(false)
    expect(isCapNotFound({ id: 1 })).toBe(false)
    expect(isCapNotFound(null)).toBe(false)
    expect(isCapNotFound('not_found')).toBe(false)
  })
})
```

  Run: `npx vitest run lib/capabilities/resolve.test.ts` → expected: FAIL (module `./resolve` not found).
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/capabilities/resolve.ts` (the SHAPE of irene's salon resolvers — helper + conventions only, zero domain content):

```ts
import type { CapNotFound } from './types'

/**
 * Name → id resolution conventions for capability `ai.resolve` adapters.
 *
 * The model only ever passes a free-text NAME; a resolver is the
 * workspace-scoped boundary that turns that name into a real, owned id. A
 * non-match returns `null` — the adapter then returns `notFound(name)` and the
 * tool REFUSES rather than inventing a record. Rules every resolver follows:
 *
 *   - WORKSPACE-SCOPED: every query filters on the workspace id from `ctx` —
 *     never an LLM argument.
 *   - READ-ONLY: resolvers run inside preview/execute paths; they never mutate.
 *   - LIVE reads (uncached): a proposal's figures and an execute's
 *     re-verification must reflect current state.
 *
 * Shape (implement per entity in your app, e.g. lib/capabilities/resolvers.ts):
 *
 *   export type ProjectRow = { id: string; name: string }
 *   export const resolveProjectRow: EntityResolver<ProjectRow> =
 *     async (workspaceId, name) => { … fuzzy match, workspace-scoped … }
 */
export type EntityResolver<Row> = (workspaceId: string, name: string) => Promise<Row | null>

/** Build the "could not resolve this entity" sentinel an `ai.resolve` returns. */
export const notFound = (searchedFor: string): CapNotFound => ({ error: 'not_found', searchedFor })

/** Guard for the sentinel — tools/generators short-circuit on it. */
export function isCapNotFound(x: unknown): x is CapNotFound {
  return !!x && typeof x === 'object' && (x as { error?: string }).error === 'not_found'
}
```

  Run: `npx vitest run lib/capabilities/resolve.test.ts` → expected: PASS (2 tests).
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -rn 'salon\|[Ii]rene\|control-panel' lib/capabilities/` → expected: no matches.
- [ ] Step: commit:
  ```bash
  git add package.json package-lock.json lib/capabilities
  git commit -m "backport(ai): capability registry skeleton — parameterized CapCtx, empty registry, resolve shape

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.11: Tools-from-capabilities generator (TDD)

**Files:**
- Test: `/Users/luca/dev/winter-park/template/lib/capabilities/tools.test.ts` (written FIRST)
- Create: `/Users/luca/dev/winter-park/template/lib/capabilities/tools.ts` (generalized port of irene's `lib/control-panel/assistant/tools/from-capabilities.ts` (71 lines) + the tool shapes from `…/tools/types.ts` (65 lines) folded in — irene's live in the salon assistant dir; template gets one self-contained module)

**Interfaces:**
- Consumes: `CapCtx`, `ActionCapability`, `QueryCapability`, `CapNotFound` (10.10 types); `ACTION_CAPS`, `QUERY_CAPS` (10.10 registry); `isCapNotFound` (10.10 resolve); `zod`.
- Produces:
  - `type ReadTool = { name: string; kind: 'read'; description: string; parameters: z.ZodTypeAny; execute: (ctx: CapCtx, args: unknown) => Promise<unknown> }`
  - `type WritePreview = { title: string; lines: string[]; descriptor: { tool: string; args: Record<string, unknown> } }`
  - `type WriteResult = { ok: boolean; summary: string }`
  - `type WriteNotFound = CapNotFound`
  - `type WriteTool = { name: string; kind: 'write'; description: string; parameters: z.ZodTypeAny; preview: (ctx: CapCtx, args: unknown) => Promise<WritePreview | WriteNotFound>; execute: (ctx: CapCtx, args: unknown) => Promise<WriteResult> }`
  - `capWriteExecute(c: ActionCapability<unknown, unknown>): (ctx: CapCtx, args: unknown) => Promise<WriteResult>`
  - `readToolsFromCaps(caps?: QueryCapability<unknown, unknown>[]): ReadTool[]` (defaults to registry `QUERY_CAPS`)
  - `writeToolsFromCaps(caps?: ActionCapability<unknown, unknown>[]): WriteTool[]` (defaults to registry `ACTION_CAPS`)
  (The optional `caps` parameter is the template's one generalization over irene — it makes the generators testable against a fake catalog and lets apps compose sub-catalogs; irene read the module-level registry only.)

Steps:

- [ ] Step: write failing test FIRST — Write `/Users/luca/dev/winter-park/template/lib/capabilities/tools.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  actionCapability,
  queryCapability,
  type ActionCapability,
  type CapCtx,
  type QueryCapability,
} from './types'
import { notFound } from './resolve'
import { capWriteExecute, readToolsFromCaps, writeToolsFromCaps } from './tools'

const ctx: CapCtx = {
  workspaceId: '1',
  userId:      '7',
  locale:      'en',
  timeZone:    'UTC',
  nowIso:      '2026-07-08T00:00:00.000Z',
}

const echoQuery = queryCapability({
  id: 'echo_query',
  kind: 'query',
  schema: z.object({ workspaceId: z.string(), value: z.string() }),
  run: async (input) => ({ echoed: input.value, scope: input.workspaceId }),
  ai: {
    describe: 'Echo a value back',
    aiSchema: z.object({ value: z.string() }),
    // names→ids: injects workspaceId from ctx; 'missing' simulates a non-match.
    resolve: async (c, args) => {
      const a = args as { value: string }
      if (a.value === 'missing') return notFound(a.value)
      return { workspaceId: c.workspaceId, value: a.value }
    },
  },
}) as QueryCapability<unknown, unknown>

const silentQuery = queryCapability({
  id: 'silent_query',
  kind: 'query',
  schema: z.object({ workspaceId: z.string() }),
  run: async () => ({ ok: true }),
  // no `ai` adapter → NOT exposed to the agent
}) as QueryCapability<unknown, unknown>

const renameAction = actionCapability({
  id: 'rename_thing',
  kind: 'action',
  schema: z.object({ workspaceId: z.string(), id: z.number(), name: z.string() }),
  run: async (input) => ({ success: true as const, renamedTo: input.name }),
  ai: {
    describe: 'PROPOSE renaming a thing',
    aiSchema: z.object({ name: z.string() }),
    resolve: async (c, args) => {
      const a = args as { name: string }
      if (a.name === 'missing') return notFound(a.name)
      return { workspaceId: c.workspaceId, id: 42, name: a.name }
    },
    preview: async (_c, input) => ({ title: 'Rename', lines: [`→ ${input.name}`] }),
    summarize: (_c, input, out) =>
      (out as { success: boolean }).success
        ? { ok: true, summary: `Renamed to ${input.name}` }
        : { ok: false, summary: 'Rename failed' },
  },
}) as ActionCapability<unknown, unknown>

const previewlessAction = actionCapability({
  id: 'no_preview_action',
  kind: 'action',
  schema: z.object({ workspaceId: z.string() }),
  run: async () => ({ success: true as const }),
  ai: {
    describe: 'Has ai but no preview',
    resolve: async (c) => ({ workspaceId: c.workspaceId }),
  },
}) as ActionCapability<unknown, unknown>

describe('readToolsFromCaps', () => {
  it('generates a read tool per ai-exposed query cap only', () => {
    const tools = readToolsFromCaps([echoQuery, silentQuery])
    expect(tools.map((t) => t.name)).toEqual(['echo_query'])
    expect(tools[0]!.kind).toBe('read')
    expect(tools[0]!.description).toBe('Echo a value back')
  })

  it('executes resolve → run with ctx-injected workspaceId', async () => {
    const [tool] = readToolsFromCaps([echoQuery])
    await expect(tool!.execute(ctx, { value: 'hi' })).resolves.toEqual({
      echoed: 'hi',
      scope:  '1',
    })
  })

  it('short-circuits a not_found resolve without running the query', async () => {
    const [tool] = readToolsFromCaps([echoQuery])
    await expect(tool!.execute(ctx, { value: 'missing' })).resolves.toEqual({
      error: 'not_found',
      searchedFor: 'missing',
    })
  })

  it('defaults to the (empty) registry', () => {
    expect(readToolsFromCaps()).toEqual([])
  })
})

describe('writeToolsFromCaps', () => {
  it('only exposes action caps that have a preview', () => {
    const tools = writeToolsFromCaps([renameAction, previewlessAction])
    expect(tools.map((t) => t.name)).toEqual(['rename_thing'])
  })

  it('preview resolves names→ids then attaches the replayable descriptor', async () => {
    const [tool] = writeToolsFromCaps([renameAction])
    await expect(tool!.preview(ctx, { name: 'New' })).resolves.toEqual({
      title: 'Rename',
      lines: ['→ New'],
      descriptor: { tool: 'rename_thing', args: { name: 'New' } },
    })
  })

  it('preview surfaces not_found instead of a card', async () => {
    const [tool] = writeToolsFromCaps([renameAction])
    await expect(tool!.preview(ctx, { name: 'missing' })).resolves.toEqual({
      error: 'not_found',
      searchedFor: 'missing',
    })
  })

  it('capWriteExecute runs the shared resolve → run → summarize spine', async () => {
    const execute = capWriteExecute(renameAction)
    await expect(execute(ctx, { name: 'New' })).resolves.toEqual({
      ok: true,
      summary: 'Renamed to New',
    })
  })

  it('defaults to the (empty) registry', () => {
    expect(writeToolsFromCaps()).toEqual([])
  })
})
```

  Run: `npx vitest run lib/capabilities/tools.test.ts` → expected: FAIL (module `./tools` not found).
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/capabilities/tools.ts` (irene's generator + tool shapes, generalized: `AssistantCtx` → `CapCtx`; local `isNotFound` → shared `isCapNotFound`; module-registry reads → optional `caps` params; salon wording → workspace):

```ts
/**
 * GENERATE an assistant's tool catalog from the Capability Registry.
 *
 * Every operation lives ONCE as a `Capability` (`lib/capabilities`). Its `ai`
 * adapter (describe + names→ids `resolve` + write `preview`/`summarize`) is all
 * an agent needs — no hand-written tool catalog that can drift from the action
 * the UI calls. Wire these into the AI SDK (`ai` package): read tools register
 * with their `execute`; WRITE tools register with NO `execute` (see below).
 *
 * SECURITY-CRITICAL invariants (unchanged from the pattern's origin):
 *   - A generated WRITE tool's `execute` (the resolve→run→summarize spine) is
 *     the SHARED `capWriteExecute(cap)` — the SAME function your confirm step
 *     dispatches to. The agent loop NEVER receives this `execute`: register
 *     writes with `tool({ description, inputSchema })` and no execute, so a
 *     model "call" only yields a PENDING PROPOSAL. Only the user's explicit
 *     confirm action ever runs it. Loop + confirm share ONE mutation spine and
 *     can never diverge.
 *   - `resolve` is workspace-scoped + read-only (names→ids against
 *     `ctx.workspaceId`); the model never sets a `workspaceId` — it comes from
 *     `ctx` inside each capability.
 *
 * See docs/capabilities.md for the full contract and wiring example.
 */

import { z } from 'zod'
import { ACTION_CAPS, QUERY_CAPS } from './registry'
import type { ActionCapability, CapCtx, CapNotFound, QueryCapability } from './types'
import { isCapNotFound } from './resolve'

/** A predefined, workspace-scoped READ tool. */
export type ReadTool = {
  name:        string
  kind:        'read'
  description: string
  parameters:  z.ZodTypeAny
  execute:     (ctx: CapCtx, args: unknown) => Promise<unknown>
}

/** The human-readable proposal a write tool resolves BEFORE any mutation. */
export type WritePreview = {
  /** Card heading — what kind of action this is. */
  title: string
  /** The resolved effect, line by line (real values). */
  lines: string[]
  /** The typed, replayable action descriptor the confirm step re-validates. */
  descriptor: { tool: string; args: Record<string, unknown> }
}

/** The result of a confirmed write — fed back as the next turn. */
export type WriteResult = {
  ok: boolean
  /** A one-line summary of what happened (success OR a soft failure). */
  summary: string
}

/** A "could not resolve this entity" preview outcome — map it to an honest refusal. */
export type WriteNotFound = CapNotFound

/** A predefined, workspace-scoped WRITE tool (propose→confirm; never loop-executed). */
export type WriteTool = {
  name:        string
  kind:        'write'
  description: string
  parameters:  z.ZodTypeAny
  /** Resolve a human preview + descriptor. PURE READ — never mutates. */
  preview:     (ctx: CapCtx, args: unknown) => Promise<WritePreview | WriteNotFound>
  /** The REAL mutation — run ONLY from your confirm step. */
  execute:     (ctx: CapCtx, args: unknown) => Promise<WriteResult>
}

/**
 * The SHARED write spine: resolve (names→ids) → run (the canonical action) →
 * summarize. Extracted so an agent loop's generated WRITE tool AND the confirm
 * step dispatch through the SAME path and can never diverge. Reads only happen
 * in `resolve`; the mutation is `cap.run`, exactly the action the UI calls.
 */
export function capWriteExecute(
  c: ActionCapability<unknown, unknown>,
): (ctx: CapCtx, args: unknown) => Promise<WriteResult> {
  return async (ctx, args) => {
    const input = await c.ai!.resolve(ctx, args)
    if (isCapNotFound(input)) return { ok: false, summary: '' } // unreachable post-preview; confirm re-resolves
    const out = await c.run(input as never)
    return c.ai!.summarize ? c.ai!.summarize(ctx, input as never, out) : { ok: true, summary: '' }
  }
}

export function readToolsFromCaps(
  caps: QueryCapability<unknown, unknown>[] = QUERY_CAPS,
): ReadTool[] {
  return caps.filter((c) => c.ai).map((c) => ({
    name: c.id, kind: 'read', description: c.ai!.describe,
    parameters: c.ai!.aiSchema ?? c.schema,
    execute: async (ctx: CapCtx, args: unknown) => {
      // `resolve` is a required adapter field (names→ids, workspace-scoped, read-only).
      const input = await c.ai!.resolve(ctx, args)
      if (isCapNotFound(input)) return input
      return c.run(input as never)
    },
  }))
}

export function writeToolsFromCaps(
  caps: ActionCapability<unknown, unknown>[] = ACTION_CAPS,
): WriteTool[] {
  return caps.filter((c) => c.ai?.preview).map((c) => ({
    name: c.id, kind: 'write', description: c.ai!.describe,
    parameters: c.ai!.aiSchema ?? c.schema,
    preview: async (ctx: CapCtx, args: unknown): Promise<WritePreview | WriteNotFound> => {
      const input = await c.ai!.resolve(ctx, args)
      if (isCapNotFound(input)) return input
      const p = await c.ai!.preview!(ctx, input as never)
      return { ...p, descriptor: { tool: c.id, args: args as Record<string, unknown> } }
    },
    execute: capWriteExecute(c),
  }))
}
```

- [ ] Step: run tests — Run: `npx vitest run lib/capabilities` → expected: PASS (tools.test.ts 9 tests + resolve.test.ts 2 tests).
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit:
  ```bash
  git add lib/capabilities/tools.ts lib/capabilities/tools.test.ts
  git commit -m "backport(ai): tools-from-capabilities generator with shared capWriteExecute spine (TDD)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.12: `ai_call_log` table + `lib/ai/` pricing + instrument (+ baseline regen)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/db/schema/ai-call-log.ts` (port of irene's 37 lines, `salon_id` → `workspace_id`)
- Modify: `/Users/luca/dev/winter-park/template/db/schema/index.ts` (append export)
- Create: `/Users/luca/dev/winter-park/template/lib/ai/pricing.ts` (verbatim port of irene `lib/control-panel/llm/pricing.ts`, 41 lines — zero app imports)
- Create: `/Users/luca/dev/winter-park/template/lib/ai/instrument.ts` (port of irene `lib/control-panel/llm/instrument.ts`, 97 lines)
- Regenerate: `/Users/luca/dev/winter-park/template/drizzle/0000_baseline.sql`

**Interfaces:**
- Consumes: `db` from `@/db/drizzle`; drizzle `pg-core` (`integer`, `text`, `pgTable`, `timestamp`, `jsonb`, `numeric`).
- Produces:
  - `aiCallLog` pgTable (`ai_call_log`): `id` identity PK, `workspaceId: integer NULL`, `userId: integer NULL`, `purpose: text NOT NULL`, `model: text NOT NULL`, `inputTokens/outputTokens/totalTokens: integer NULL`, `costUsd: numeric(12,6) NULL`, `costSource: text NULL` (`'gateway' | 'computed'`), `outcome: text NULL`, `latencyMs: integer NULL`, `details: jsonb NULL`, `createdAt: timestamptz NOT NULL default now()`
  - `priceFor(model: string, inputTokens: number, outputTokens: number): number | null` from `@/lib/ai/pricing`
  - `recordAiCall(input: { purpose: string; model: string; usage?: Usage; providerMetadata?: unknown; workspaceId?: number | string | null; userId?: number | string | null; latencyMs?: number; details?: Record<string, unknown>; outcome?: string }): void` from `@/lib/ai/instrument` (fire-and-forget, fail-open)

Steps:

- [ ] Step: Write `/Users/luca/dev/winter-park/template/db/schema/ai-call-log.ts` (irene's file; edits: L15 `salonId: integer("salon_id")` → `workspaceId: integer("workspace_id")`; header comment de-irene'd — drop "(the assistant loop + scrub-retry, the panel-brief verifier, the generative panel, the lens resolver)" and the `/admin/ai-costs` reference):

```ts
import { integer, text, pgTable, timestamp, jsonb, numeric } from 'drizzle-orm/pg-core'

/**
 * AI call telemetry — one row per LLM model call across the app. Records the
 * model, token usage, USD cost (gateway-reported when available, else computed
 * from `lib/ai/pricing.ts`), what the call was about (`purpose` + `details`),
 * and latency — so model swaps can be compared on cost + quality. Written
 * fail-open via `lib/ai/instrument.ts::recordAiCall` (never breaks a model
 * call). Nullable workspace/user scope: platform-level calls leave them null.
 */
export const aiCallLog = pgTable('ai_call_log', {
  id:           integer('id').primaryKey().generatedAlwaysAsIdentity(),
  workspaceId:  integer('workspace_id'),
  userId:       integer('user_id'),
  /** Stable label for WHAT the call was: e.g. 'assistant' | 'verify' | 'summarize' | … */
  purpose:      text('purpose').notNull(),
  /** The gateway model id, e.g. 'anthropic/claude-haiku-4.5'. */
  model:        text('model').notNull(),
  inputTokens:  integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  totalTokens:  integer('total_tokens'),
  /** USD cost (numeric → string in JS). */
  costUsd:      numeric('cost_usd', { precision: 12, scale: 6 }),
  /** 'gateway' (provider-reported) | 'computed' (pricing table) | null. */
  costSource:   text('cost_source'),
  /** FINAL turn outcome for a PRIMARY assistant pass — see lib/ai/outcome.ts
   *  ('answer' | 'propose' | 'refuse' | 'unavailable' | 'rate_limited' |
   *  'error'). Powers per-model refusal-rate tracking. Null for cost-only rows
   *  (auxiliary passes). */
  outcome:      text('outcome'),
  latencyMs:    integer('latency_ms'),
  /** The question/prompt context + raw provider usage/metadata, for audit. */
  details:      jsonb('details'),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

- [ ] Step: edit `/Users/luca/dev/winter-park/template/db/schema/index.ts` — append the line `export * from './ai-call-log'` after the last existing `export * from` line.
- [ ] Step: copy pricing — `mkdir -p /Users/luca/dev/winter-park/template/lib/ai && cp /Users/luca/dev/winter-park/irene/lib/control-panel/llm/pricing.ts /Users/luca/dev/winter-park/template/lib/ai/pricing.ts`. No code edits (file is app-agnostic: `PRICING` table, `familyPrice` fallback, `priceFor`). Verify: `grep -c 'salon\|[Ii]rene' lib/ai/pricing.ts` → 0.
- [ ] Step: copy instrument — `cp /Users/luca/dev/winter-park/irene/lib/control-panel/llm/instrument.ts /Users/luca/dev/winter-park/template/lib/ai/instrument.ts`, then apply these enumerated edits (irene line refs):
  1. L2–4 header: `writes ONE \`ai_call_log\` row per LLM model call (the assistant loop + scrub-retry, the verifier, the panel generation, the lens resolver). Captures` → `writes ONE \`ai_call_log\` row per LLM model call (e.g. an assistant loop, a verifier pass, generative UI). Captures`
  2. L19: `import { priceFor } from './pricing'` — unchanged (sibling in `lib/ai/`).
  3. L55: `salonId?:          number | string | null` → `workspaceId?:      number | string | null`
  4. L60–63 outcome doc comment: `'answer' | 'propose' | 'refuse' | 'unavailable' | 'rate_limited' | 'error'. Left undefined for cost-only rows (scrub/recovery passes, verify, panel, lens).` → `'answer' | 'propose' | 'refuse' | 'unavailable' | 'rate_limited' | 'error' — see lib/ai/outcome.ts. Left undefined for cost-only rows (auxiliary passes).`
  5. L76: `const sid = typeof input.salonId === 'string' ? Number(input.salonId) : input.salonId` → `const wid = typeof input.workspaceId === 'string' ? Number(input.workspaceId) : input.workspaceId`
  6. L80: `salonId:      sid != null && Number.isFinite(sid) ? sid : null,` → `workspaceId:  wid != null && Number.isFinite(wid) ? wid : null,`
  7. Everything else verbatim: the `Usage` type (AI SDK v5 input/output + older prompt/completion aliases), `gatewayCost()` with its VERIFIED `providerMetadata.gateway.cost` string extraction + alias hedges, the fire-and-forget `void (async () => { try … catch {} })()` wrapper, `costSource` derivation, `uid` handling.
- [ ] Step: regenerate baseline — Run: `cd /Users/luca/dev/winter-park/template && rm -rf drizzle && npx drizzle-kit generate --name baseline` → expected: exit 0.
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -c 'ai_call_log' drizzle/0000_baseline.sql` → expected: ≥ 1. Run: `grep -rn 'salon' lib/ai/ db/schema/ai-call-log.ts` → expected: no matches.
- [ ] Step: commit:
  ```bash
  git add db/schema lib/ai drizzle
  git commit -m "backport(ai): ai_call_log telemetry table + fail-open recordAiCall + pricing fallback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.13: Outcome-classification helper (TDD)

**Files:**
- Test: `/Users/luca/dev/winter-park/template/lib/ai/outcome.test.ts` (written FIRST)
- Create: `/Users/luca/dev/winter-park/template/lib/ai/outcome.ts` (NEW module — distills irene's classification logic that lived inline in the salon assistant's `run.ts` catchAll + `AskResult.status`, commits 414daf2 + 9b1ac1f)

**Interfaces:**
- Consumes: nothing (pure module; the `_tag` convention matches `lib/effect/errors.ts` tagged errors from phase 3).
- Produces:
  - `type AiOutcome = 'answer' | 'propose' | 'refuse' | 'unavailable' | 'rate_limited' | 'error'`
  - `RESOLVED_OUTCOMES: ReadonlySet<AiOutcome>` (`answer`, `propose`, `refuse`)
  - `INFRA_OUTCOMES: ReadonlySet<AiOutcome>` (`unavailable`, `rate_limited`, `error`)
  - `isInfraFailure(outcome: string | null | undefined): boolean`
  - `classifyFailure(err: unknown): 'unavailable' | 'rate_limited' | 'error'`
  - `refusalRate(outcomes: ReadonlyArray<string | null | undefined>): number | null`

Steps:

- [ ] Step: write failing test FIRST — Write `/Users/luca/dev/winter-park/template/lib/ai/outcome.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { classifyFailure, isInfraFailure, refusalRate } from './outcome'

describe('classifyFailure', () => {
  it('maps a tagged ExternalServiceError (gateway outage / spend cap) to unavailable', () => {
    expect(classifyFailure({ _tag: 'ExternalServiceError', service: 'gateway' })).toBe('unavailable')
  })

  it('maps a tagged RateLimited to rate_limited', () => {
    expect(classifyFailure({ _tag: 'RateLimited', message: 'slow down' })).toBe('rate_limited')
  })

  it('maps anything else — plain Error, other tags, junk — to error', () => {
    expect(classifyFailure(new Error('boom'))).toBe('error')
    expect(classifyFailure({ _tag: 'DbError' })).toBe('error')
    expect(classifyFailure('string')).toBe('error')
    expect(classifyFailure(null)).toBe('error')
  })
})

describe('isInfraFailure', () => {
  it('flags only the three infra outcomes', () => {
    expect(isInfraFailure('unavailable')).toBe(true)
    expect(isInfraFailure('rate_limited')).toBe(true)
    expect(isInfraFailure('error')).toBe(true)
    expect(isInfraFailure('refuse')).toBe(false)
    expect(isInfraFailure('answer')).toBe(false)
    expect(isInfraFailure(null)).toBe(false)
    expect(isInfraFailure(undefined)).toBe(false)
  })
})

describe('refusalRate', () => {
  it('computes refusals over RESOLVED turns, excluding infra failures and cost-only nulls', () => {
    expect(
      refusalRate(['answer', 'refuse', 'error', null, 'propose', 'refuse', 'rate_limited']),
    ).toBe(0.5) // 2 refusals / 4 resolved (answer, refuse, propose, refuse)
  })

  it('returns null when nothing resolved (all infra/null)', () => {
    expect(refusalRate(['error', 'unavailable', null, undefined])).toBeNull()
    expect(refusalRate([])).toBeNull()
  })
})
```

  Run: `npx vitest run lib/ai/outcome.test.ts` → expected: FAIL (module `./outcome` not found).
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/ai/outcome.ts`:

```ts
/**
 * AI turn-outcome classification — the taxonomy `ai_call_log.outcome` uses.
 *
 * The load-bearing rule (irene commit 9b1ac1f): INFRA IS NOT A REFUSAL.
 * `unavailable` (gateway outage / over its spend cap), `rate_limited`, and
 * `error` (generic api/gateway failure) are TEMPORARY service problems — they
 * must never be counted as the model refusing, or an outage pollutes every
 * quality metric (irene's $10-cap outage logged thousands of false capability
 * gaps before this split). Genuine turn results:
 *
 *   - `answer`  — the model answered from real data.
 *   - `propose` — the model proposed a write (pending user confirm).
 *   - `refuse`  — an honest "I can't do that" on a working service.
 *
 * Thread the outcome into `recordAiCall({ outcome })` AFTER the final result
 * settles; auxiliary passes (retries, verifiers) leave it undefined.
 */
export type AiOutcome = 'answer' | 'propose' | 'refuse' | 'unavailable' | 'rate_limited' | 'error'

/** Turns where the model actually resolved the request (denominator for rates). */
export const RESOLVED_OUTCOMES: ReadonlySet<AiOutcome> = new Set(['answer', 'propose', 'refuse'])

/** Temporary service problems — never quality signals. */
export const INFRA_OUTCOMES: ReadonlySet<AiOutcome> = new Set(['unavailable', 'rate_limited', 'error'])

export function isInfraFailure(outcome: string | null | undefined): boolean {
  return outcome != null && INFRA_OUTCOMES.has(outcome as AiOutcome)
}

/**
 * Classify a caught failure from an LLM code path. Recognizes the tagged-error
 * convention of `lib/effect/errors.ts` (`_tag`): an `ExternalServiceError` is
 * the gateway/provider being down or capped → `unavailable`; `RateLimited` is
 * our own limiter → `rate_limited`; anything else is a generic `error`.
 */
export function classifyFailure(err: unknown): 'unavailable' | 'rate_limited' | 'error' {
  const tag = (err as { _tag?: string } | null | undefined)?._tag
  if (tag === 'ExternalServiceError') return 'unavailable'
  if (tag === 'RateLimited') return 'rate_limited'
  return 'error'
}

/**
 * Per-model refusal rate over a set of logged outcomes: refusals / resolved
 * turns. Infra failures and cost-only rows (null outcome) are EXCLUDED from
 * the denominator. Returns null when nothing resolved.
 */
export function refusalRate(outcomes: ReadonlyArray<string | null | undefined>): number | null {
  const resolved = outcomes.filter(
    (o): o is AiOutcome => o != null && RESOLVED_OUTCOMES.has(o as AiOutcome),
  )
  if (resolved.length === 0) return null
  const refusals = resolved.filter((o) => o === 'refuse').length
  return refusals / resolved.length
}
```

  Run: `npx vitest run lib/ai/outcome.test.ts` → expected: PASS (6 tests).
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `npx vitest run lib/ai` → expected: PASS.
- [ ] Step: commit:
  ```bash
  git add lib/ai/outcome.ts lib/ai/outcome.test.ts
  git commit -m "backport(ai): outcome classification — refusals vs infra failures + refusal rate (TDD)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.14: AI widgets I — AskAi + useAskAi + VoiceInput (+ stories)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/useAskAi.ts` (verbatim port, 25 lines)
- Create: `/Users/luca/dev/winter-park/template/components/ui/AskAi.tsx` (port of irene's 153 lines)
- Create: `/Users/luca/dev/winter-park/template/components/ui/AskAi.stories.tsx` (verbatim port, 45 lines)
- Create: `/Users/luca/dev/winter-park/template/components/ui/VoiceInput.tsx` (port of irene's 111 lines)
- Create: `/Users/luca/dev/winter-park/template/components/ui/VoiceInput.stories.tsx` (verbatim port, 34 lines)

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`; `IconChip` (phase 8.3); `lucide-react` icons; `useReducedMotion` from `framer-motion` (existing dep); phase 2 token classes (`bg-accent`, `text-accent-foreground`, `bg-info`, `text-info-foreground`, `shadow-card`, `ring-info`).
- Produces:
  - `useAskAi(value: string | undefined, onChange?: (next: string) => void): { text: string; setText: (next: string) => void; clear: () => void }`
  - `AskAi({ value?, onChange?, onSubmit?, onMic?, onAttach?, onSettings?, placeholder?, attachLabel?, settingsLabel?, micLabel?, sendLabel?, disabled?, glow?, className? })` — ALL microcopy via props, English defaults
  - `VoiceInput({ listening: boolean, onToggle: () => void, label?, listeningLabel?, idleLabel?, bars?, className? })`

Steps:

- [ ] Step: copy hook — `cp /Users/luca/dev/winter-park/irene/components/ui/useAskAi.ts /Users/luca/dev/winter-park/template/components/ui/useAskAi.ts`. No edits (zero irene-isms; verify `grep -c 'salon\|[Ii]rene' components/ui/useAskAi.ts` → 0).
- [ ] Step: copy AskAi — `cp /Users/luca/dev/winter-park/irene/components/ui/AskAi.tsx /Users/luca/dev/winter-park/template/components/ui/AskAi.tsx`, then apply these enumerated edits (irene line refs):
  1. L10 doc: `AskAi — the "Perguntar à IA" / Ask-Irene input bar.` → `AskAi — the "Ask AI" assistant input bar.`
  2. L12: `A charcoal slab carrying the ✨ family signature, a free-text question input,` → `A solid accent slab carrying the ✨ AI signature, a free-text question input,`
  3. L15: `one of the few primitives allowed to wear it (\`01\` §2.3, \`02\` §3.5).` → `one of the few primitives allowed to wear it.`
  4. L17: `The optional focus glow (\`01\` §7.3) lights an \`info\` ring ONLY while the bar` → `The optional focus glow lights an \`info\` ring ONLY while the bar`
  5. L23 doc: `the field clears afterwards in the uncontrolled path.` — keep; append a new doc line: `All microcopy (placeholder + affordance labels) is prop-overridable for i18n.`
  6. Props destructuring (L26–35): after `onSettings,` insert `attachLabel = 'Attach',`, `settingsLabel = 'Settings',`, `micLabel = 'Talk to the AI',`, `sendLabel = 'Send question',`; and change L32 `placeholder = 'Perguntar à IA…',` → `placeholder = 'Ask AI…',`
  7. Props type (L36–51): after `onSettings?: () => void` insert:
     ```tsx
     /** Aria label for the attach affordance. */
     attachLabel?: string
     /** Aria label for the settings affordance. */
     settingsLabel?: string
     /** Aria label for the mic affordance. */
     micLabel?: string
     /** Aria label for the send button. */
     sendLabel?: string
     ```
  8. L66: `'flex items-center gap-2 rounded-full bg-charcoal p-2 pl-3 text-charcoal-foreground shadow-bento',` → `'flex items-center gap-2 rounded-full bg-accent p-2 pl-3 text-accent-foreground shadow-card',`
  9. L67: `'ring-1 ring-inset ring-[hsl(var(--charcoal-line))] transition-shadow duration-150',` → `'ring-1 ring-inset ring-accent-foreground/15 transition-shadow duration-150',`
  10. L87: `'min-w-0 flex-1 bg-transparent text-sm text-charcoal-foreground placeholder:text-current/55',` → `'min-w-0 flex-1 bg-transparent text-sm text-accent-foreground placeholder:text-current/55',`
  11. L93: `label="Anexar"` → `label={attachLabel}`; L98: `label="Configurações"` → `label={settingsLabel}`; L103: `label="Falar com a IA"` → `label={micLabel}`
  12. L110: `aria-label="Enviar pergunta"` → `aria-label={sendLabel}`
  13. L116: `'focus-visible:ring-info focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal',` → `'focus-visible:ring-info focus-visible:ring-offset-2 focus-visible:ring-offset-accent',`
  14. AffordanceButton (L143–148): L145 `'transition-colors duration-150 hover:bg-charcoal-2 hover:text-current',` → `'transition-colors duration-150 hover:bg-accent-foreground/10 hover:text-current',`; L147 `'focus-visible:ring-offset-charcoal disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',` → `'focus-visible:ring-offset-accent disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',`
- [ ] Step: copy AskAi story — `cp /Users/luca/dev/winter-park/irene/components/ui/AskAi.stories.tsx /Users/luca/dev/winter-park/template/components/ui/AskAi.stories.tsx`. No edits (stories carry no irene copy — controlled/affordances/no-glow/disabled variants only).
- [ ] Step: copy VoiceInput — `cp /Users/luca/dev/winter-park/irene/components/ui/VoiceInput.tsx /Users/luca/dev/winter-park/template/components/ui/VoiceInput.tsx`, then apply these enumerated edits (irene line refs):
  1. L8 doc: `VoiceInput — the mic + waveform voice-intake widget (\`02\` §3.5 / \`03\` §4.6).` → `VoiceInput — the mic + waveform voice-intake widget.`
  2. L21–22 doc: `Presentational: \`listening\` + \`onToggle\` are owned by the caller (the attendant intake scene). SSR-safe — bar heights are deterministic.` → `Presentational: \`listening\` + \`onToggle\` are owned by the caller. SSR-safe — bar heights are deterministic. All microcopy is prop-overridable for i18n.`
  3. Props type (L34–41): L37 doc `/** Accessible label for the mic toggle (defaults by state). */` keep; after `label?: string` insert:
     ```tsx
     /** Aria label for the waveform while listening. */
     listeningLabel?: string
     /** Aria label for the waveform while idle. */
     idleLabel?: string
     ```
     and destructure (L28–33): after `label,` insert `listeningLabel = 'Listening…',` and `idleLabel = 'Microphone off',`
  4. L45: `const micLabel = label ?? (listening ? 'Parar de ouvir' : 'Falar com a IA')` → `const micLabel = label ?? (listening ? 'Stop listening' : 'Talk to the AI')`
  5. L50: `'flex items-center gap-3 rounded-full bg-charcoal p-2 pl-2 pr-4 text-charcoal-foreground shadow-bento',` → `'flex items-center gap-3 rounded-full bg-accent p-2 pl-2 pr-4 text-accent-foreground shadow-card',`
  6. L51: `'ring-1 ring-inset ring-[hsl(var(--charcoal-line))]',` → `'ring-1 ring-inset ring-accent-foreground/15',`
  7. L63–64: `'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info', 'focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal active:scale-[0.96]',` → `… focus-visible:ring-offset-accent active:scale-[0.96]',` (only the `ring-offset-charcoal` token changes)
  8. L67–68: `? 'bg-info text-info-foreground' : 'bg-charcoal-2 text-current/80 hover:text-current',` → `? 'bg-info text-info-foreground' : 'bg-accent-foreground/10 text-current/80 hover:text-current',`
  9. L76: `aria-label={listening ? 'Ouvindo…' : 'Microfone inativo'}` → `aria-label={listening ? listeningLabel : idleLabel}`
  10. L84: `listening ? 'bg-info' : 'bg-charcoal-2',` → `listening ? 'bg-info' : 'bg-accent-foreground/20',`
  11. Keep verbatim: the deterministic `BARS` envelope, the `useReducedMotion` gate + steady un-animated listening state, and the scoped `<style>` keyframes with the `prefers-reduced-motion` override (`voiceinput-wave` / `.voiceinput-bar`).
- [ ] Step: copy VoiceInput story — `cp /Users/luca/dev/winter-park/irene/components/ui/VoiceInput.stories.tsx /Users/luca/dev/winter-park/template/components/ui/VoiceInput.stories.tsx`. No edits (Interactive/Idle/Listening variants, no copy).
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -rn 'charcoal\|bento\|Perguntar\|Anexar\|Configurações\|Falar\|Ouvindo\|Microfone\|§' components/ui/AskAi.tsx components/ui/VoiceInput.tsx` → expected: no matches. Run: `npx storybook build --quiet` → expected: exit 0.
- [ ] Step: commit:
  ```bash
  git add components/ui/AskAi.tsx components/ui/useAskAi.ts components/ui/AskAi.stories.tsx components/ui/VoiceInput.tsx components/ui/VoiceInput.stories.tsx
  git commit -m "backport(ai): AskAi input bar + VoiceInput waveform (neutral tokens, English microcopy props)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.15: AI widgets II — InsightCard + AiForecastHero (+ stories)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/InsightCard.tsx` (port of irene's 278 lines)
- Create: `/Users/luca/dev/winter-park/template/components/ui/InsightCard.stories.tsx` (port, English copy)
- Create: `/Users/luca/dev/winter-park/template/components/ui/AiForecastHero.tsx` (port of irene's 170 lines)
- Create: `/Users/luca/dev/winter-park/template/components/ui/AiForecastHero.stories.tsx` (port, English copy)

**Interfaces:**
- Consumes: `Tile` (tone union incl. `'accent'` solid + `'warning'`/`'info'` soft — phase 8.3), `IconChip` (tones `'plain'|'info'|'warning'` — phase 8.3), `SectionLabel` (phase 8.3), `Delta({ value, invert?, className? })` (phase 8.11), `Sparkline` (phase 8.11, story only); `cva`/`cn`; phase 2 classes `bg-destructive-soft`, `text-destructive-deep`, `text-warning-deep`, `text-info(-deep)`, `label-micro`.
- Produces:
  - `type InsightCardProps` with `variant?: 'info' | 'forecast' | 'anomaly' | 'nudge'`, `surface?: 'soft' | 'accent'`, `severity?: 'watch' | 'alarm'`, `kicker?: React.ReactNode`, `headline: React.ReactNode`, `body?`, `cta?: { label: React.ReactNode; onClick?: () => void; href?: string }`, `page?: { index: number; total: number; onPrev?: () => void; onNext?: () => void }`, `onDismiss?: () => void`, `onFeedback?: (vote: 'up' | 'down') => void`, `labels?: Partial<InsightCardLabels>`, `children?`; `InsightCard(props)`
  - `type InsightCardLabels = { dismiss: string; helpful: string; notHelpful: string; prev: string; next: string; pager: (index: number, total: number) => string; region: string }`
  - `type AiForecastHeroProps` with `kicker?` (default `'AI · FORECAST'`), `label?`, `actual: { value: React.ReactNode; caption?: React.ReactNode }`, `projected: { value; caption? }`, `actualLabel?: string` (default `'Actual'`), `projectedLabel?: string` (default `'Projected'`), `regionLabel?: string` (default `'AI forecast'`), `trendLabel?: string` (default `'Trend: actual and projection'`), `delta?: string`, `deltaInvert?: boolean`, `trend?: { actual: number[]; projected: number[] }`; `AiForecastHero(props)`

Steps:

- [ ] Step: copy InsightCard — `cp /Users/luca/dev/winter-park/irene/components/ui/InsightCard.tsx /Users/luca/dev/winter-park/template/components/ui/InsightCard.tsx`, then apply these enumerated edits (irene line refs):
  1. L11–24 header doc: `Soft-\`info\` is the calm default surface; anomalies escalate to honey/destructive; an optional \`charcoal\` surface anchors a dark AI brief.` → `Soft-\`info\` is the calm default surface; anomalies escalate to warning/destructive; an optional solid \`accent\` surface anchors a dark AI brief.`; drop the two foundation-doc refs: `(foundation §2.3) — never money/status/KPI` → `— never money/status/KPI` (keep the rule sentence) and `gated by \`motion-reduce:\`).` keep as-is. Append doc line: `All aria/microcopy defaults are English and overridable via \`labels\` (i18n via props).`
  2. L27: `type Surface = 'soft' | 'charcoal'` → `type Surface = 'soft' | 'accent'`
  3. L36–42 `VARIANT_KICKER`: comment `/** Default kicker per variant (pt-BR), overridable via \`kicker\`. */` → `/** Default kicker per variant (English), overridable via \`kicker\` — swap "AI" for your product's persona. */`; values `'IRENE · SUGESTÃO'` → `'AI · SUGGESTION'`, `'IRENE · PREVISÃO'` → `'AI · FORECAST'`, `'IRENE · ALERTA'` → `'AI · ALERT'`, `'IRENE · DICA'` → `'AI · TIP'`
  4. L44–48 surface doc: `\`anomaly\` escalates to honey (watch)` → `\`anomaly\` escalates to warning (watch)`; `On soft fills text rides the tone's \`-deep\` ink (foundation §2.2).` → `On soft fills text rides the tone's \`-deep\` ink (WCAG pairing rule).`
  5. L49–57 `surfaceVariants` cva: variant key `charcoal: '',` → `accent: '',`
  6. After the props-type opening (L59), add the labels type ABOVE `export type InsightCardProps`:
     ```tsx
     /** English defaults for the card's aria/microcopy — override for i18n. */
     export type InsightCardLabels = {
       dismiss:    string
       helpful:    string
       notHelpful: string
       prev:       string
       next:       string
       pager:      (index: number, total: number) => string
       region:     string
     }

     const DEFAULT_LABELS: InsightCardLabels = {
       dismiss:    'Dismiss insight',
       helpful:    'Helpful',
       notHelpful: 'Not helpful',
       prev:       'Previous insight',
       next:       'Next insight',
       pager:      (index, total) => `Insight ${index} of ${total}`,
       region:     'AI insight',
     }
     ```
  7. Props type edits: L65 `/** \`soft\` (default tinted tile) or \`charcoal\` (dark AI-brief anchor). */` → `/** \`soft\` (default tinted tile) or \`accent\` (solid AI-brief anchor). */`; L66 `/** Escalates an \`anomaly\` from honey (watch) to destructive (alarm). */` → `/** Escalates an \`anomaly\` from warning (watch) to destructive (alarm). */`; L67 `/** Override the default per-variant kicker (e.g. "IRENE · PREVISÃO"). */` → `/** Override the default per-variant kicker (e.g. "ACME · FORECAST"). */`; after the `onFeedback` prop insert `/** Override the English aria/microcopy defaults. */` + `labels?: Partial<InsightCardLabels>`
  8. Destructuring (L85–99): after `onFeedback,` insert `labels,`; first line of the body (before `const Icon = …`) insert `const L = { ...DEFAULT_LABELS, ...labels }`
  9. L101: `const onDark = surface === 'charcoal'` → `const onDark = surface === 'accent'`
  10. L105–111 `tileTone`: comment `charcoal anchor, escalated anomaly (destructive/honey soft), or the calm info-soft default. Anomalies never use the cool accent surface — they are status, so they stay warm (foundation §2.3).` → `solid accent anchor, escalated anomaly (destructive/warning soft), or the calm info-soft default. Anomalies never use the cool info surface — they are status, so they stay warm.`; code `? 'charcoal'` → `? 'accent'`; `(alarm ? undefined : 'honey')` → `(alarm ? undefined : 'warning')`
  11. L118–123 `chipTone`: comment `on a soft anomaly tile it matches the warning.` keep; code `(alarm ? 'plain' : 'honey')` → `(alarm ? 'plain' : 'warning')`
  12. L124–128 `kickerCls`: `(alarm ? 'text-destructive-deep' : 'text-honey-deep')` → `(alarm ? 'text-destructive-deep' : 'text-warning-deep')`
  13. L130–131: comment `On a charcoal surface the ✨ chip needs its own raised fill, not bare ink.` → `On the solid accent surface the ✨ chip needs its own raised fill, not bare ink.`; `const chipOnDarkCls = onDark ? 'bg-charcoal-2 text-info' : undefined` → `const chipOnDarkCls = onDark ? 'bg-accent-foreground/10 text-info' : undefined`
  14. L142: `aria-label={typeof headline === 'string' ? headline : 'Insight da IA'}` → `aria-label={typeof headline === 'string' ? headline : L.region}`
  15. L159: `aria-label="Dispensar insight"` → `aria-label={L.dismiss}`
  16. L163 (and every later occurrence at L220, L232, L251, L267): `hover:bg-charcoal-2` → `hover:bg-accent-foreground/10` (4 occurrences inside `onDark ? … : …` ternaries; the non-dark `hover:bg-card/60` sides stay).
  17. L217/L229: `aria-label="Insight útil"` → `aria-label={L.helpful}`; `aria-label="Insight não útil"` → `aria-label={L.notHelpful}`
  18. L242: `aria-label={\`Insight ${page.index} de ${page.total}\`}` → `aria-label={L.pager(page.index, page.total)}`
  19. L247: `aria-label="Insight anterior"` → `aria-label={L.prev}`; L263: `aria-label="Próximo insight"` → `aria-label={L.next}`
  20. Keep verbatim: the `VARIANT_ICON` map, `alarmCls` (`bg-destructive-soft text-destructive-deep ring-1 ring-inset ring-destructive-deep/10` — these triad classes exist per phase 2), the CTA link/button pair, the pager disable logic, all `text-info`/`text-info-deep`/`ring-info` accents.
- [ ] Step: Write `/Users/luca/dev/winter-park/template/components/ui/InsightCard.stories.tsx` (irene's stories with English copy and the renamed surface):

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { InsightCard } from './InsightCard'
import { Sparkline } from './Sparkline'

const meta: Meta<typeof InsightCard> = {
  component: InsightCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[360px] bg-background p-6">
        <Story />
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof InsightCard>

export const Info: Story = {
  args: {
    variant: 'info',
    headline: 'Tuesday is your slowest day of the week.',
    body: 'Consider a mid-week promotion to balance the schedule.',
    cta: { label: 'View analysis →' },
  },
}

export const Forecast: Story = {
  args: {
    variant: 'forecast',
    headline: 'At the current pace, the month closes at $42,300.',
    body: 'About 8% above last month.',
    children: <Sparkline data={[12, 14, 13, 17, 19, 22, 26]} width={300} height={40} className="text-info-deep" />,
    cta: { label: 'Projection details →' },
  },
}

export const Anomaly: Story = {
  args: {
    variant: 'anomaly',
    severity: 'watch',
    headline: 'Payouts 23% above average this cycle.',
    body: 'Worth reviewing the last week of activity.',
    cta: { label: 'Review payouts →' },
  },
}

export const AnomalyAlarm: Story = {
  args: {
    variant: 'anomaly',
    severity: 'alarm',
    headline: '3 invoices went past due today without payment.',
    body: '$1,240 outstanding in total.',
    cta: { label: 'Follow up now →' },
  },
}

export const Nudge: Story = {
  args: {
    variant: 'nudge',
    headline: '5 customers have not returned in over 60 days.',
    body: 'A reminder could bring them back.',
    cta: { label: 'Send reminder →' },
    onFeedback: () => {},
  },
}

export const Paginated: Story = {
  args: {
    variant: 'info',
    headline: 'Your return rate rose 4% this month.',
    body: 'Customers are coming back more often.',
    page: { index: 2, total: 4 },
    onDismiss: () => {},
    onFeedback: () => {},
  },
}

export const Accent: Story = {
  args: {
    variant: 'forecast',
    surface: 'accent',
    headline: 'Good morning! Your AI summary is ready.',
    body: 'Projected revenue for today: $1,860.',
    page: { index: 1, total: 4 },
    cta: { label: 'View full summary →' },
  },
}

export const CustomPersona: Story = {
  args: {
    variant: 'forecast',
    kicker: 'ACME · FORECAST',
    headline: 'Demand should peak on Friday.',
    body: 'Kicker text is a prop — brand it per app.',
  },
}
```

- [ ] Step: copy AiForecastHero — `cp /Users/luca/dev/winter-park/irene/components/ui/AiForecastHero.tsx /Users/luca/dev/winter-park/template/components/ui/AiForecastHero.tsx`, then apply these enumerated edits (irene line refs):
  1. L9–18 header doc: `The charcoal forecast hero — a dark AI anchor (foundation §3.3 rank 2) that contrasts an **actual** figure (warm cream) against a **projected** figure` → `The solid-accent forecast hero — a dark AI anchor that contrasts an **actual** figure against a **projected** figure`; `so actuals never read as blue (foundation §2.3 chart rule).` → `so actuals never read as blue (chart rule: the cool accent marks projection/AI only).`; `on charcoal the metric rides full-opacity cream, sub-lines dim by opacity (foundation §3.4).` → `on the solid anchor the metric rides full-opacity foreground, sub-lines dim by opacity. All microcopy is prop-overridable (English defaults).`
  2. Props type (L20–41): L23 `/** Short label under the kicker (e.g. "Receita do mês"). */` → `/** Short label under the kicker (e.g. "Monthly revenue"). */`; L25 `/** The realized-so-far value (the warm/cream actual). */` → `/** The realized-so-far value (the warm actual). */`; after the `projected` prop insert:
     ```tsx
     /** Label over the actual figure. */
     actualLabel?: string
     /** Label over the projected figure. */
     projectedLabel?: string
     /** Aria label for the region when `label` isn't a string. */
     regionLabel?: string
     /** Aria label for the trend SVG. */
     trendLabel?: string
     ```
  3. Destructuring (L43–53): L44 `kicker = 'IRENE · PREVISÃO',` → `kicker = 'AI · FORECAST',`; after `projected,` insert `actualLabel = 'Actual',`, `projectedLabel = 'Projected',`, `regionLabel = 'AI forecast',`, `trendLabel = 'Trend: actual and projection',`
  4. L56: `tone="charcoal"` → `tone="accent"`
  5. L59: `aria-label={typeof label === 'string' ? label : 'Previsão da IA'}` → `aria-label={typeof label === 'string' ? label : regionLabel}`
  6. L62: comment `✨ chip + the only blue kicker on a dark brief.` keep; L65 `className="bg-charcoal-2 text-info"` → `className="bg-accent-foreground/10 text-info"`
  7. L78 + L85: `rounded-2xl bg-charcoal-2 p-4` → `rounded-2xl bg-accent-foreground/10 p-4` (the projected block keeps its `ring-1 ring-inset ring-info/30`)
  8. L79: `<p className="label-mono text-current opacity-75">Realizado</p>` → `<p className="label-micro text-current opacity-75">{actualLabel}</p>`
  9. L86: `<p className="label-mono text-info">Projetado</p>` → `<p className="label-micro text-info">{projectedLabel}</p>`
  10. L96: `<ForecastTrend actual={trend.actual} projected={trend.projected} />` → `<ForecastTrend actual={trend.actual} projected={trend.projected} ariaLabel={trendLabel} />`
  11. `ForecastTrend` (L106–116): add `ariaLabel` to the signature — `function ForecastTrend({ actual, projected, ariaLabel, width = 320, height = 56 }: { actual: number[]; projected: number[]; ariaLabel: string; width?: number; height?: number })`; L102–105 doc `a solid cream actuals line` → `a solid foreground actuals line`
  12. L141: `aria-label="Tendência: realizado e projeção"` → `aria-label={ariaLabel}`
  13. L147: `stroke="hsl(var(--charcoal-foreground))"` → `stroke="hsl(var(--accent-foreground))"`
  14. Keep verbatim: the auto-scaled shared coordinate space, the dashed `5 4` projection stroke + `hsl(var(--info))`, the continuation from the last actual index, the terminal `<circle>` dot, `tabular-nums`, `preserveAspectRatio="none"`.
- [ ] Step: Write `/Users/luca/dev/winter-park/template/components/ui/AiForecastHero.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { AiForecastHero } from './AiForecastHero'

const meta: Meta<typeof AiForecastHero> = {
  component: AiForecastHero,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[420px] bg-background p-6">
        <Story />
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof AiForecastHero>

export const Default: Story = {
  args: {
    label: 'Monthly revenue',
    actual: { value: '$31,480', caption: '21 days realized' },
    projected: { value: '$42,300', caption: 'projection through day 30' },
    delta: '+8%',
    trend: {
      actual: [18, 20, 19, 24, 27, 30, 31],
      projected: [31, 34, 37, 40, 42],
    },
  },
}

export const NoTrend: Story = {
  args: {
    label: 'Today',
    actual: { value: '$980', caption: 'so far' },
    projected: { value: '$1,860', caption: 'closing estimate' },
    delta: '+4%',
  },
}

export const NegativeDelta: Story = {
  args: {
    label: 'Weekly revenue',
    actual: { value: '$6,200', caption: '5 days realized' },
    projected: { value: '$8,100', caption: 'projection through Sunday' },
    delta: '-3%',
    trend: {
      actual: [22, 20, 18, 17, 16],
      projected: [16, 15, 14],
    },
  },
}

export const CustomPersona: Story = {
  args: {
    kicker: 'ACME · FORECAST',
    label: 'Pipeline value',
    actualLabel: 'Closed',
    projectedLabel: 'Forecast',
    actual: { value: '$310k' },
    projected: { value: '$425k' },
  },
}
```

- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -rn 'charcoal\|honey\|IRENE\|label-mono\|§\|Realizado\|Projetado\|Insight da IA\|Dispensar' components/ui/InsightCard.tsx components/ui/AiForecastHero.tsx components/ui/InsightCard.stories.tsx components/ui/AiForecastHero.stories.tsx` → expected: no matches. Run: `npx storybook build --quiet` → expected: exit 0.
- [ ] Step: commit:
  ```bash
  git add components/ui/InsightCard.tsx components/ui/InsightCard.stories.tsx components/ui/AiForecastHero.tsx components/ui/AiForecastHero.stories.tsx
  git commit -m "backport(ai): InsightCard + AiForecastHero (accent anchor, English persona kickers via props)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10.16: `docs/capabilities.md` (template worked example) + CLAUDE.md rows + env note

**Files:**
- Create: `/Users/luca/dev/winter-park/template/docs/capabilities.md` (rewrite of irene's — same contract, template worked example, workspace naming)
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (doc-table row + checklist line + invariants block + decision-guide rows — all anchored)
- Modify: `/Users/luca/dev/winter-park/template/.env.example` (AI gateway var, documented as feature-gated)

**Interfaces:**
- Consumes: everything 10.10–10.15 shipped.
- Produces: the documented capability contract app code is written against. No code.

Steps:

- [ ] Step: Write `/Users/luca/dev/winter-park/template/docs/capabilities.md`:

```markdown
---
title: Capabilities
order: 18
category: Patterns
---

# Capability Registry — One Operation, One Definition

Every app operation — "create a project", "list members", "rename a thing" — is
defined **once** as a `Capability`. The human form/page calls `cap.run`, and an
AI assistant's tool catalog is **generated** from the same registry. There is no
second copy of an operation: no hand-listed tool that can drift from the action
the UI calls, no second mutation path, no second business math.

```
Capability  =  { id, kind, schema, run, ai? }
                              │      │    │
   the canonical input ──────┘      │    └── the AI-only adapter (optional)
   the EXISTING action / query ─────┘
```

A capability is the **single source of truth** for an operation. Forms and pages
consume `run`; the assistant consumes `ai`. If an operation has no `ai`, it
simply isn't exposed to the agent — it's still the canonical way the UI performs
it. The registry ships EMPTY (`lib/capabilities/registry.ts`) — grow it with
your app.

## The type

`lib/capabilities/types.ts`:

```ts
export type ActionCapability<In, Out> = {
  id: string; kind: 'action'
  schema: z.ZodType<In>
  run: (input: In) => Promise<Out>           // the EXISTING server action
  ai?: AiAdapter<In>
}
export type QueryCapability<In, Out> = {
  id: string; kind: 'query'
  schema: z.ZodType<In>
  run: (input: In) => Promise<Out>           // the EXISTING 'use cache' query
  ai?: Pick<AiAdapter<In>, 'describe' | 'aiSchema' | 'resolve'>
}
```

`run` is **not new code** — it's the action/query that already exists in the
section's `actions.ts` / `query.ts`. The capability just names it and attaches
the canonical `schema` and (optionally) the AI adapter.

### `CapCtx` — the workspace-scoped context

Every capability + tool closes over the authorized, workspace-scoped `CapCtx`:
`workspaceId`, `userId`, `locale`, `timeZone`, `nowIso`. It is built ONCE, after
authorization, and shared by every tool — so an assistant is exactly as capable
as the logged-in user. `workspaceId` lives on `ctx`, **never** as an LLM
argument. Apps extend the interface via module augmentation (formatter bags,
currency, the original question — see the doc comment in `types.ts`).

## The two-schema shape: `schema` vs `ai.aiSchema` + `resolve`

| | What it is | Who validates against it |
|---|---|---|
| `schema` | the **canonical** input `run` takes (includes `workspaceId` + ids) | the form/page; your confirm step re-validates |
| `ai.aiSchema` | the **loose, name-based** args the LLM may pass (no `workspaceId`, names not ids) | the agentic loop's tool call |
| `ai.resolve` | turns loose LLM args → canonical input (names→ids, injects `workspaceId` from `ctx`) | runs server-side, **read-only** |

The model only ever names an entity; `resolve` is the workspace-scoped boundary
that turns that name into a real, owned id — or returns
`notFound(name)` (`lib/capabilities/resolve.ts`) so the tool refuses rather than
inventing a record. Resolver conventions (workspace-scoped, read-only, live
reads) and the `EntityResolver<Row>` shape live in `resolve.ts`.

## Generated tools (`lib/capabilities/tools.ts`)

- `readToolsFromCaps()` → a `ReadTool` per query cap with an `ai` block:
  `resolve → run`.
- `writeToolsFromCaps()` → a `WriteTool` per action cap with an `ai.preview`:
  `preview` resolves the human confirm card + a replayable `descriptor`;
  `execute` is the shared `capWriteExecute(cap)` spine (`resolve → run →
  summarize`).
- Both accept an optional `caps` array (defaults to the registry) — compose
  sub-catalogs or test against fakes.

**Wiring into the AI SDK** (`ai` dep, via the Vercel AI Gateway —
`AI_GATEWAY_API_KEY`): register read tools WITH their `execute`; register write
tools with `tool({ description, inputSchema })` and **NO execute**, so a model
"call" only yields a PENDING PROPOSAL your UI renders as a confirm card. Your
confirm action re-auths, re-validates the descriptor against the tool's own
`parameters`, then dispatches through the SAME `capWriteExecute(cap)`. Log every
model call with `recordAiCall` (`lib/ai/instrument.ts`) and thread the final
turn outcome (`lib/ai/outcome.ts`) for cost + refusal tracking.

## Worked example — `create_project`

A hypothetical workspace app with a ProjectForm section
(`app/workspace/[workspaceId]/(app)/projects/_sections/ProjectForm/`). Co-locate
`capability.ts` beside it:

```ts
import { z } from 'zod'
import { actionCapability } from '@/lib/capabilities/types'
import { createProject } from './actions'          // the EXISTING server action

const schema = z.object({
  workspaceId: z.string(),
  name:        z.string().trim().min(1),
})
type In = z.infer<typeof schema>

export const createProjectCap = actionCapability<In, Awaited<ReturnType<typeof createProject>>>({
  id: 'create_project', kind: 'action', schema,
  run: (input) => createProject(input),            // ← verbatim, no new logic
  ai: {
    describe: 'PROPOSE creating a new project in this workspace.',
    aiSchema: z.object({ name: z.string() }),      // no workspaceId — ever
    resolve: async (ctx, a) => ({ workspaceId: ctx.workspaceId, ...(a as { name: string }) }),
    preview: async (_ctx, input) => ({ title: 'Create project', lines: [input.name] }),
    summarize: (_ctx, input, out) =>
      (out as { success: boolean }).success
        ? { ok: true, summary: `Created "${input.name}"` }
        : { ok: false, summary: 'Could not create the project' },
  },
})
```

Register it in `lib/capabilities/registry.ts` (`import` → add to `ALL`). The
**ProjectForm** calls `createProjectCap.run(payload)`; the **assistant** gets a
generated `create_project` write tool. Both paths execute the same
`createProject` action.

## Adding a capability

1. **Co-locate** `capability.ts` beside the section that owns the operation.
   `run` = the EXISTING action/query; `schema` = the canonical input.
2. If the assistant should use it, add the `ai` block: `describe`, optional
   `aiSchema`, `resolve` (names→ids + `workspaceId` from `ctx`), and for writes
   `preview` + `summarize`.
3. **Register** it in `lib/capabilities/registry.ts`.
4. **Repoint** the human form/page to call `cap.run`.
5. **Verify:** `tsc` clean; the human screen still works; the generated tool
   appears in `readToolsFromCaps()`/`writeToolsFromCaps()`.

## Invariants (do not break)

- **Writes never auto-execute.** Action caps register in an agent loop with
  **no** `execute`; the model can only PROPOSE.
- **Your confirm action is the SOLE mutation path** for the assistant:
  re-auth → re-validate → resolve → `cap.run` → audit.
- **`workspaceId` comes from `ctx`**, never an LLM field; `resolve` is read-only.
- **The loop and confirm share `capWriteExecute(cap)`** — one
  `resolve → run → summarize`, so they can never diverge.
- **Capabilities never navigate** or import route contracts. Navigation stays in
  Flow sections (`route.exits.*()`). Auth stays inside `run`
  (`requireWorkspaceRoleE` / `requireSessionE`).
```

- [ ] Step: edit `/Users/luca/dev/winter-park/template/CLAUDE.md` — four anchored edits:
  1. Docs table — insert after the `| [\`billing.md\`](docs/billing.md) | … |` row (added in 10.9; if 10.9 was skipped, anchor after the `planning.md` row instead):
     ```markdown
     | [`capabilities.md`](docs/capabilities.md) | Capability Registry — one operation, one definition; AI tools are GENERATED |
     ```
  2. New-feature checklist — insert after the line `□ Navigates on success?       → route.exits.*() — never raw URL strings`:
     ```
     □ A new app OPERATION?        → define it ONCE as a Capability (lib/capabilities) — form/page call cap.run; AI tools are GENERATED from cap.ai (never hand-listed). See docs/capabilities.md
     ```
  3. Critical invariants — insert this block immediately BEFORE the `## Quick decision guide` heading:
     ```markdown
     **Capabilities (the registry)**
     - A new app operation = ONE `Capability` (`lib/capabilities`): `{ id, kind, schema, run, ai? }`. `run` is the EXISTING action/query — never a new mutation path or new math
     - The form/page calls `cap.run(input)` (canonical `schema` input); never re-import the raw action where a capability exists
     - AI tools are GENERATED from `cap.ai` (`lib/capabilities/tools.ts`) — never hand-list a tool that duplicates an operation
     - Action caps register into an agent loop with NO `execute` — the model can only PROPOSE. Your confirm action is the SOLE mutation path: re-auth → re-validate → resolve → `cap.run` → audit
     - The loop's generated write tool AND your confirm step share ONE spine — `capWriteExecute(cap)` (`resolve → run → summarize`) — so they can never diverge
     - `workspaceId` always comes from `ctx` (`ai.resolve` injects it), NEVER an LLM arg; `resolve` is read-only (names→ids). Capabilities never navigate or import route contracts; auth stays inside `run`
     - Log every model call fail-open via `recordAiCall` (`lib/ai/instrument.ts`); classify final turn outcomes with `lib/ai/outcome.ts` — infra failures are NEVER refusals
     ```
  4. Quick decision guide table — insert after the `| Route needs access control | … |` row:
     ```markdown
     | New app operation (create/update/list/…) | Define ONE Capability (`lib/capabilities`); form/page call `cap.run` — `docs/capabilities.md` |
     | Want an AI assistant to read/propose an operation | Add an `ai` block to its Capability — never hand-write a tool |
     ```
- [ ] Step: edit `/Users/luca/dev/winter-park/template/.env.example` — append (as its own commented group, after the Stripe block):
  ```
  # ── AI (feature-gated) ──────────────────────────────────────────────────────
  # Vercel AI Gateway key for the `ai` SDK (model ids like 'anthropic/claude-…').
  # Absent ⇒ AI code paths must fall back / stay dormant (guard on presence).
  AI_GATEWAY_API_KEY=
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -c 'capabilities.md' CLAUDE.md` → expected: ≥ 2 (doc row + checklist). Run: `grep -rn 'salon\|[Ii]rene' docs/capabilities.md` → expected: no matches.
- [ ] Step: commit:
  ```bash
  git add docs/capabilities.md CLAUDE.md .env.example
  git commit -m "docs(ai): capabilities contract with template worked example + CLAUDE.md invariants

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

## Phase-end verification

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → all green (includes `lib/stripe/active.test.ts`, `lib/capabilities/resolve.test.ts`, `lib/capabilities/tools.test.ts`, `lib/ai/outcome.test.ts` plus earlier phases' suites)
- [ ] `npx storybook build --quiet` → exit 0 (AskAi, VoiceInput, InsightCard, AiForecastHero stories build)
- [ ] `grep -rn 'salonId\|salon_id\|Irene' lib/stripe lib/capabilities lib/ai components/ui/AskAi.tsx components/ui/VoiceInput.tsx components/ui/InsightCard.tsx components/ui/AiForecastHero.tsx "app/workspace/[workspaceId]" app/api/stripe 2>/dev/null` → no matches
- [ ] Full `next build` + migration run: defer to phase 13's gate when no scratch `DATABASE_URL` is configured (this phase regenerated the baseline twice — 10.2 and 10.12 — the final baseline contains workspaces billing columns AND `ai_call_log`)
- [ ] If any stripe task was skipped by review verdict, confirm `stripe-review.md` records the reason and that no dangling imports remain (`npx tsc --noEmit` already proves it)
