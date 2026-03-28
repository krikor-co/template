export type State =
  | { status: 'idle';        email: string; code: string; returnTo?: string }
  | { status: 'submitting';  email: string; code: string; returnTo?: string }
  | { status: 'error';       email: string; code: string; returnTo?: string; message: string }
  | { status: 'success' }

export type Event =
  | { type: 'CHANGE_CODE'; code: string }
  | { type: 'SUBMIT' }
  | { type: 'ERROR'; message: string }
  | { type: 'SUCCESS' }
