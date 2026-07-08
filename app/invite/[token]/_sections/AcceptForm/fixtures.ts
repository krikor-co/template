import type { State } from './state'

export const fixtures = {
  idle:       { status: 'idle' } satisfies State,
  submitting: { status: 'submitting' } satisfies State,
  success:    { status: 'success', redirectTo: '/dashboard' } satisfies State,
  error:      { status: 'error', message: 'Failed to accept invite.' } satisfies State,
}
