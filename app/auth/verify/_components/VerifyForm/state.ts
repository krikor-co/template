export type State =
  | { status: 'idle';       email: string }
  | { status: 'submitting'; email: string }
  | { status: 'error';      email: string; message: string }
  | { status: 'success';    email: string; redirectTo: string }

export type Event =
  | { type: 'SUBMIT' }
  | { type: 'ERROR';   message: string }
  | { type: 'SUCCESS'; redirectTo: string }
  | { type: 'RETRY' }
