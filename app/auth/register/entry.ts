import type { ParseContext } from '@/lib/route-registry'

export type Params = Record<string, never>

export const entry = {
  href:  (_p: Params = {} as Params) => '/auth/register',
  parse: (_ctx: ParseContext) => ({} as Params),
}
