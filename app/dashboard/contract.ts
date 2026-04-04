import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as identifyEntry } from '@/app/auth/identify/entry'

export const route = createRoute({
  entry,
  exits: {
    login: identifyEntry.href,
  },
})
