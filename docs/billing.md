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
  an ungated sibling route (e.g. an `/inactive` pattern) and branch the gate on
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
