import type { State } from './state'
import { route } from '../../contract'

export const fixtures = {
  idle:       { status: 'idle',       email: 'user@example.com' }                                   satisfies State,
  submitting: { status: 'submitting', email: 'user@example.com' }                                   satisfies State,
  error:      { status: 'error',      email: 'user@example.com', message: 'Something went wrong.' } satisfies State,
  success:    { status: 'success',    email: 'user@example.com', redirectTo: route.exits.verify() }  satisfies State,
}
