import { Effect } from 'effect'
import { db as drizzle } from '@/db/drizzle'
import { DbError } from './errors'

/**
 * Drizzle transaction callback parameter type — extracted from drizzle's
 * `.transaction()` signature so we don't have to hand-write the tx type.
 */
type DbTx = Parameters<Parameters<typeof drizzle.transaction>[0]>[0]

export const dbE = {
  /** Wrap any thenable Drizzle query into Effect<T, DbError>. */
  try: <T>(fn: () => PromiseLike<T>): Effect.Effect<T, DbError> =>
    Effect.tryPromise({ try: fn, catch: (cause) => new DbError({ cause }) }),

  /**
   * SELECT ... LIMIT 1 → undefined-or-row.
   * Saves the boilerplate `.then((r) => r[0])` pattern that would otherwise
   * repeat across the codebase.
   */
  findFirst: <T>(query: PromiseLike<T[]>): Effect.Effect<T | undefined, DbError> =>
    Effect.tryPromise({
      try:   () => Promise.resolve(query).then((r) => r[0]),
      catch: (cause) => new DbError({ cause }),
    }),

  /** Run a write/aggregate query that returns a value as-is. */
  run: <T>(query: PromiseLike<T>): Effect.Effect<T, DbError> =>
    Effect.tryPromise({ try: () => Promise.resolve(query), catch: (cause) => new DbError({ cause }) }),

  /**
   * Wrap `db.transaction(async (tx) => ...)`. The inner callback STAYS plain
   * async — Effect can't natively run inside Drizzle's transaction callback.
   * Throw inside the callback to roll back; the outer `tryPromise` catches
   * and converts to `DbError`. Typed errors do NOT propagate through the
   * transaction body — perform read-checks (NotFound, etc.) BEFORE entering
   * the transaction, then use the transaction only for the write batch.
   */
  transaction: <T>(fn: (tx: DbTx) => Promise<T>): Effect.Effect<T, DbError> =>
    Effect.tryPromise({ try: () => drizzle.transaction(fn), catch: (cause) => new DbError({ cause }) }),
}
