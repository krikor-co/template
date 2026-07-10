import { describe, expect, it } from 'vitest'
import {
  detectIdentifierType,
  normalizePhone,
  AUTH_IDENTIFIER_COOKIE,
  AUTH_IDENTIFIER_TYPE_COOKIE,
  AUTH_IS_NEW_COOKIE,
  AUTH_SESSION_COOKIE,
} from './identifier'

describe('detectIdentifierType', () => {
  it('detects valid emails (trims, any case)', () => {
    expect(detectIdentifierType('user@example.com')).toBe('email')
    expect(detectIdentifierType('  User@Example.COM  ')).toBe('email')
  })

  it('rejects strings with @ that are not valid emails', () => {
    expect(detectIdentifierType('user@')).toBeNull()
    expect(detectIdentifierType('@example.com')).toBeNull()
  })

  it('detects phone-like inputs (leading digit or +, 8+ chars of digits/space/()/-)', () => {
    expect(detectIdentifierType('+55 11 99999-9999')).toBe('phone')
    expect(detectIdentifierType('5511999999999')).toBe('phone')
    expect(detectIdentifierType('+1 (555) 000-0000')).toBe('phone')
  })

  it('rejects empty, short, and non-identifier input', () => {
    expect(detectIdentifierType('')).toBeNull()
    expect(detectIdentifierType('   ')).toBeNull()
    expect(detectIdentifierType('abc')).toBeNull()
    expect(detectIdentifierType('12')).toBeNull()
    // must START with an optional + then a digit — leading '(' is rejected
    expect(detectIdentifierType('(11) 99999-9999')).toBeNull()
  })
})

describe('normalizePhone', () => {
  it('strips formatting to +digits', () => {
    expect(normalizePhone('+55 (11) 99999-9999')).toBe('+5511999999999')
    expect(normalizePhone('55 11 99999 9999')).toBe('+5511999999999')
  })
})

describe('cookie name constants (the auth-flow cookie contract)', () => {
  it('pins the exact cookie names', () => {
    expect(AUTH_IDENTIFIER_COOKIE).toBe('auth_identifier')
    expect(AUTH_IDENTIFIER_TYPE_COOKIE).toBe('auth_identifier_type')
    expect(AUTH_IS_NEW_COOKIE).toBe('auth_is_new')
    expect(AUTH_SESSION_COOKIE).toBe('session_token')
  })
})
