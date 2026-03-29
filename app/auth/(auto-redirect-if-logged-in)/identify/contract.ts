import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as verifyEntry }   from '../../verify/entry'
import { entry as registerEntry } from '../register/entry'

export const route = createRoute({
  entry,
  exits: {
    verify:   verifyEntry.href,
    register: registerEntry.href,
  },
})
