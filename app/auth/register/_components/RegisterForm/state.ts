import type { IdentifierType } from '@/lib/auth/identifier'

export type State =
  | { status: 'idle';       identifier: string; identifierType: IdentifierType }
  | { status: 'submitting'; identifier: string; identifierType: IdentifierType }
  | { status: 'error';      identifier: string; identifierType: IdentifierType; message: string }
  | { status: 'success';    identifier: string; identifierType: IdentifierType; redirectTo: string }

export type Event =
  | { type: 'SUBMIT' }
  | { type: 'ERROR';   message: string }
  | { type: 'SUCCESS'; redirectTo: string }
  | { type: 'RETRY' }
