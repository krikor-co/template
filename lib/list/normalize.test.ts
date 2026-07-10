import { describe, expect, it } from 'vitest'
import { matchesQuery, normalizeText } from './normalize'

describe('normalizeText', () => {
  it('strips diacritics, lowercases, trims', () => {
    expect(normalizeText('José')).toBe('jose')
    expect(normalizeText('  Insumo Básico ')).toBe('insumo basico')
  })
})

describe('matchesQuery', () => {
  it("matches 'José' when searching 'jose'", () => {
    expect(matchesQuery('José da Silva', 'jose')).toBe(true)
  })

  it('is accent-insensitive on the query side too', () => {
    expect(matchesQuery('Jose da Silva', 'josé')).toBe(true)
  })

  it('requires every whitespace-separated token to match (AND)', () => {
    expect(matchesQuery('José da Silva', 'silva jose')).toBe(true)
    expect(matchesQuery('José da Silva', 'jose maria')).toBe(false)
  })

  it('empty query always matches', () => {
    expect(matchesQuery('anything', '')).toBe(true)
  })
})
