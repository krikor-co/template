import { describe, expect, it } from 'vitest'
import { pickPositiveInt } from './db-span-exporter'

describe('pickPositiveInt', () => {
  it('accepts a positive integer number', () => {
    expect(pickPositiveInt(12)).toBe(12)
  })

  it('accepts a strict positive-integer string', () => {
    expect(pickPositiveInt('12')).toBe(12)
  })

  it.each([0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'denormalizes non-positive-integer number %j as null',
    (raw) => {
      expect(pickPositiveInt(raw)).toBeNull()
    },
  )

  // parseInt alone would accept '12abc' / '12.9' as 12 — the string branch
  // must only accept strict digit strings.
  it.each(['12abc', '12.9', '0', '-3', '', ' 12', '1e3', 'abc'])(
    'denormalizes non-strict-integer string %j as null',
    (raw) => {
      expect(pickPositiveInt(raw)).toBeNull()
    },
  )

  it.each([null, undefined, true, {}, [12]])(
    'denormalizes non-number/string value %j as null',
    (raw) => {
      expect(pickPositiveInt(raw)).toBeNull()
    },
  )
})
