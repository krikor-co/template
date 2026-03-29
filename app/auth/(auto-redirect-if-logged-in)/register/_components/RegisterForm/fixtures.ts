import type { State } from './state'

export const fixtures = {
  idle:       { status: 'idle',       email: 'user@example.com', name: '' }                              satisfies State,
  submitting: { status: 'submitting', email: 'user@example.com', name: 'Alice' }                         satisfies State,
  error:      { status: 'error',      email: 'user@example.com', name: 'Alice', message: 'Something went wrong.' } satisfies State,
}
