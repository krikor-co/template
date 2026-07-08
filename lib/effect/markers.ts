/**
 * Central registry of sentinel marker strings used inside `ConflictError` /
 * `ValidationFailed` messages to route specific user-facing copy at the
 * action boundary.
 *
 * The pattern: an Effect chain fails with a typed error whose `message` is
 * one of these constants. The boundary mapper (`mapResult`'s `custom` hook)
 * inspects the message and picks the right user-facing string:
 *
 *   // lib/effect/markers.ts
 *   export const Markers = {
 *     orderLocked: 'order_locked',
 *   } as const
 *
 *   // inside the pipe:
 *   Effect.fail(new ConflictError({ message: Markers.orderLocked }))
 *
 *   // at the boundary:
 *   return mapResult(result, {
 *     fallback: 'Could not save the order.',
 *     custom:   (r) => isMarker(r.error, Markers.orderLocked) ? 'This order is locked.' : null,
 *   })
 *
 * Why a central registry: file-local marker constants drift — a typo at the
 * boundary falls through to the generic fallback silently. One source of
 * truth makes the `_tag` + marker pair the discriminant.
 *
 * The registry ships EMPTY — add app-domain markers as your actions need
 * them. Never invent local marker constants in action files.
 */
export const Markers = {} as const

export type Marker = (typeof Markers)[keyof typeof Markers]

/** Compare a tagged-error message against a known marker. */
export const isMarker = (message: string | undefined, marker: Marker): boolean =>
  message === marker
