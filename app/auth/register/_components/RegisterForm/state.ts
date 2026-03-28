export type State =
  | { status: 'idle';       email: string; name: string; returnTo?: string }
  | { status: 'submitting'; email: string; name: string; returnTo?: string }
  | { status: 'error';      email: string; name: string; returnTo?: string; message: string }

export type Event =
  | { type: 'CHANGE_NAME'; name: string }
  | { type: 'SUBMIT' }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }
