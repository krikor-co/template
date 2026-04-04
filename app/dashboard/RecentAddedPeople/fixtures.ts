import type { State } from './state'

export const fixtures = {
  idle:  { status: 'idle' }                                    satisfies State,
  error: { status: 'error', message: 'Something went wrong.' } satisfies State,
}
