import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as loginEntry } from '../(auto-redirect-if-logged-in)/identify/entry'

export const route = createRoute({
  entry,
  exits: {
    back:      loginEntry.href,
    dashboard: () => '/dashboard',
  },
})
