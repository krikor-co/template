import type { State } from './state'

/** One State per status — Suspense fallbacks and stories. */
export const fixtures: Record<State['status'], State> = {
  pending: { status: 'pending' },
  success: { status: 'success', redirectTo: '/workspace/1' },
}
