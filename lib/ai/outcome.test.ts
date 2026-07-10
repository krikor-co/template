import { describe, expect, it } from 'vitest'
import { classifyFailure, isInfraFailure, refusalRate } from './outcome'

describe('classifyFailure', () => {
  it('maps a tagged ExternalServiceError (gateway outage / spend cap) to unavailable', () => {
    expect(classifyFailure({ _tag: 'ExternalServiceError', service: 'gateway' })).toBe('unavailable')
  })

  it('maps a tagged RateLimited to rate_limited', () => {
    expect(classifyFailure({ _tag: 'RateLimited', message: 'slow down' })).toBe('rate_limited')
  })

  it('maps anything else — plain Error, other tags, junk — to error', () => {
    expect(classifyFailure(new Error('boom'))).toBe('error')
    expect(classifyFailure({ _tag: 'DbError' })).toBe('error')
    expect(classifyFailure('string')).toBe('error')
    expect(classifyFailure(null)).toBe('error')
  })
})

describe('isInfraFailure', () => {
  it('flags only the three infra outcomes', () => {
    expect(isInfraFailure('unavailable')).toBe(true)
    expect(isInfraFailure('rate_limited')).toBe(true)
    expect(isInfraFailure('error')).toBe(true)
    expect(isInfraFailure('refuse')).toBe(false)
    expect(isInfraFailure('answer')).toBe(false)
    expect(isInfraFailure(null)).toBe(false)
    expect(isInfraFailure(undefined)).toBe(false)
  })
})

describe('refusalRate', () => {
  it('computes refusals over RESOLVED turns, excluding infra failures and cost-only nulls', () => {
    expect(
      refusalRate(['answer', 'refuse', 'error', null, 'propose', 'refuse', 'rate_limited']),
    ).toBe(0.5) // 2 refusals / 4 resolved (answer, refuse, propose, refuse)
  })

  it('returns null when nothing resolved (all infra/null)', () => {
    expect(refusalRate(['error', 'unavailable', null, undefined])).toBeNull()
    expect(refusalRate([])).toBeNull()
  })
})
