import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (event.type) {
    case 'SUBMIT':
      if (state.status !== 'idle') return state
      return state // TODO: transition to submitting
    case 'SUCCESS':
      return state // TODO: transition to success
    case 'ERROR':
      return { ...state, status: 'error', message: event.message }
    case 'RETRY':
      if (state.status !== 'error') return state
      return { ...state, status: 'idle' }
    default:
      return state
  }
}
