import type { State } from './state'

export const fixtures = {
  idle:       { status: 'idle' }                                   satisfies State,
  submitting: { status: 'submitting' }                             satisfies State,
  error:      { status: 'error', message: 'User not found.' }      satisfies State,
  success:    { status: 'success', redirectTo: '/auth/verify' }    satisfies State,
}
