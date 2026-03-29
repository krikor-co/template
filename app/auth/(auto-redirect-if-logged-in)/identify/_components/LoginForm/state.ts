export type State =
  | { status: 'idle';        email: string; returnTo?: string }
  | { status: 'submitting';  email: string; returnTo?: string }
  | { status: 'error';       email: string; returnTo?: string; message: string }

export type Event =
  | { type: 'CHANGE_EMAIL'; email: string }
  | { type: 'SUBMIT' }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }
