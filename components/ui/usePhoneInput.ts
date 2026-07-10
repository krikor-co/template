'use client'

import { useMemo, useState } from 'react'
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js'

export type CountryOption = { code: CountryCode; name: string; calling: string }

/** Regional-indicator flag emoji from a 2-letter country code. */
export function countryFlag(cc: string): string {
  return cc
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

/**
 * Pure derivation: display value + country → E.164 string. Exported for unit
 * tests; the hook uses it both for the rendered value (memo) and for the
 * FRESH value the change handlers return (see below).
 */
export function deriveE164(display: string, country: CountryCode): string {
  const trimmed = display.trim()
  if (!trimmed) return ''
  const p = parsePhoneNumberFromString(trimmed, country)
  if (p) return p.number
  // best-effort fallback for an in-progress / not-yet-valid number
  return `+${getCountryCallingCode(country)}${trimmed.replace(/\D/g, '')}`
}

/**
 * State for {@link PhoneInput}: a selected country + a national-format display
 * value, plus the derived E.164 string the form submits. Seeds country + number
 * by parsing an existing value.
 */
export function usePhoneInput(
  initial: string | undefined,
  defaultCountry: CountryCode,
  locale: string,
) {
  const parsed = initial ? parsePhoneNumberFromString(initial, defaultCountry) : undefined
  const [country, setCountry] = useState<CountryCode>(parsed?.country ?? defaultCountry)
  const [display, setDisplay] = useState(() =>
    parsed ? parsed.formatNational() : (initial ?? ''),
  )

  const countries = useMemo<CountryOption[]>(() => {
    const names = new Intl.DisplayNames([locale], { type: 'region' })
    return getCountries()
      .map((code) => ({
        code,
        name: names.of(code) ?? code,
        calling: getCountryCallingCode(code),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [locale])

  const e164 = useMemo(() => deriveE164(display, country), [display, country])

  // Both handlers RETURN the freshly derived E.164 (mirroring
  // useMoneyInput.onChange): `phone.e164` is the previous render's memo, so a
  // caller notifying `onValueChange` with it would always be one keystroke
  // behind (and report the pre-change country's number on a country switch).
  function onChangeNumber(v: string): string {
    const next = new AsYouType(country).input(v)
    setDisplay(next)
    return deriveE164(next, country)
  }

  function onChangeCountry(c: CountryCode): string {
    // reformat the current digits for the new country
    const next = new AsYouType(c).input(display.replace(/\D/g, ''))
    setCountry(c)
    setDisplay(next)
    return deriveE164(next, c)
  }

  return { country, display, e164, countries, onChangeNumber, onChangeCountry }
}
