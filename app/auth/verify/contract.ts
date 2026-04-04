import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as loginEntry }     from '../identify/entry'
import { entry as dashboardEntry } from '@/app/dashboard/entry'

export const route = createRoute({
  entry,
  exits: {
    back:      loginEntry.href,
    dashboard: dashboardEntry.href,
  },
})
