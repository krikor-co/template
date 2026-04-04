export type State =
  | { status: 'idle' }
  | { status: 'error'; message: string }

export type Event =
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }
