import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

const schema = z.object({
  email:    z.string().email(),
  returnTo: z.string().optional(),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href: (p: Params) => {
    const base = `/auth/register?email=${encodeURIComponent(p.email)}`
    return p.returnTo ? `${base}&returnTo=${encodeURIComponent(p.returnTo)}` : base
  },
  parse: (ctx: ParseContext) => schema.parse(ctx.searchParams),
}
