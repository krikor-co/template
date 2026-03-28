import type { State } from './state'

export const fixtures = {
  idle:       { status: 'idle',       email: 'user@example.com', code: '' } satisfies State,
  submitting: { status: 'submitting', email: 'user@example.com', code: '123456' } satisfies State,
  error:      { status: 'error',      email: 'user@example.com', code: '000000', message: 'Invalid or expired code.' } satisfies State,
  success:    { status: 'success' } satisfies State,
}
