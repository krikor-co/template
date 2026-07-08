import type { ParseContext } from '@/lib/route-registry'

/**
 * Post-login onboarding stub. The dispatcher sends users with ZERO workspace
 * memberships here. Replace this route's page with your app's real
 * create-first-workspace flow — see docs/tenancy.md.
 */
export type Params = Record<string, never>

export const entry = {
  href:  (_p: Params = {} as Params) => '/onboarding',
  parse: (_ctx: ParseContext) => ({} as Params),
}
