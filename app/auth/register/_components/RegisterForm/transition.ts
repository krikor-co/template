import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'CHANGE_NAME') return { ...state, name: event.name }
      if (event.type === 'SUBMIT')      return { ...state, status: 'submitting' }
      break
    case 'submitting':
      if (event.type === 'ERROR')       return { ...state, status: 'error', message: event.message }
      break
    case 'error':
      if (event.type === 'CHANGE_NAME') return { ...state, status: 'idle', name: event.name }
      if (event.type === 'RETRY')       return { ...state, status: 'idle' }
      if (event.type === 'SUBMIT')      return { ...state, status: 'submitting' }
      break
  }
  return state
}
