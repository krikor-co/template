import { describe, expect, it } from 'vitest'
import { formatCurrency, formatPhone } from './format'

describe('formatPhone (locale-gated BR mask)', () => {
  it('masks an 11-digit mobile with country code for pt-BR', () => {
    expect(formatPhone('5517997032910', 'pt-BR')).toBe('+55 (17) 99703-2910')
  })

  it('masks a 12-digit landline with country code for pt-BR', () => {
    expect(formatPhone('551732221234', 'pt-BR')).toBe('+55 (17) 3222-1234')
  })

  it('masks a 10-digit landline without country code for pt-BR', () => {
    expect(formatPhone('1732221234', 'pt-BR')).toBe('(17) 3222-1234')
  })

  it('never mangles unknown shapes — non-BR number stays intact under pt-BR', () => {
    expect(formatPhone('+4915112345678', 'pt-BR')).toBe('+4915112345678')
  })

  it('does NOT mask for en — returns the trimmed raw value unchanged', () => {
    expect(formatPhone(' 5517997032910 ', 'en')).toBe('5517997032910')
    expect(formatPhone('+55 (17) 99703-2910', 'en')).toBe('+55 (17) 99703-2910')
  })

  it('returns empty string for null/undefined/empty in any locale', () => {
    expect(formatPhone(null, 'en')).toBe('')
    expect(formatPhone(undefined, 'pt-BR')).toBe('')
    expect(formatPhone('', 'pt-BR')).toBe('')
  })
})

describe('formatCurrency (negative-zero snap, ported behaviour)', () => {
  it('renders sub-cent negative noise as a clean positive zero', () => {
    expect(formatCurrency(-0.004, 'en', 'USD')).toBe('$0.00')
  })
})
