import { describe, expect, it } from 'vitest'
import { isSubscriptionActive, requiresPortalOverCheckout } from './active'

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

describe('requiresPortalOverCheckout', () => {
  it('routes live-but-unhealthy subscriptions to the Portal (no second Checkout)', () => {
    expect(requiresPortalOverCheckout('past_due', true)).toBe(true)
    expect(requiresPortalOverCheckout('unpaid', true)).toBe(true)
    expect(requiresPortalOverCheckout('incomplete', true)).toBe(true)
  })

  it('defensively routes already-active subscriptions to the Portal too', () => {
    expect(requiresPortalOverCheckout('active', true)).toBe(true)
    expect(requiresPortalOverCheckout('trialing', true)).toBe(true)
  })

  it('allows fresh Checkout when no live subscription exists', () => {
    expect(requiresPortalOverCheckout(null, false)).toBe(false)
    expect(requiresPortalOverCheckout(undefined, false)).toBe(false)
    expect(requiresPortalOverCheckout('canceled', true)).toBe(false)
    expect(requiresPortalOverCheckout('incomplete_expired', true)).toBe(false)
    // No sub id on record (e.g. seeded/granted plan) → nothing to portal-manage.
    expect(requiresPortalOverCheckout('past_due', false)).toBe(false)
  })
})
