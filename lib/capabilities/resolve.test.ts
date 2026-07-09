import { describe, expect, it } from 'vitest'
import { isCapNotFound, notFound } from './resolve'

describe('capability not-found sentinel', () => {
  it('builds the sentinel shape', () => {
    expect(notFound('Jane')).toEqual({ error: 'not_found', searchedFor: 'Jane' })
  })

  it('guards the sentinel and rejects everything else', () => {
    expect(isCapNotFound(notFound('x'))).toBe(true)
    expect(isCapNotFound({ error: 'not_found', searchedFor: 'y' })).toBe(true)
    expect(isCapNotFound({ error: 'other' })).toBe(false)
    expect(isCapNotFound({ id: 1 })).toBe(false)
    expect(isCapNotFound(null)).toBe(false)
    expect(isCapNotFound('not_found')).toBe(false)
  })
})
