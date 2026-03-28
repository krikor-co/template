import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as verifyEntry }   from '../verify/entry'
import { entry as identifyEntry } from '../identify/entry'

export const route = createRoute({
  entry,
  exits: {
    verify: verifyEntry.href,
    back:   identifyEntry.href,
  },
})
