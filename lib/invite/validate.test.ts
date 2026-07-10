import { describe, expect, it } from 'vitest'
import { validateInvite } from './validate'

const NOW = new Date('2026-07-08T12:00:00Z')
const FUTURE = new Date('2026-07-15T12:00:00Z')
const PAST = new Date('2026-07-01T12:00:00Z')

describe('validateInvite', () => {
  it('accepts a pending, unexpired invite', () => {
    expect(validateInvite({ status: 'pending', expiresAt: FUTURE }, NOW)).toEqual({ ok: true })
  })

  it('is single-use: an accepted invite reports "used"', () => {
    // The accept transaction flips status pending → accepted; a second visit
    // with the same token must be rejected.
    expect(validateInvite({ status: 'accepted', expiresAt: FUTURE }, NOW)).toEqual({
      ok: false,
      reason: 'used',
    })
  })

  it('rejects a revoked invite', () => {
    expect(validateInvite({ status: 'revoked', expiresAt: FUTURE }, NOW)).toEqual({
      ok: false,
      reason: 'revoked',
    })
  })

  it('rejects an explicitly expired status', () => {
    expect(validateInvite({ status: 'expired', expiresAt: FUTURE }, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('treats a pending invite past expiresAt as expired regardless of status', () => {
    expect(validateInvite({ status: 'pending', expiresAt: PAST }, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('reports notFound for a missing row', () => {
    expect(validateInvite(null, NOW)).toEqual({ ok: false, reason: 'notFound' })
    expect(validateInvite(undefined, NOW)).toEqual({ ok: false, reason: 'notFound' })
  })

  it('rejects unknown statuses as notFound (never trusts weird rows)', () => {
    expect(validateInvite({ status: 'draft', expiresAt: FUTURE }, NOW)).toEqual({
      ok: false,
      reason: 'notFound',
    })
  })
})
