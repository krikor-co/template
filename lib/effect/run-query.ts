import { Duration, Effect, pipe } from 'effect'
import { TracingLayer } from './tracing'
import { Timeout } from './errors'

/**
 * Boundary for cached queries (`'use cache'` functions) and other Effects
 * that need to surface as a plain `Promise<A>` to the caller.
 *
 * Differences from `runAction`:
 *   - No discriminated `{ success, ... }` envelope — returns `Promise<A>` and
 *     THROWS on failure (matches Drizzle's native behavior, which is what
 *     `'use cache'` consumers already expect).
 *   - No request-scoped concerns — cached query bodies must remain referentially
 *     transparent in their inputs; auth and cookies have to live OUTSIDE the
 *     `'use cache'` block.
 *   - Provides the `TracingLayer` so `Effect.withSpan(...)` inside the query
 *     emits real OTel spans.
 *   - Bakes in DEFAULT cross-cutting concerns when `opts` are supplied:
 *     `Effect.timeoutFail` (default 30s) → typed `Timeout` (becomes a thrown
 *     Error at the boundary) and `Effect.withSpan(opts.queryName, ...)`.
 *
 * Use inside a `'use cache'` function like this:
 *
 *   'use cache'
 *   tagWith(Tag.X({ workspaceId }))
 *   withCacheProfile('warm')
 *   return runQuery(pipe(
 *     dbE.run(db.select(...).from(...).where(...)),
 *     Effect.map((rows) => rows.map(transform)),
 *   ), { queryName: 'fetchSomething', attributes: { workspaceId } })
 */
export type RunQueryOpts = {
  /** Span name for the boundary `Effect.withSpan(...)`. Recommended. */
  queryName?:  string
  /** Default 30 seconds. `null` to disable. */
  timeout?:    Duration.DurationInput | null
  /** Span attributes. */
  attributes?: Record<string, string | number | boolean | undefined>
}

const DEFAULT_TIMEOUT: Duration.DurationInput = '30 seconds'

export const runQuery = <A, E>(
  effect: Effect.Effect<A, E, never>,
  opts:   RunQueryOpts = {},
): Promise<A> => {
  const timeout = opts.timeout === undefined ? DEFAULT_TIMEOUT : opts.timeout

  let prepared: Effect.Effect<A, E | Timeout, never> = effect
  if (timeout !== null) {
    prepared = pipe(prepared, Effect.timeoutFail({
      duration:  timeout,
      onTimeout: () => new Timeout({
        message:    `${opts.queryName ?? 'query'} timed out`,
        durationMs: Duration.toMillis(Duration.decode(timeout)),
      }),
    }))
  }
  if (opts.queryName) {
    prepared = pipe(prepared, Effect.withSpan(opts.queryName, {
      attributes: opts.attributes ?? {},
    }))
  }

  return Effect.runPromise(pipe(prepared, Effect.provide(TracingLayer)))
}
