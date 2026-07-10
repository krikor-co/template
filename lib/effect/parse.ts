import { Effect, pipe } from 'effect'
import { ValidationFailed } from './errors'

/**
 * Effect-flavoured parsers for ID strings that arrive from URL params or
 * action input. Each returns `Effect<number, ValidationFailed>` so the
 * failure stays inside the TaggedAppError union — never a thrown defect.
 *
 * Use these instead of file-local `parseWorkspaceId`-style helpers. The
 * "throws on bad input" pattern was inconsistent across the codebase
 * (some returned null, some threw, some called the label different things)
 * and a thrown defect inside an Effect pipe gets surfaced at the boundary
 * as a generic `DbError` — wrong category for what is really a validation
 * failure.
 */

const parsePositiveInt = (raw: string): number | null => {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Parse a string into a positive integer Effect.
 * On bad input, fails with `ValidationFailed({ message: 'Invalid <label>' })`.
 *
 * Example:
 *   pipe(
 *     Effect.Do,
 *     Effect.bind('workspaceId', () => parseIdE(input.workspaceId, 'workspaceId')),
 *     Effect.bind('personId',    () => parseIdE(input.personId, 'personId')),
 *     ...
 *   )
 */
export const parseIdE = (raw: string, label: string): Effect.Effect<number, ValidationFailed> =>
  pipe(
    Effect.sync(() => parsePositiveInt(raw)),
    Effect.flatMap((n) =>
      n === null
        ? Effect.fail(new ValidationFailed({ message: `Invalid ${label}` }))
        : Effect.succeed(n),
    ),
  )
