import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as identifyEntry } from '@/app/auth/identify/entry'
import { entry as onboardingEntry } from '@/app/onboarding/entry'
import { entry as workspaceEntry } from '@/app/workspace/[workspaceId]/entry'

export const route = createRoute({
  entry,
  exits: {
    login:      identifyEntry.href,
    onboarding: () => onboardingEntry.href(),
    workspace:  (p: { workspaceId: string }) => workspaceEntry.href({ workspaceId: p.workspaceId }),
  },
})
