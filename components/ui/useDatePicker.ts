'use client'

import { useState } from 'react'

/**
 * Parse a `YYYY-MM-DD` string into a local-noon `Date` (noon avoids the
 * timezone-shift footgun where midnight-UTC drifts to the previous day when
 * displayed in a negative-offset zone). Returns `undefined` for empty/invalid.
 */
export function parseIsoDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return undefined
  const date = new Date(y, m - 1, d, 12, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * Serialize a `Date` back to the `YYYY-MM-DD` string the forms submit — the
 * exact shape the old native `<input type="date">` posted. Uses LOCAL date
 * parts (matches what the user picked on the calendar grid).
 */
export function toIsoDate(date: Date | undefined): string {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * State for an UNCONTROLLED {@link DatePicker} (the `name` + `defaultValue`
 * form-field case). Keeps the chosen `YYYY-MM-DD` string locally so a hidden
 * input can submit it. Controlled pickers (with `value` + `onChange`) bypass
 * this and drive the parent's state instead.
 */
export function useDatePicker(defaultValue: string | undefined) {
  const [value, setValue] = useState<string>(defaultValue ?? '')
  const [open, setOpen] = useState(false)
  return { value, setValue, open, setOpen }
}
