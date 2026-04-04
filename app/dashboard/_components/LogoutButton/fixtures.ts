import type { State } from './state'

export const fixtures = {
  idle:       { status: 'idle' }                                    satisfies State,
  submitting: { status: 'submitting' }                              satisfies State,
  error:      { status: 'error',   message: 'Failed to log out.' } satisfies State,
  success:    { status: 'success', redirectTo: '/auth/identify' }    satisfies State,
}
