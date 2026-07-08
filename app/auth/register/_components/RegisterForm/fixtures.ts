import type { State } from './state'
import { route } from '../../contract'

export const fixtures = {
  idle:       { status: 'idle',       identifier: 'user@example.com', identifierType: 'email' }                                   satisfies State,
  idlePhone:  { status: 'idle',       identifier: '+15550000000',     identifierType: 'phone' }                                   satisfies State,
  submitting: { status: 'submitting', identifier: 'user@example.com', identifierType: 'email' }                                   satisfies State,
  error:      { status: 'error',      identifier: 'user@example.com', identifierType: 'email', message: 'Something went wrong.' } satisfies State,
  success:    { status: 'success',    identifier: 'user@example.com', identifierType: 'email', redirectTo: route.exits.verify() }  satisfies State,
}
