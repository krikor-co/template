import { Cause, Effect, Exit, pipe } from 'effect'
import { TracingLayer } from './tracing'
import { getSession } from '@/lib/auth/session'

/**
 * Lightweight tracing wrapper for server functions NOT yet on the Effect
 * `runAction` boundary. It runs the plain-async `fn` inside an `Effect.withSpan`
 * scope (with the TracingLayer provided) so a span lands in `trace_span` —
 * capturing the operation name, timing, ok/error, workspaceId, and the acting
 * `userId` — WITHOUT rewriting the function to Effect or changing its
 * return/throw contract.
 *
 * Why this exists: the OTel SDK is Effect-scoped (`tracing.ts`), so a raw span
 * outside an `Effect.provide(TracingLayer)` scope is a silent no-op. This bridges
 * legacy actions into the same trace stream as `runAction` without the risky
 * full Effect migration. On success it returns `fn`'s value verbatim; on throw it
 * re-throws the ORIGINAL error, so the caller's existing handling is unchanged.
 * A stepping stone — these can later graduate to full `runAction` pipes.
 *
 * IMPORTANT: only for `'use server'` actions (which may read cookies). Do NOT use
 * inside a `'use cache'` scope — `getSession()` reads cookies, forbidden there;
 * trace cached reads with `runQuery({ queryName })` instead.
 */
export async function tracedAction<T>(
  name: string,
  attributes: Record<string, string | number | boolean | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  // Attribute to the acting user (fail-open; request-cached, so ~free).
  let userId: number | undefined
  try { userId = (await getSession())?.userId } catch { /* unauthenticated — unattributed */ }

  const exit = await Effect.runPromiseExit(
    pipe(
      Effect.tryPromise({ try: fn, catch: (e) => e }),
      Effect.withSpan(name, {
        attributes: userId != null ? { ...attributes, userId } : attributes,
      }),
      Effect.provide(TracingLayer),
    ),
  )

  if (Exit.isSuccess(exit)) return exit.value
  // Re-throw the ORIGINAL error so legacy error handling is byte-for-byte unchanged.
  const failure = Cause.failureOption(exit.cause)
  if (failure._tag === 'Some') throw failure.value
  throw new Error(Cause.pretty(exit.cause))
}
