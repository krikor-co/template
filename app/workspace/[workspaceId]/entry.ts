import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

/**
 * Workspace home. The canonical tenant-scoped tree lives under
 * `/workspace/[workspaceId]/…` — the multi-tenant middleware rewrites
 * `<slug>.<base-domain>/…` onto it (see middleware.ts + docs/tenancy.md).
 */
const schema = z.object({
  workspaceId: z.string().regex(/^\d+$/),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params) => `/workspace/${p.workspaceId}`,
  parse: (ctx: ParseContext) => schema.parse(ctx.params),
}
