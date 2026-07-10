import { createRoute } from '@/lib/route-registry'
import { entry as workspaceEntry } from '../entry'
import { entry as successEntry } from './success/entry'
import { entry } from './entry'

/**
 * SUBSCRIBE contract.
 *
 * Exits:
 *   - `home`    → the billing-gated workspace home (once the sub is active).
 *   - `self`    → this paywall (Stripe cancel_url; built absolute by the section).
 *   - `success` → the post-checkout return page that handles the webhook race
 *                 (Stripe success_url; built absolute by the section).
 */
export const route = createRoute({
  entry,
  exits: {
    home:    (p: { workspaceId: string }) => workspaceEntry.href({ workspaceId: p.workspaceId }),
    self:    (p: { workspaceId: string }) => entry.href({ workspaceId: p.workspaceId }),
    success: (p: { workspaceId: string }) => successEntry.href({ workspaceId: p.workspaceId }),
  },
})

export type SubscribeExits = typeof route.exits
