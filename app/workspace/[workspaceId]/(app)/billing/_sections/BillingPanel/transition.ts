import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'PORTAL') return { status: 'redirecting' }
      if (event.type === 'MUTATE') return { status: 'mutating', action: event.action }
      break
    case 'redirecting':
      // Browser is navigating to Stripe; only an error interrupts.
      if (event.type === 'ERROR') return { status: 'error', message: event.message }
      break
    case 'mutating':
      if (event.type === 'DONE') return { status: 'idle' }
      if (event.type === 'ERROR') return { status: 'error', message: event.message }
      break
    case 'error':
      if (event.type === 'RETRY') return { status: 'idle' }
      if (event.type === 'PORTAL') return { status: 'redirecting' }
      if (event.type === 'MUTATE') return { status: 'mutating', action: event.action }
      break
  }
  return state
}
