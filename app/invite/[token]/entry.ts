import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

/**
 * Public invite-accept page.
 *
 * URL: /invite/:token  — `token` is the invite's `crypto.randomUUID()`.
 */
const schema = z.object({
  token: z.string(),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params) => `/invite/${p.token}`,
  parse: (ctx: ParseContext) => schema.parse(ctx.params),
}
