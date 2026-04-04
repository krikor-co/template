import type { State } from './state'
import { route } from '../../contract'

export const fixtures = {
  idle:       { status: 'idle' }                                       satisfies State,
  submitting: { status: 'submitting' }                                 satisfies State,
  error:      { status: 'error', message: 'Something went wrong.' }    satisfies State,
  success:    { status: 'success', redirectTo: route.exits.verify() }  satisfies State,
}
