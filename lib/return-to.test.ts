import { describe, expect, it } from 'vitest'
import { isSafeInternalPath, safeReturnTo } from './return-to'

describe('isSafeInternalPath', () => {
  it('accepts plain in-app paths (with query strings)', () => {
    expect(isSafeInternalPath('/')).toBe(true)
    expect(isSafeInternalPath('/dashboard')).toBe(true)
    expect(isSafeInternalPath('/workspace/3/billing?tab=invoices')).toBe(true)
  })

  it('rejects absolute and protocol-relative URLs', () => {
    expect(isSafeInternalPath('https://evil.com/x')).toBe(false)
    expect(isSafeInternalPath('http://evil.com')).toBe(false)
    expect(isSafeInternalPath('//evil.com')).toBe(false)
    expect(isSafeInternalPath('javascript:alert(1)')).toBe(false)
    expect(isSafeInternalPath('')).toBe(false)
  })

  it('rejects backslash variants the WHATWG parser treats as `/`', () => {
    // new URL('/\\evil.com', 'https://app.example.com') → https://evil.com/
    expect(isSafeInternalPath('/\\evil.com')).toBe(false)
    expect(isSafeInternalPath('\\/evil.com')).toBe(false)
    expect(isSafeInternalPath('/\\/evil.com')).toBe(false)
  })

  it('rejects control-char variants the WHATWG parser strips', () => {
    // '/<TAB>/evil.com' — tab is removed by the URL parser → '//evil.com'
    expect(isSafeInternalPath('/\t/evil.com')).toBe(false)
    expect(isSafeInternalPath('/\n/evil.com')).toBe(false)
    expect(isSafeInternalPath('/\r/evil.com')).toBe(false)
    expect(isSafeInternalPath('/\u0000/evil.com')).toBe(false)
    expect(isSafeInternalPath('/\u007f/evil.com')).toBe(false)
  })

  it('rejects the URL-decoded form of encoded control chars (`/%09/evil.com`)', () => {
    // searchParams.get() / cookie reads hand us the DECODED value — the
    // encoded attack '/%09/evil.com' arrives here as a literal tab.
    expect(isSafeInternalPath(decodeURIComponent('/%09/evil.com'))).toBe(false)
    expect(isSafeInternalPath(decodeURIComponent('/%0d/evil.com'))).toBe(false)
    expect(isSafeInternalPath(decodeURIComponent('/%5cevil.com'))).toBe(false)
  })

  it('confirms the attack vectors actually resolve off-origin (regression oracle)', () => {
    // Documents WHY the raw-character rejection exists. If the URL spec or
    // runtime ever changes this behaviour, revisit the guard.
    expect(new URL('/\\evil.com', 'https://app.example.com').origin).toBe('https://evil.com')
    expect(new URL('/\t/evil.com', 'https://app.example.com').origin).toBe('https://evil.com')
  })
})

describe('safeReturnTo', () => {
  it('passes safe values through and nulls everything else', () => {
    expect(safeReturnTo('/workspace/7')).toBe('/workspace/7')
    expect(safeReturnTo('https://evil.com')).toBeNull()
    expect(safeReturnTo('//evil.com')).toBeNull()
    expect(safeReturnTo('/\\evil.com')).toBeNull()
    expect(safeReturnTo('/\t/evil.com')).toBeNull()
    expect(safeReturnTo('')).toBeNull()
    expect(safeReturnTo(null)).toBeNull()
    expect(safeReturnTo(undefined)).toBeNull()
  })
})
