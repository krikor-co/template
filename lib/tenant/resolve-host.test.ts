import { describe, expect, it, vi } from 'vitest'
import { createHostResolver } from './resolve-host'

function makeResolver(overrides: Partial<Parameters<typeof createHostResolver>[0]> = {}) {
  const lookupSlug = vi.fn(async (slug: string) => (slug === 'acme' ? 42 : null))
  const lookupDomain = vi.fn(async (host: string) => (host === 'www.acme.com' ? 42 : null))
  const resolve = createHostResolver({
    baseDomain: 'example.com',
    lookupSlug,
    lookupDomain,
    ...overrides,
  })
  return { resolve, lookupSlug, lookupDomain }
}

describe('createHostResolver — lookup chain', () => {
  it('returns null for empty / localhost / base / www / *.vercel.app hosts without any lookup', async () => {
    const { resolve, lookupSlug, lookupDomain } = makeResolver()
    expect(await resolve(null)).toBeNull()
    expect(await resolve('')).toBeNull()
    expect(await resolve('localhost')).toBeNull()
    expect(await resolve('localhost:3000')).toBeNull()
    expect(await resolve('example.com')).toBeNull()
    expect(await resolve('www.example.com')).toBeNull()
    expect(await resolve('my-app.vercel.app')).toBeNull()
    expect(lookupSlug).not.toHaveBeenCalled()
    expect(lookupDomain).not.toHaveBeenCalled()
  })

  it('resolves <slug>.<baseDomain> via lookupSlug (case-insensitive, port stripped)', async () => {
    const { resolve, lookupSlug, lookupDomain } = makeResolver()
    expect(await resolve('ACME.example.com:3000')).toBe(42)
    expect(lookupSlug).toHaveBeenCalledWith('acme')
    expect(lookupDomain).not.toHaveBeenCalled()
  })

  it('uses the label immediately left of the base domain for nested subdomains', async () => {
    const { resolve, lookupSlug } = makeResolver()
    await resolve('deep.acme.example.com')
    expect(lookupSlug).toHaveBeenCalledWith('acme')
  })

  it('never treats reserved labels as slugs', async () => {
    const { resolve, lookupSlug } = makeResolver()
    expect(await resolve('www.example.com')).toBeNull()
    expect(await resolve('app.example.com')).toBeNull()
    expect(await resolve('api.example.com')).toBeNull()
    expect(lookupSlug).not.toHaveBeenCalled()
  })

  it('falls through to lookupDomain for hosts outside the base domain', async () => {
    const { resolve, lookupSlug, lookupDomain } = makeResolver()
    expect(await resolve('www.acme.com')).toBe(42)
    expect(await resolve('unknown.io')).toBeNull()
    expect(lookupDomain).toHaveBeenCalledWith('www.acme.com')
    expect(lookupSlug).not.toHaveBeenCalled()
  })

  it('honors a custom reserved set', async () => {
    const { resolve, lookupSlug } = makeResolver({ reserved: ['acme'] })
    expect(await resolve('acme.example.com')).toBeNull()
    expect(lookupSlug).not.toHaveBeenCalled()
  })
})

describe('createHostResolver — 60s cache', () => {
  it('caches positive AND negative results per host for the TTL', async () => {
    let clock = 1_000_000
    const { resolve, lookupSlug } = makeResolver({ now: () => clock })
    expect(await resolve('acme.example.com')).toBe(42)
    expect(await resolve('acme.example.com')).toBe(42)
    expect(await resolve('nope.example.com')).toBeNull()
    expect(await resolve('nope.example.com')).toBeNull()
    expect(lookupSlug).toHaveBeenCalledTimes(2) // one per distinct host

    clock += 60_001 // past the default 60s TTL
    expect(await resolve('acme.example.com')).toBe(42)
    expect(lookupSlug).toHaveBeenCalledTimes(3) // re-fetched after expiry
  })
})
