'use client'

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * Default upper bound for a single money field — mirrors a `numeric(10,2)`
 * money column (max 99 999 999.99). Without a cap, a pasted larger value would
 * pass client validation and only fail at the DB — a silent no-op submit.
 * Configurable per-field via MoneyInput's `max` prop.
 */
export const DEFAULT_MAX_MONEY = 99_999_999.99

/** Integer cents → a clean `Number()`-parseable string (e.g. 123 → "1.23"). */
export function centsToRaw(cents: number): string {
  const whole = Math.floor(cents / 100)
  const frac = String(cents % 100).padStart(2, '0')
  return `${whole}.${frac}`
}

/** Digit-only input buffer → integer cents, or null for an empty buffer. */
export function digitsToCents(digits: string): number | null {
  if (digits === '') return null
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? n : null
}

/** Locale-formatted display (grouped decimal, two fraction digits, no symbol). */
export function formatCentsDisplay(cents: number, locale: string): string {
  return (cents / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Seed value (number or `Number()`-parseable string) → integer cents clamped
 *  to `maxCents`, or null if blank/invalid. */
export function seedCents(initial: number | string | undefined, maxCents: number): number | null {
  const n =
    typeof initial === 'number'
      ? initial
      : typeof initial === 'string' && initial.trim() !== ''
        ? Number(initial)
        : null
  if (n == null || !Number.isFinite(n)) return null
  return Math.min(Math.round(n * 100), maxCents)
}

/**
 * State for {@link MoneyInput}: a calculator-style currency mask that formats
 * LIVE on every keystroke. The field holds an integer number of cents; digits
 * fill in from the RIGHT, so on an empty field typing `1`,`2`,`3` reads
 * `0.01` → `0.12` → `1.23`, and Backspace peels the rightmost digit off.
 *
 * It exposes:
 *  - `display` — the locale-formatted masked string shown in the input
 *    (resting state is the locale's "0.00", never blank),
 *  - `raw` — the clean numeric string the form submits via a hidden input
 *    (`''` while untouched so required/empty validation still works),
 *  - `onChange` — recomputes cents from the input's digits and returns `raw`,
 *  - `inputRef` — attached to the `<input>` so the caret stays pinned to the
 *    end after each reformat (calculator behaviour).
 */
export function useMoneyInput(
  initial: number | string | undefined,
  locale: string,
  maxCents: number,
) {
  const [cents, setCents] = useState<number | null>(() => seedCents(initial, maxCents))
  const inputRef = useRef<HTMLInputElement>(null)

  function pinCaretToEnd() {
    const el = inputRef.current
    if (el && document.activeElement === el) {
      const end = el.value.length
      el.setSelectionRange(end, end)
    }
  }

  // Pin the caret to the end after each live reformat. Every keystroke rebuilds
  // the whole masked string, so without this React's controlled-value caret
  // restoration can land mid-string; a calculator always types at the right.
  useEffect(pinCaretToEnd, [cents])

  // ...and on focus, so the caret rests at the right when the field is entered.
  function onFocus() {
    pinCaretToEnd()
  }

  // The real guarantee that digits fill from the RIGHT: before each keystroke,
  // collapse a single caret to the end so the key inserts/deletes there — no
  // matter where a click placed it (the field is text-right aligned, so an
  // empty-area click lands the caret at index 0). A RANGE selection is left
  // alone, so "select-all then type" still replaces the whole value.
  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget
    if (el.selectionStart === el.selectionEnd) {
      const end = el.value.length
      if (el.selectionStart !== end) el.setSelectionRange(end, end)
    }
  }

  const display = formatCentsDisplay(cents ?? 0, locale)
  const raw = cents == null ? '' : centsToRaw(cents)

  function onChange(value: string): string {
    // Strip everything but digits → the integer cents the user has entered.
    // The grouping/decimal separators in `display` are structural, so reading
    // the digits back gives a stable buffer regardless of where the caret is.
    const next = digitsToCents(value.replace(/\D/g, ''))
    if (next == null) {
      setCents(null)
      return ''
    }
    // Reject any keystroke/paste that pushes the value past the cap —
    // keep the prior valid value so the field can't silently overflow.
    if (next > maxCents) return cents == null ? '' : centsToRaw(cents)
    setCents(next)
    return centsToRaw(next)
  }

  return { display, raw, onChange, onFocus, onKeyDown, inputRef }
}
