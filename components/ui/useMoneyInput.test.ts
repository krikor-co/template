import { describe, expect, it } from 'vitest'
import { centsToRaw, digitsToCents, formatCentsDisplay, seedCents, DEFAULT_MAX_MONEY } from './useMoneyInput'

const MAX_CENTS = Math.round(DEFAULT_MAX_MONEY * 100)

describe('centsToRaw', () => {
  it('renders integer cents as a Number()-parseable string', () => {
    expect(centsToRaw(123)).toBe('1.23')
    expect(centsToRaw(0)).toBe('0.00')
    expect(centsToRaw(5)).toBe('0.05')
    expect(centsToRaw(1_000_000)).toBe('10000.00')
  })
})

describe('digitsToCents', () => {
  it('parses a digit buffer to cents', () => {
    expect(digitsToCents('123')).toBe(123)
    expect(digitsToCents('007')).toBe(7)
  })
  it('returns null for an empty buffer', () => {
    expect(digitsToCents('')).toBeNull()
  })
})

describe('formatCentsDisplay', () => {
  it('formats with two fraction digits per locale', () => {
    expect(formatCentsDisplay(123456, 'en')).toBe('1,234.56')
    expect(formatCentsDisplay(123456, 'pt-BR')).toBe('1.234,56')
    expect(formatCentsDisplay(0, 'en')).toBe('0.00')
  })
})

describe('seedCents', () => {
  it('seeds from a number or numeric string, rounding to cents', () => {
    expect(seedCents(12.345, MAX_CENTS)).toBe(1235)
    expect(seedCents('12.34', MAX_CENTS)).toBe(1234)
  })
  it('clamps to the cap and rejects blanks/garbage', () => {
    expect(seedCents(DEFAULT_MAX_MONEY + 1, MAX_CENTS)).toBe(MAX_CENTS)
    expect(seedCents('', MAX_CENTS)).toBeNull()
    expect(seedCents(undefined, MAX_CENTS)).toBeNull()
    expect(seedCents('abc', MAX_CENTS)).toBeNull()
  })
})
