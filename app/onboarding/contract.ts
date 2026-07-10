import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as identifyEntry } from '@/app/auth/identify/entry'
import { entry as dashboardEntry } from '@/app/dashboard/entry'

export const route = createRoute({
  entry,
  exits: {
    login:     () => identifyEntry.href({ returnTo: entry.href() }),
    dashboard: () => dashboardEntry.href(),
  },
})
