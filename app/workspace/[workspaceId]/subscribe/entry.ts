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
