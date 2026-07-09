import { describe, expect, it } from 'vitest'
import { AsYouType } from 'libphonenumber-js'
import { deriveE164 } from './usePhoneInput'

describe('deriveE164', () => {
  it('derives E.164 from a national-format display value', () => {
    expect(deriveE164('(201) 555-0123', 'US')).toBe('+12015550123')
    expect(deriveE164('11 98765-4321', 'BR')).toBe('+5511987654321')
  })

  it('falls back to calling-code + digits for an in-progress number', () => {
    expect(deriveE164('20155', 'US')).toBe('+120155')
  })

  it('returns empty string for a blank display', () => {
    expect(deriveE164('', 'US')).toBe('')
    expect(deriveE164('   ', 'BR')).toBe('')
  })

  it('derives from the NEW display on a keystroke — not the previous render (regression)', () => {
    // Simulates onChangeNumber: the handler formats the incoming value and
    // must derive e164 from THAT string. Deriving from the pre-keystroke
    // display (the old bug: notifying with the previous render's memo) would
    // drop the final digit.
    const before = '(201) 555-012'
    const incoming = '(201) 555-0123'
    const next = new AsYouType('US').input(incoming)
    expect(deriveE164(next, 'US')).toBe('+12015550123')
    expect(deriveE164(before, 'US')).not.toBe('+12015550123')
  })

  it('derives with the NEW country on a country switch (regression)', () => {
    // Simulates onChangeCountry('BR') with US digits in the field: the fresh
    // value must use BR's calling code, not the pre-change country's.
    const digits = '11987654321'
    const next = new AsYouType('BR').input(digits)
    expect(deriveE164(next, 'BR')).toBe('+5511987654321')
    expect(deriveE164(next, 'BR').startsWith('+1')).toBe(false)
  })
})
