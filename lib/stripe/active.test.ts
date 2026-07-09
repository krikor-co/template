import { describe, expect, it } from 'vitest'
import { isSubscriptionActive } from './active'

describe('isSubscriptionActive', () => {
  it('treats active and trialing as active', () => {
    expect(isSubscriptionActive('active')).toBe(true)
    expect(isSubscriptionActive('trialing')).toBe(true)
  })

  it('treats every other status as NOT active', () => {
    expect(isSubscriptionActive('past_due')).toBe(false)
    expect(isSubscriptionActive('canceled')).toBe(false)
    expect(isSubscriptionActive('incomplete')).toBe(false)
    expect(isSubscriptionActive('unpaid')).toBe(false)
  })

  it('treats null/undefined (never subscribed) as NOT active', () => {
    expect(isSubscriptionActive(null)).toBe(false)
    expect(isSubscriptionActive(undefined)).toBe(false)
  })
})
