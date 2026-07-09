/**
 * Timezone helpers built on `Intl.DateTimeFormat` (no external dependency).
 *
 * The app stores every instant as UTC (`timestamptz`). Workspace-local
 * wall-clock logic — availability windows, recurrence "same time every
 * week" — must be evaluated in the WORKSPACE's timezone (an IANA string on
 * the tenant record), NOT the server's UTC clock or the per-device
 * `app.tz` cookie.
 *
 * Two directions:
 *   - `partsInZone`  : UTC instant → local calendar parts (the easy direction).
 *   - `zonedWallTimeToUtc` : local wall-clock Y/M/D/H/M → the UTC instant (the
 *     hard direction, resolved via a two-pass offset lookup).
 */

export type ZonedParts = {
  year:    number
  month:   number  // 1–12
  day:     number  // 1–31
  /** 1 = Monday … 7 = Sunday (ISO-8601 weekday numbering). */
  weekday: number
  hour:    number  // 0–23
  minute:  number
  second:  number
  /** Local calendar date as `YYYY-MM-DD`. */
  dateStr: string
}

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
}

/**
 * Decompose a UTC instant into the wall-clock calendar parts seen in
 * `timeZone`. Falls back to UTC parts if the zone is invalid.
 */
export function partsInZone(instant: Date, timeZone: string): ZonedParts {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year:    'numeric',
      month:   '2-digit',
      day:     '2-digit',
      hour:    '2-digit',
      minute:  '2-digit',
      second:  '2-digit',
      hour12:  false,
      weekday: 'short',
    }).formatToParts(instant)
  } catch {
    // Invalid IANA zone — fall back to UTC so callers never throw.
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, weekday: 'short',
    }).formatToParts(instant)
  }

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? ''

  const year   = Number.parseInt(get('year'), 10)
  const month  = Number.parseInt(get('month'), 10)
  const day    = Number.parseInt(get('day'), 10)
  // `hour12: false` can render midnight as "24" in some engines — normalize.
  const hourRaw = Number.parseInt(get('hour'), 10)
  const hour   = hourRaw === 24 ? 0 : hourRaw
  const minute = Number.parseInt(get('minute'), 10)
  const second = Number.parseInt(get('second'), 10)
  const weekday = WEEKDAY_TO_ISO[get('weekday')] ?? 1

  const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  return { year, month, day, weekday, hour, minute, second, dateStr }
}

/** Offset (ms) of `timeZone` at `instant`: localWallAsUTC − instant. */
function tzOffsetMs(instant: number, timeZone: string): number {
  const p = partsInZone(new Date(instant), timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - instant
}

/**
 * The UTC instant for a wall-clock time in `timeZone`. Two-pass offset
 * resolution so it stays correct across DST transitions (within the
 * spring-forward gap the result lands on the post-transition offset, which is
 * the conventional behavior). `second`/`ms` default to 0.
 */
export function zonedWallTimeToUtc(
  year:   number,
  month:  number,  // 1–12
  day:    number,
  hour:   number,
  minute: number,
  timeZone: string,
  second = 0,
  ms = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  const off1 = tzOffsetMs(guess, timeZone)
  let utc = guess - off1
  const off2 = tzOffsetMs(utc, timeZone)
  if (off2 !== off1) utc = guess - off2
  return new Date(utc)
}
