import type { ActionResult } from './run-action'
import type { TaggedAppError } from './errors'

/**
 * Boundary helper: maps an `ActionResult<A>` to the legacy
 * `{ success: true, ...A } | { success: false, error: string }` shape that
 * every consumer expects, while collapsing the per-action 15-25-line
 * `switch (result.kind)` boilerplate into one terse opts object.
 *
 * Default routing: every error kind → `copy.fallback`. Override per-kind
 * for the kinds you care about. Use `custom` for routing that depends on
 * payload (e.g. `ValidationFailed.fieldErrors[amount]` → "amount must be > 0").
 *
 * Example:
 *
 *   const result = await runAction(addPayment(input), { actionName: 'addPayment' })
 *   return mapResult(result, {
 *     fallback:   e.addPayment,
 *     conflict:   e.paymentExceedsBalance,
 *     timeout:    e.settleBalanceFailed,
 *     custom: (r) =>
 *       r.kind === 'ValidationFailed' && r.fieldErrors?.amount?.length
 *         ? e.paymentZeroOrNeg
 *         : null,
 *   })
 */
export type BoundaryCopy = {
  /** Used when no per-kind override matches. */
  fallback:    string
  validation?: string
  notFound?:   string
  forbidden?:  string
  conflict?:   string
  /** If omitted, the limiter's own message (`result.error`) is passed through. */
  rateLimit?:  string
  timeout?:    string
  external?:   string
  db?:         string
  /** Workspace has no active subscription (billing gate). */
  subscriptionInactive?: string
  /**
   * Bespoke routing — runs first. Return a string to override the
   * per-kind default, or `null` to fall through to the kind switch.
   * Used for sentinel-marker matching, fieldError-based routing, etc.
   */
  custom?:     (failure: BoundaryFailure) => string | null
}

/** The shape of `ActionResult<A>` when `success` is `false`. */
export type BoundaryFailure = {
  success:      false
  error:        string
  kind:         TaggedAppError['_tag']
  fieldErrors?: Record<string, string[]>
}

export type FlatActionResult<A> =
  | ({ success: true } & A)
  | { success: false; error: string }

export function mapResult<A>(
  result:  ActionResult<A>,
  copy:    BoundaryCopy,
): FlatActionResult<A> {
  if (result.success) return result

  const failure = result as BoundaryFailure
  const overrideMsg = copy.custom?.(failure)
  if (overrideMsg) return { success: false, error: overrideMsg }

  const message = (() => {
    switch (failure.kind) {
      case 'ValidationFailed':     return copy.validation ?? copy.fallback
      case 'NotFound':             return copy.notFound   ?? copy.fallback
      case 'Forbidden':
      case 'Unauthenticated':      return copy.forbidden  ?? copy.fallback
      case 'Conflict':             return copy.conflict   ?? copy.fallback
      case 'RateLimited':          return copy.rateLimit  ?? failure.error
      case 'Timeout':              return copy.timeout    ?? copy.fallback
      case 'ExternalServiceError': return copy.external   ?? copy.fallback
      case 'DbError':              return copy.db         ?? copy.fallback
      case 'SubscriptionInactive': return copy.subscriptionInactive ?? copy.fallback
      default:                     return copy.fallback
    }
  })()

  return { success: false, error: message }
}
