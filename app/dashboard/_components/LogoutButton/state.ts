export type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error';   message: string }
  | { status: 'success'; redirectTo: string }

export type Event =
  | { type: 'SUBMIT' }
  | { type: 'ERROR';   message: string }
  | { type: 'SUCCESS'; redirectTo: string }
  | { type: 'RETRY' }
