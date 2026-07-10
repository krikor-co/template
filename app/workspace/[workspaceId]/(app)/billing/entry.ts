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
