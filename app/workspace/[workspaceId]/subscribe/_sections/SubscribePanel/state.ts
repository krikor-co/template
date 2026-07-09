/**
 * SubscribePanel state — the paywall plan picker.
 *
 * A click sets `redirecting` (keyed to the plan's priceId), calls the checkout
 * action, then assigns the returned hosted Stripe URL. On failure → `error`.
 * Mirrors the BillingPanel's redirect-via-action shape.
 */
export type State =
  | { status: 'idle' }
  | { status: 'redirecting'; target: string }
  | { status: 'error'; message: string }

export type Event =
  | { type: 'START'; target: string }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }
