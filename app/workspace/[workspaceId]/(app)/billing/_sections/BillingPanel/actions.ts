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
