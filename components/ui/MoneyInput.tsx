'use client'

import { cn } from '@/lib/utils'
import { inputChrome } from './Input'
import { useMoneyInput, DEFAULT_MAX_MONEY } from './useMoneyInput'

/** The currency symbol alone (e.g. "$", "R$", "€") for a locale+currency —
 *  shown as a static adornment separate from the editable number. Falls back
 *  to the currency code. */
function currencySymbolFor(locale: string, currency: string): string {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? currency
}

type Props = {
  /** Form field name — submitted as a clean numeric string (e.g. "1234.56"). */
  name: string
  id?: string
  /** Seed value (number or `Number()`-parseable string). */
  defaultValue?: number | string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  /** ISO 4217 currency for the symbol adornment. Default "USD". */
  currency?: string
  /** BCP-47 locale for the mask's grouping/decimal separators. Defaults to the
   *  runtime locale — pass the app locale for SSR-stable output. */
  locale?: string
  /** Upper bound for the field's value (default 99 999 999.99 — a
   *  `numeric(10,2)` column). Input that would exceed it is rejected. */
  max?: number
  /** Notified with the clean numeric string on every change (e.g. to clear errors). */
  onValueChange?: (raw: string) => void
}

/**
 * Currency money input. Shows the currency symbol as a static prefix adornment
 * and formats LIVE on every keystroke, calculator-style: digits fill in from
 * the right (empty → "0.00", type 1·2·3 → 0.01·0.12·1.23, Backspace peels the
 * rightmost digit). Submits a clean `Number()`-parseable value through a hidden
 * input named `name`. Drop-in for a raw `<Input type="number" name=… />`.
 */
export function MoneyInput({
  name,
  id,
  defaultValue,
  required,
  disabled,
  placeholder,
  className,
  currency = 'USD',
  locale,
  max = DEFAULT_MAX_MONEY,
  onValueChange,
}: Props) {
  const resolvedLocale = locale ?? new Intl.NumberFormat().resolvedOptions().locale
  const symbol = currencySymbolFor(resolvedLocale, currency)
  const money = useMoneyInput(defaultValue, resolvedLocale, Math.round(max * 100))

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm text-muted-foreground tabular-nums"
        aria-hidden
      >
        {symbol}
      </span>
      <input
        ref={money.inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={money.display}
        onFocus={money.onFocus}
        onKeyDown={money.onKeyDown}
        onChange={(e) => {
          const raw = money.onChange(e.target.value)
          onValueChange?.(raw)
        }}
        className={cn(inputChrome, 'pl-10 text-right tabular-nums', className)}
      />
      {/* The value the form submits — always a clean numeric string. */}
      <input type="hidden" name={name} value={money.raw} />
    </div>
  )
}
