import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, TZ_COOKIE, isLocale, normalizeLocale } from './types'

describe('lib/i18n/types', () => {
  it('ships exactly the two seed locales, English first', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'pt-BR'])
    expect(DEFAULT_LOCALE).toBe('en')
  })

  it('uses app.* cookie identifiers (never irene.*)', () => {
    expect(LOCALE_COOKIE).toBe('app.locale')
    expect(TZ_COOKIE).toBe('app.tz')
  })

  it('isLocale accepts every supported locale and rejects everything else', () => {
    for (const l of SUPPORTED_LOCALES) expect(isLocale(l)).toBe(true)
    expect(isLocale('es')).toBe(false)
    expect(isLocale('EN')).toBe(false)
    expect(isLocale(null)).toBe(false)
    expect(isLocale(undefined)).toBe(false)
    expect(isLocale('')).toBe(false)
  })

  it('normalizeLocale falls back to DEFAULT_LOCALE for unknown values', () => {
    expect(normalizeLocale('pt-BR')).toBe('pt-BR')
    expect(normalizeLocale('xx')).toBe('en')
    expect(normalizeLocale(null)).toBe('en')
    expect(normalizeLocale(undefined)).toBe('en')
  })
})
