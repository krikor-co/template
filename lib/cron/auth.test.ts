import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isCronAuthorized, requireCronAuth } from './auth'

const url = 'http://localhost:3000/api/cron/test'
const post = (headers?: Record<string, string>) => new Request(url, { method: 'POST', headers })

describe('isCronAuthorized', () => {
  it('accepts the x-cron-secret header', () => {
    expect(isCronAuthorized(post({ 'x-cron-secret': 's3cret' }), 's3cret')).toBe(true)
  })

  it('accepts the Vercel Cron Authorization: Bearer header', () => {
    expect(isCronAuthorized(post({ authorization: 'Bearer s3cret' }), 's3cret')).toBe(true)
  })

  it('rejects a wrong secret', () => {
    expect(isCronAuthorized(post({ 'x-cron-secret': 'nope' }), 's3cret')).toBe(false)
  })

  it('rejects when both headers are missing', () => {
    expect(isCronAuthorized(post(), 's3cret')).toBe(false)
  })

  it('rejects a bare token without the Bearer prefix', () => {
    expect(isCronAuthorized(post({ authorization: 's3cret' }), 's3cret')).toBe(false)
  })
})

describe('requireCronAuth', () => {
  const saved = process.env.CRON_SECRET
  beforeEach(() => { delete process.env.CRON_SECRET })
  afterEach(() => {
    if (saved === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = saved
  })

  it('fails closed with 401 when CRON_SECRET is unset — even with a header present', async () => {
    const res = requireCronAuth(post({ 'x-cron-secret': 'anything' }))
    expect(res?.status).toBe(401)
    await expect(res!.json()).resolves.toEqual({ ok: false, error: 'CRON_SECRET not configured' })
  })

  it('returns 403 forbidden on a wrong secret', async () => {
    process.env.CRON_SECRET = 's3cret'
    const res = requireCronAuth(post({ 'x-cron-secret': 'nope' }))
    expect(res?.status).toBe(403)
    await expect(res!.json()).resolves.toEqual({ ok: false, error: 'forbidden' })
  })

  it('returns null (authorized) on a match via either header convention', () => {
    process.env.CRON_SECRET = 's3cret'
    expect(requireCronAuth(post({ 'x-cron-secret': 's3cret' }))).toBeNull()
    expect(requireCronAuth(post({ authorization: 'Bearer s3cret' }))).toBeNull()
  })
})
