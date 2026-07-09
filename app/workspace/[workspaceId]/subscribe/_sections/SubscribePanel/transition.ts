import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'START') return { status: 'redirecting', target: event.target }
      break
    case 'redirecting':
      // Browser is navigating to Stripe; only an error interrupts.
      if (event.type === 'ERROR') return { status: 'error', message: event.message }
      break
    case 'error':
      if (event.type === 'RETRY') return { status: 'idle' }
      if (event.type === 'START') return { status: 'redirecting', target: event.target }
      break
  }
  return state
}
