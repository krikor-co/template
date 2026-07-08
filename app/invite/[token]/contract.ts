import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as workspaceEntry } from '@/app/workspace/[workspaceId]/entry'
import { entry as dashboardEntry } from '@/app/dashboard/entry'

/**
 * Invite-accept page contract.
 *
 * Exits:
 *   - `workspace` — the accepted workspace's home (post-accept landing).
 *   - `dashboard` — neutral landing for the error states.
 */
export const route = createRoute({
  entry,
  exits: {
    workspace: (p: { workspaceId: string }) => workspaceEntry.href({ workspaceId: p.workspaceId }),
    dashboard: () => dashboardEntry.href(),
  },
})
