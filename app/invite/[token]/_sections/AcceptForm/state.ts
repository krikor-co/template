/**
 * AcceptForm state — Type 5 (client + action). `idle` shows the confirm
 * button; `submitting` disables it; `success` fires the redirect; `error`
 * re-shows the button with a message.
 */
export type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; redirectTo: string }
  | { status: 'error'; message: string }

export type Event =
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; redirectTo: string }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }
