import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'CHANGE_EMAIL') return { ...state, email: event.email }
      if (event.type === 'SUBMIT')       return { ...state, status: 'submitting' }
      break
    case 'submitting':
      if (event.type === 'ERROR')        return { ...state, status: 'error', message: event.message }
      break
    case 'error':
      if (event.type === 'CHANGE_EMAIL') return { ...state, status: 'idle', email: event.email }
      if (event.type === 'RETRY')        return { ...state, status: 'idle' }
      if (event.type === 'SUBMIT')       return { ...state, status: 'submitting' }
      break
  }
  return state
}
