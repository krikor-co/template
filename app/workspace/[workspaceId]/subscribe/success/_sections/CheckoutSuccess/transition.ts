import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  if (state.status === 'pending' && event.type === 'ACTIVE') {
    return { status: 'success', redirectTo: event.redirectTo }
  }
  return state
}
