import { Cause, Duration, Effect, Exit, pipe } from 'effect'
import { TracingLayer } from './tracing'
import { Timeout, type TaggedAppError } from './errors'
import { getSession } from '@/lib/auth/session'
import { currentActor } from './actor-context'

/**
 * Boundary: convert an Effect program into a server-action result.
 *
 * - Provides the OTel tracing Layer so `Effect.withSpan(...)` actually emits spans.
 * - Bakes in DEFAULT cross-cutting concerns when `opts` are supplied:
 *     - `Effect.timeoutFail` with default 30s ceiling → typed `Timeout` error.
 *     - `Effect.withSpan(opts.actionName, { attributes: opts.attributes ?? {} })`.
 *   Per-action overrides still work — pass `timeout: '5 seconds'` for a tighter
 *   ceiling, or apply your own `Effect.withSpan` inside the pipe (it'll nest
 *   under the boundary span).
 * - Maps typed (`E`) failures to `{ success: false, error, kind }`.
 * - Catches defects (raw throws) → `{ success: false, kind: 'DbError' }` with
 *   `Cause.pretty(cause)` logged for the error tracker.
 *
 * Result shape note: success is FLATTENED — `{ success: true, ...data }` — so
 * section components read success-branch fields directly (e.g. `result.personId`).
 *
 * Client-cancel propagation is NOT supported. Next 16 has no documented way
 * to read the request `AbortSignal` from a server action — `Effect.timeout`
 * is the only cancellation primitive available server-side.
 */
export type ActionResult<A> =
  | ({ success: true } & A)
  | { success: false; error: string; kind: TaggedAppError['_tag']; fieldErrors?: Record<string, string[]> }

export type RunActionOpts = {
  /**
   * Span name for the boundary `Effect.withSpan(...)`. Strongly recommended —
   * makes every action show up in OTel traces with its name. If omitted,
   * no boundary span is created (existing inner `Effect.withSpan(...)` calls
   * still work).
   */
  actionName?: string
  /**
   * Default 30 seconds. Pass a shorter duration (`'5 seconds'`) for tight
   * latency budgets, or `null` to disable the boundary timeout entirely
   * (still allowed for callers that already wrap with `timeoutFail` inside).
   */
  timeout?:    Duration.DurationInput | null
  /** Span attributes; merged with `actionName`-derived ones. */
  attributes?: Record<string, string | number | boolean | undefined>
}

const DEFAULT_TIMEOUT: Duration.DurationInput = '30 seconds'

export async function runAction<A, E extends TaggedAppError>(
  effect: Effect.Effect<A, E, never>,
  opts:   RunActionOpts = {},
): Promise<ActionResult<A>> {
  const timeout = opts.timeout === undefined ? DEFAULT_TIMEOUT : opts.timeout

  // Apply boundary defaults — timeoutFail then withSpan. Inner explicit calls
  // still take precedence (an inner 5s timeoutFail fires before the outer 30s).
  let prepared: Effect.Effect<A, E | Timeout, never> = effect
  if (timeout !== null) {
    prepared = pipe(prepared, Effect.timeoutFail({
      duration:  timeout,
      onTimeout: () => new Timeout({
        message:    `${opts.actionName ?? 'action'} timed out`,
        durationMs: Duration.toMillis(Duration.decode(timeout)),
      }),
    }))
  }
  if (opts.actionName) {
    // Attribute the boundary span to the acting user (fail-open; absent outside a
    // request context such as cron). getSession is request-cached, so this is free
    // when the action already read the session. Powers per-user span attribution in trace_span.
    let userId: string | undefined
    try { userId = (await getSession())?.userId } catch { /* unauthenticated context — leave unattributed */ }
    // actor marks AI-initiated work (an assistant confirm path) so traces can
    // distinguish it from a direct human action by the same user.
    const actor = currentActor()
    prepared = pipe(prepared, Effect.withSpan(opts.actionName, {
      attributes: {
        ...opts.attributes,
        ...(userId != null ? { userId } : {}),
        ...(actor ? { actor } : {}),
      },
    }))
  }

  const exit = await Effect.runPromiseExit(
    pipe(prepared, Effect.provide(TracingLayer)) as Effect.Effect<A, E | Timeout, never>,
  )

  return Exit.match(exit, {
    onSuccess: (data): ActionResult<A> => ({ success: true, ...(data as A) }),
    onFailure: (cause): ActionResult<A> => {
      const failure = Cause.failureOption(cause)
      if (failure._tag === 'Some') {
        const e = failure.value
        return {
          success: false,
          error:   e.message,
          kind:    e._tag,
          // ValidationFailed carries field-level details; copy them to the boundary.
          ...(e._tag === 'ValidationFailed' && (e as { fieldErrors?: Record<string, string[]> }).fieldErrors
            ? { fieldErrors: (e as { fieldErrors?: Record<string, string[]> }).fieldErrors }
            : {}),
        }
      }
      console.error('[runAction defect]', Cause.pretty(cause))
      return { success: false, error: 'Unexpected server error', kind: 'DbError' }
    },
  })
}
