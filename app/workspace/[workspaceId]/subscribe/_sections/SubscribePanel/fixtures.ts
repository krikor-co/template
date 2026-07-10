import type { State } from './state'

/** One State per status — Suspense fallbacks and stories. */
export const fixtures: Record<State['status'], State> = {
  idle:        { status: 'idle' },
  redirecting: { status: 'redirecting', target: 'price_demo' },
  error:       { status: 'error', message: 'Could not start checkout. Try again.' },
}
