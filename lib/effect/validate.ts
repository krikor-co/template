import { Effect } from 'effect'
import type { ZodError, ZodSchema } from 'zod'
import { ValidationFailed } from './errors'

/**
 * Zod → Effect adapter. `schema.parse` either returns the parsed value or
 * throws a `ZodError`; we convert both into a typed Effect.
 *
 * Uses `Effect.try` (sync) — Zod's `parse` is synchronous; no need for
 * `tryPromise`. Async schema work would require `parseAsync` + `tryPromise`.
 *
 * On failure, we surface the first error message at the top level (for the
 * generic boundary `error` field) AND copy `flatten().fieldErrors` into the
 * structured `fieldErrors` payload. This is the boundary contract that
 * `useFormValues` reads off `result.fieldErrors` to light up specific input
 * fields client-side — keep the shape stable.
 */
export const validate = <T>(schema: ZodSchema<T>, value: unknown): Effect.Effect<T, ValidationFailed> =>
  Effect.try({
    try:   () => schema.parse(value),
    catch: (e) => {
      const ze = e as ZodError
      return new ValidationFailed({
        message:     ze.errors[0]?.message ?? 'Validation failed',
        fieldErrors: ze.flatten().fieldErrors as Record<string, string[]>,
      })
    },
  })
