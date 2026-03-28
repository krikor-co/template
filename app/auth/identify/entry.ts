import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

const schema = z.object({
  returnTo: z.string().optional(),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params = {}) => p.returnTo ? `/auth/identify?returnTo=${encodeURIComponent(p.returnTo)}` : '/auth/identify',
  parse: (ctx: ParseContext) => schema.parse(ctx.searchParams),
}
