import { describe, expect, it } from 'vitest'
import { mapResult } from './boundary'
import type { ActionResult } from './run-action'
import type { TaggedAppError } from './errors'

const fail = (
  kind: TaggedAppError['_tag'],
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<Record<string, never>> =>
  ({ success: false, error, kind, ...(fieldErrors ? { fieldErrors } : {}) })

describe('mapResult', () => {
  it('passes success through untouched', () => {
    const result: ActionResult<{ id: number }> = { success: true, id: 1 }
    expect(mapResult(result, { fallback: 'F' })).toEqual({ success: true, id: 1 })
  })

  it('routes unmatched kinds to fallback', () => {
    expect(mapResult(fail('DbError', 'pg down'), { fallback: 'F' }))
      .toEqual({ success: false, error: 'F' })
  })

  it('routes per-kind overrides', () => {
    expect(mapResult(fail('Conflict', 'x'), { fallback: 'F', conflict: 'C' }))
      .toEqual({ success: false, error: 'C' })
    expect(mapResult(fail('ValidationFailed', 'x'), { fallback: 'F', validation: 'V' }))
      .toEqual({ success: false, error: 'V' })
    expect(mapResult(fail('SubscriptionInactive', 'x'), { fallback: 'F', subscriptionInactive: 'S' }))
      .toEqual({ success: false, error: 'S' })
    expect(mapResult(fail('Unauthenticated', 'x'), { fallback: 'F', forbidden: 'NoPerm' }))
      .toEqual({ success: false, error: 'NoPerm' })
  })

  it('passes the limiter message through when rateLimit copy is omitted', () => {
    expect(mapResult(fail('RateLimited', 'Try again in 30s'), { fallback: 'F' }))
      .toEqual({ success: false, error: 'Try again in 30s' })
  })

  it('custom routing runs first and wins when it returns a string', () => {
    const result = mapResult(fail('ValidationFailed', 'amount_invalid', { amount: ['too low'] }), {
      fallback: 'F',
      custom:   (r) => (r.fieldErrors?.amount?.length ? 'Amount must be greater than zero' : null),
    })
    expect(result).toEqual({ success: false, error: 'Amount must be greater than zero' })
  })

  it('custom returning null falls through to the kind switch', () => {
    const result = mapResult(fail('Conflict', 'x'), {
      fallback: 'F',
      conflict: 'C',
      custom:   () => null,
    })
    expect(result).toEqual({ success: false, error: 'C' })
  })
})
