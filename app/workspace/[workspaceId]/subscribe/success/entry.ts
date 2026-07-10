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
