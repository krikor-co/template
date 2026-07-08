import type { Locale } from './types'

/**
 * Locale-aware Intl wrappers. Always pass the user's session locale so
 * server-rendered dates/numbers don't fall back to the host's default
 * (en-US) and so client-rendered values don't drift to whatever the
 * browser happens to prefer.
 *
 * **Timezone handling**: pass `timeZone` in `options` (an IANA tz like
 * `America/Sao_Paulo`) so server and client agree on what local time a
 * stored UTC instant should be displayed as. Server pages resolve it via
 * `lib/i18n/getTimezone.ts` (cookie-based) and pass it down. Client
 * components can omit `timeZone` — Intl defaults to the browser tz, which
 * is what wrote the cookie in the first place.
 */

export function formatDate(
  iso: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {},
): string {
  // Inject the default dd/MM/yyyy style ONLY when the caller asks for no date
  // component — so a partial request like `{ weekday: 'short' }` or
  // `{ day: '2-digit' }` returns exactly that, instead of dragging the whole
  // date along (the old behaviour merged the defaults UNDER the caller's
  // options, so `{ weekday: 'short' }` rendered "seg., 22/06/2026"). Callers
  // who want a styled FULL date now pass the fields they want explicitly (e.g.
  // add `year: 'numeric'`); `{ timeZone }`-only still gets the dd/MM/yyyy default.
  const hasDateStyle =
    options.weekday != null || options.day != null || options.month != null ||
    options.year != null || options.era != null || options.dateStyle != null
  return new Date(iso).toLocaleDateString(
    locale,
    hasDateStyle ? options : { day: '2-digit', month: '2-digit', year: 'numeric', ...options },
  )
}

export function formatDateTime(
  iso: string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(iso).toLocaleString(locale, options)
}

export function formatTime(
  iso: string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(iso).toLocaleTimeString(locale, options)
}

/**
 * Format a stored phone string for display. The DB holds free-form / raw
 * numbers (e.g. `5517997032910`, `+55149832842347`), which read as a wall
 * of digits.
 *
 * The mask is LOCALE-GATED: for `pt-BR` it applies the Brazilian grouping
 * below; for every other locale the value is returned trimmed but otherwise
 * UNCHANGED (swap in `libphonenumber-js` if a locale needs real region-aware
 * display formatting).
 *
 *   pt-BR: `5517997032910`  → `+55 (17) 99703-2910`   (11-digit mobile, DDD + 9)
 *   pt-BR: `551732221234`   → `+55 (17) 3222-1234`    (10-digit landline, DDD + 8)
 *   pt-BR: `17997032910`    → `(17) 99703-2910`        (no country code)
 *
 * Strips a leading `+`/`00` and the `55` country code for grouping, then
 * regroups. Anything that doesn't fit a known BR shape is returned with a
 * leading `+` (if it started with one) and otherwise UNCHANGED — never throws,
 * never drops digits, so a malformed seed value still shows in full.
 */
export function formatPhone(raw: string | null | undefined, locale: Locale): string {
  if (!raw) return ''
  const trimmed = String(raw).trim()
  if (locale !== 'pt-BR') return trimmed

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 0) return trimmed

  // Pull off the BR country code (55) when present so we group the national
  // number; keep a flag so we can re-add the +55 prefix on a clean match.
  let national = digits
  let hadCountry = false
  if (national.length > 11 && national.startsWith('55')) {
    national = national.slice(2)
    hadCountry = true
  }

  const group = (ddd: string, rest: string): string => {
    const local =
      rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` :   // mobile
      rest.length === 8 ? `${rest.slice(0, 4)}-${rest.slice(4)}` :   // landline
      rest
    const body = `(${ddd}) ${local}`
    return hadCountry ? `+55 ${body}` : body
  }

  // DDD (2) + 8 or 9 digit subscriber number — the canonical BR national shape.
  if (national.length === 11 || national.length === 10) {
    return group(national.slice(0, 2), national.slice(2))
  }

  // Doesn't match a known shape — return the original (with a + if it had one),
  // never mangling or truncating an unexpected value.
  return trimmed.startsWith('+') ? `+${digits}` : trimmed
}

export function formatNumber(
  n: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return n.toLocaleString(locale, options)
}

export function formatCurrency(
  n: number,
  locale: Locale,
  currency = 'USD',
): string {
  // Snap values that round to zero (including the negative-zero produced by
  // `0 - 0` or sub-cent float noise) to a clean positive 0 so we never render
  // a leading-minus "-R$ 0,00", which reads as a formatting bug / a loss.
  const safe = Math.abs(n) < 0.005 ? 0 : n
  return safe.toLocaleString(locale, { style: 'currency', currency })
}

/**
 * The currency symbol alone (e.g. "R$", "$", "€") for a locale+currency —
 * used as a static adornment inside money inputs (the input shows the symbol
 * separately from the editable number). Falls back to the currency code.
 */
export function currencySymbol(locale: Locale, currency = 'USD'): string {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? currency
}

/** The locale's decimal separator ("," for pt-BR, "." for en). */
function decimalSeparator(locale: Locale): string {
  return new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? '.'
}

/**
 * Format a number as a grouped decimal string WITHOUT the currency symbol
 * (e.g. 1234.5 → "1.234,50" in pt-BR) — the display value for a money input.
 */
export function formatMoneyValue(n: number, locale: Locale): string {
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Parse user-typed money text (any locale) into a clean number, or null.
 * Strips the currency symbol + grouping separators and normalizes the decimal
 * separator, so the form submits a `Number()`-parseable value.
 */
export function parseMoneyInput(str: string, locale: Locale): number | null {
  if (str == null) return null
  const dec = decimalSeparator(locale)
  const group = dec === ',' ? '.' : ','
  let cleaned = String(str).replace(/[^\d.,\-]/g, '')
  cleaned = cleaned.split(group).join('')
  cleaned = cleaned.replace(dec, '.')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}
