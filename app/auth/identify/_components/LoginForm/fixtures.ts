import type { State } from './state'

export const fixtures = {
  idle:       { status: 'idle',       email: '' } satisfies State,
  submitting: { status: 'submitting', email: 'user@example.com' } satisfies State,
  error:      { status: 'error',      email: 'user@example.com', message: 'User not found.' } satisfies State,
}
