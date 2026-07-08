import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as identifyEntry } from '@/app/auth/identify/entry'
import { entry as dashboardEntry } from '@/app/dashboard/entry'

export const route = createRoute({
  entry,
  exits: {
    /** Unauthenticated visitor → login, carrying this workspace as returnTo. */
    login: (p: { workspaceId: string }) =>
      identifyEntry.href({ returnTo: entry.href({ workspaceId: p.workspaceId }) }),
    /** Authenticated but not a member → back to the dispatcher. */
    dashboard: () => dashboardEntry.href(),
  },
})
