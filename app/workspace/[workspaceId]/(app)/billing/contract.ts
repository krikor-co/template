import { createRoute } from '@/lib/route-registry'
import { entry as workspaceEntry } from '../../entry'
import { entry as subscribeEntry } from '../../subscribe/entry'
import { entry } from './entry'

/**
 * BILLING contract.
 *
 * Exits:
 *   - `home`      → workspace home.
 *   - `subscribe` → the paywall (e.g. after a cancellation runs out).
 */
export const route = createRoute({
  entry,
  exits: {
    home:      (p: { workspaceId: string }) => workspaceEntry.href({ workspaceId: p.workspaceId }),
    subscribe: (p: { workspaceId: string }) => subscribeEntry.href({ workspaceId: p.workspaceId }),
  },
})

export type BillingExits = typeof route.exits
