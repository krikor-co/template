export type State =
  | { status: 'idle';       email: string; returnTo?: string }
  | { status: 'submitting'; email: string; returnTo?: string }
  | { status: 'error';      email: string; returnTo?: string; message: string }
  | { status: 'success';    redirectTo: string }

export type Event =
  | { type: 'SUBMIT' }
  | { type: 'ERROR';   message: string }
  | { type: 'SUCCESS'; redirectTo: string }
  | { type: 'RETRY' }
