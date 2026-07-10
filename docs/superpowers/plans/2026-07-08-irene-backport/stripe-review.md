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
