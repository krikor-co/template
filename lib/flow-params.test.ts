import { describe, expect, it } from 'vitest'
import { resolveReturnTo, withFrom } from './flow-params'

describe('withFrom', () => {
  it('appends ?from= with the current location, URL-encoded', () => {
    expect(withFrom('/dashboard/people/2', '/dashboard/people?q=jo&page=3'))
      .toBe('/dashboard/people/2?from=%2Fdashboard%2Fpeople%3Fq%3Djo%26page%3D3')
  })

  it('preserves existing target query params', () => {
    expect(withFrom('/dashboard/people/2?tab=notes', '/dashboard'))
      .toBe('/dashboard/people/2?tab=notes&from=%2Fdashboard')
  })

  it('does not override an explicit from already on the target', () => {
    expect(withFrom('/dashboard/people/2?from=%2Fx', '/dashboard'))
      .toBe('/dashboard/people/2?from=%2Fx')
  })

  it('returns the target untouched when current is empty', () => {
    expect(withFrom('/dashboard/people/2', '')).toBe('/dashboard/people/2')
  })
})

describe('resolveReturnTo', () => {
  const base = { fallback: '/dashboard/people', pathname: '/dashboard/people/2' }

  it('returns a valid in-app origin', () => {
    expect(resolveReturnTo('/dashboard?tab=today', base)).toBe('/dashboard?tab=today')
  })

  it('rejects a missing param', () => {
    expect(resolveReturnTo(null, base)).toBeNull()
    expect(resolveReturnTo('', base)).toBeNull()
  })

  it('rejects absolute and protocol-relative URLs (open-redirect guard)', () => {
    expect(resolveReturnTo('https://evil.example/x', base)).toBeNull()
    expect(resolveReturnTo('//evil.example/x', base)).toBeNull()
  })

  it('rejects WHATWG-parser bypasses: backslash and control-char variants', () => {
    // new URL('/\\evil.com', origin) resolves to https://evil.com/ — `\` is `/`.
    expect(resolveReturnTo('/\\evil.com', base)).toBeNull()
    expect(resolveReturnTo('/\\/evil.com', base)).toBeNull()
    // Tab/CR/LF are STRIPPED by the URL parser → '//evil.com' protocol-relative.
    // '/%09/evil.com' in the address bar arrives here decoded as a literal tab.
    expect(resolveReturnTo('/\t/evil.com', base)).toBeNull()
    expect(resolveReturnTo(decodeURIComponent('/%09/evil.com'), base)).toBeNull()
    expect(resolveReturnTo('/\r/evil.com', base)).toBeNull()
    expect(resolveReturnTo('/\n/evil.com', base)).toBeNull()
  })

  it('rejects values outside the allowed prefix when one is given', () => {
    expect(resolveReturnTo('/admin/secrets', { ...base, prefix: '/dashboard' })).toBeNull()
    expect(resolveReturnTo('/dashboard?tab=today', { ...base, prefix: '/dashboard' }))
      .toBe('/dashboard?tab=today')
  })

  it('rejects the canonical fallback (no duplicate back affordance)', () => {
    expect(resolveReturnTo('/dashboard/people', base)).toBeNull()
  })

  it('rejects the current pathname (no self-loop)', () => {
    expect(resolveReturnTo('/dashboard/people/2', base)).toBeNull()
  })
})
