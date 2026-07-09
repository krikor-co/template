/**
 * CheckoutSuccess state — the post-checkout poller.
 *
 * The page already attempted an immediate sync. If that hasn't landed yet this
 * section polls `checkActive` until the workspace's subscription reads active,
 * then forwards home. `pending` waits; `success` carries the redirect target so
 * `useRedirectOnSuccess` forwards there.
 */
export type State =
  | { status: 'pending' }
  | { status: 'success'; redirectTo: string }

export type Event =
  | { type: 'ACTIVE'; redirectTo: string }
