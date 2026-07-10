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
