'use client'

import { cn } from '@/lib/utils'
import { inputChrome } from './Input'
import { usePhoneInput, countryFlag } from './usePhoneInput'
import type { CountryCode } from 'libphonenumber-js'

type Props = {
  /** Form field name — submitted as an E.164 string (e.g. "+5511987654321"). */
  name: string
  id?: string
  defaultValue?: string
  /** Default country when the value can't be parsed. Required — the app decides its market, the template does not. */
  defaultCountry: CountryCode
  required?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  /** BCP-47 locale for country display names. Defaults to the runtime locale. */
  locale?: string
  onValueChange?: (e164: string) => void
}

/**
 * Phone input with a country-code select + national-format-as-you-type number
 * field. Submits a normalized E.164 value through a hidden input named `name`.
 * Drop-in for the old raw `<Input type="tel" name=… />` fields.
 */
export function PhoneInput({
  name,
  id,
  defaultValue,
  defaultCountry,
  required,
  disabled,
  placeholder,
  className,
  locale,
  onValueChange,
}: Props) {
  const resolvedLocale = locale ?? new Intl.NumberFormat().resolvedOptions().locale
  const phone = usePhoneInput(defaultValue, defaultCountry, resolvedLocale)

  return (
    <div className={cn('flex gap-2', className)}>
      <select
        aria-label="country"
        disabled={disabled}
        value={phone.country}
        onChange={(e) => {
          phone.onChangeCountry(e.target.value as CountryCode)
          onValueChange?.(phone.e164)
        }}
        className={cn(inputChrome, 'w-28 shrink-0 px-2')}
      >
        {phone.countries.map((c) => (
          <option key={c.code} value={c.code}>
            {countryFlag(c.code)} +{c.calling}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={phone.display}
        onChange={(e) => {
          phone.onChangeNumber(e.target.value)
          onValueChange?.(phone.e164)
        }}
        className={inputChrome}
      />
      <input type="hidden" name={name} value={phone.e164} />
    </div>
  )
}
