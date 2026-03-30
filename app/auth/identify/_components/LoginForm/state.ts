export type State =
  | { status: 'idle';       returnTo?: string }
  | { status: 'submitting'; returnTo?: string }
  | { status: 'error';      returnTo?: string; message: string }
  | { status: 'success';    redirectTo: string }

export type Event =
  | { type: 'SUBMIT' }
  | { type: 'ERROR';   message: string }
  | { type: 'SUCCESS'; redirectTo: string }
  | { type: 'RETRY' }
