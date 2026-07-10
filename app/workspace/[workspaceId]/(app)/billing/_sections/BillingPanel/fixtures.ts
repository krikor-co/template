import type { State } from './state'

/** One State per status — Suspense fallbacks and stories. */
export const fixtures: Record<State['status'], State> = {
  idle:        { status: 'idle' },
  redirecting: { status: 'redirecting' },
  mutating:    { status: 'mutating', action: 'cancel' },
  error:       { status: 'error', message: 'Could not reach billing. Try again.' },
}
