import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'SUBMIT')  return { status: 'submitting' }
      break
    case 'submitting':
      if (event.type === 'ERROR')   return { status: 'error',   message: event.message }
      if (event.type === 'SUCCESS') return { status: 'success', redirectTo: event.redirectTo }
      break
    case 'error':
      if (event.type === 'RETRY')   return { status: 'idle' }
      if (event.type === 'SUBMIT')  return { status: 'submitting' }
      break
  }
  return state
}
