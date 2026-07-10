/**
 * BillingPanel state — the workspace owner's view of the SaaS subscription.
 *
 * Type-5-ish client section (no form, but server actions drive it):
 * `redirecting` covers the Stripe portal handoff (`window.location.assign`);
 * `mutating` covers in-app cancel-at-period-end / resume (then
 * `router.refresh()` re-reads the synced billing state). Failures → `error`.
 */
export type State =
  | { status: 'idle' }
  | { status: 'redirecting' }
  | { status: 'mutating'; action: 'cancel' | 'resume' }
  | { status: 'error'; message: string }

export type Event =
  | { type: 'PORTAL' }
  | { type: 'MUTATE'; action: 'cancel' | 'resume' }
  | { type: 'DONE' }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }
