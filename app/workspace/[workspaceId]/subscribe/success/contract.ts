import { createRoute } from '@/lib/route-registry'
import { entry as workspaceEntry } from '../../entry'
import { entry as subscribeEntry } from '../entry'
import { entry } from './entry'

/**
 * SUBSCRIBE / SUCCESS contract.
 *
 * Exits:
 *   - `home`      → the billing-gated workspace home — where a freshly
 *                   subscribed workspace lands once the subscription confirms
 *                   active.
 *   - `subscribe` → back to the paywall (e.g. checkout never completed).
 */
export const route = createRoute({
  entry,
  exits: {
    home:      (p: { workspaceId: string }) => workspaceEntry.href({ workspaceId: p.workspaceId }),
    subscribe: (p: { workspaceId: string }) => subscribeEntry.href({ workspaceId: p.workspaceId }),
  },
})

export type SubscribeSuccessExits = typeof route.exits
