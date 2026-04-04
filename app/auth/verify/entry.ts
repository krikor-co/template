import type { ParseContext } from '@/lib/route-registry'

export type Params = Record<string, never>

export const entry = {
  href:  (_p: Params = {} as Params) => '/auth/verify',
  parse: (_ctx: ParseContext) => ({} as Params),
}
