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

  const e164 = useMemo(() => {
    const trimmed = display.trim()
    if (!trimmed) return ''
    const p = parsePhoneNumberFromString(trimmed, country)
    if (p) return p.number
    // best-effort fallback for an in-progress / not-yet-valid number
    return `+${getCountryCallingCode(country)}${trimmed.replace(/\D/g, '')}`
  }, [display, country])

  function onChangeNumber(v: string) {
    setDisplay(new AsYouType(country).input(v))
  }

  function onChangeCountry(c: CountryCode) {
    setCountry(c)
    // reformat the current digits for the new country
    setDisplay((prev) => new AsYouType(c).input(prev.replace(/\D/g, '')))
  }

  return { country, display, e164, countries, onChangeNumber, onChangeCountry }
}
