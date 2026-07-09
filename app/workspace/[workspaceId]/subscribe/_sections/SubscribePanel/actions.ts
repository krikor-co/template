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
