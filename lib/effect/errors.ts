import { Data } from 'effect'

/**
 * Tagged error classes for every typed failure a server action might emit.
 *
 * Each class extends `Data.TaggedError('Tag')<{ payload }>`, which gives us:
 *   - A discriminator field (`_tag: 'Tag'`) usable with switch/discriminated unions.
 *   - Structural equality (good for tests).
 *   - A constructor that takes the payload object.
 *
 * The `runAction` boundary maps these to `{ success: false, kind: _tag, error: message }`.
 */
/** Caller authenticated but lacks the required role on this resource (e.g. not a member of the workspace with the required role). */
export class Forbidden extends Data.TaggedError('Forbidden')<{ message: string }> {}
/** No valid session — UX should redirect to login. Distinct from Forbidden so the boundary can branch. */
export class Unauthenticated extends Data.TaggedError('Unauthenticated')<{ message: string }> {}
/** A referenced row doesn't exist or has been soft-deleted. */
export class NotFound extends Data.TaggedError('NotFound')<{ entity: string; id?: string | number }> {
  get message() { return `${this.entity} not found` }
}
/** Input failed schema parsing OR a business rule. Use `fieldErrors` for form-field highlighting. */
export class ValidationFailed extends Data.TaggedError('ValidationFailed')<{
  message:      string
  fieldErrors?: Record<string, string[]>
}> {}
/** Action throttled — `retryAfterMs` indicates when the client may retry. */
export class RateLimited extends Data.TaggedError('RateLimited')<{ message: string; retryAfterMs?: number }> {}
/**
 * Business invariant violated (e.g. transaction already settled, duplicate row,
 * payment exceeds balance). Use sentinel marker strings in `message` to route
 * specific copy at the boundary.
 */
export class ConflictError extends Data.TaggedError('Conflict')<{ message: string }> {}
/** A third-party call failed — wrap the underlying error in `cause`. Used for Twilio, payment providers, etc. */
export class ExternalServiceError extends Data.TaggedError('ExternalServiceError')<{
  service: string
  cause:   unknown
}> {
  get message() { return `${this.service} request failed` }
}
/** Catch-all for database failures — `dbE.try` maps thrown errors here. */
export class DbError extends Data.TaggedError('DbError')<{ cause: unknown }> {
  get message() {
    return this.cause instanceof Error ? this.cause.message : 'Database error'
  }
}
/**
 * Boundary or per-operation `Effect.timeoutFail` fired. NOT raw `Effect.timeout`'s
 * built-in `TimeoutException` — we always remap to this typed error so the failure
 * stays inside the TaggedAppError union. Wrap with
 * `Effect.timeoutFail({ duration, onTimeout: () => new Timeout(...) })`.
 */
export class Timeout extends Data.TaggedError('Timeout')<{ message: string; durationMs?: number }> {}
/**
 * The workspace has no ACTIVE subscription (status ∉ {active,trialing}).
 * Raised by the billing gate (Stripe phase) as action-level defense-in-depth
 * behind the layout gates — a write into a paused workspace must fail closed
 * even if a stale client somehow reaches the server action.
 */
export class SubscriptionInactive extends Data.TaggedError('SubscriptionInactive')<{ workspaceId: number }> {
  get message() { return `workspace ${this.workspaceId} has no active subscription` }
}

/** Union of every tagged error any action might emit. */
export type TaggedAppError =
  | Forbidden
  | Unauthenticated
  | NotFound
  | ValidationFailed
  | RateLimited
  | ConflictError
  | ExternalServiceError
  | DbError
  | Timeout
  | SubscriptionInactive
