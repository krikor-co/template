/**
 * Tiny, dependency-free CSV serializer for export route handlers.
 *
 * Spec it honors (RFC 4180 + spreadsheet-friendly choices):
 *   - Fields containing `,`, `"`, `\r`, or `\n` are wrapped in double quotes;
 *     embedded `"` is escaped by doubling it.
 *   - Rows are joined with CRLF (`\r\n`) — Excel's expected line ending.
 *   - A header row is always emitted first.
 *   - A UTF-8 BOM is prepended so Excel reads accented text correctly.
 *
 * Money and dates are pre-formatted by the caller (the column `value`
 * functions) — `toCsv` only cares about strings. Keep money as a plain
 * decimal string (e.g. `"123.45"`, no currency symbol) and dates as
 * ISO `yyyy-MM-dd` (or an explicit locale-flavored format) so a
 * spreadsheet parses them cleanly.
 */

export type CsvColumn<Row> = {
  /** Human-readable header cell. */
  header: string
  /** Extract + stringify the cell for a row. Return '' for null/undefined. */
  value:  (row: Row) => string
}

const BOM = '\uFEFF'

/** Quote a single field iff it contains a delimiter, quote, or newline. */
function escapeField(raw: string): string {
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

function toRow<Row>(row: Row, columns: CsvColumn<Row>[]): string {
  return columns.map((c) => escapeField(c.value(row) ?? '')).join(',')
}

/**
 * Serialize `rows` to a CSV document string (header + data rows), BOM-prefixed
 * and CRLF-delimited. Always returns at least the header row.
 */
export function toCsv<Row>(rows: readonly Row[], columns: CsvColumn<Row>[]): string {
  const header = columns.map((c) => escapeField(c.header)).join(',')
  const body   = rows.map((r) => toRow(r, columns))
  return BOM + [header, ...body].join('\r\n') + '\r\n'
}

/** Plain-decimal money string from a number of currency units (no symbol). */
export function csvMoney(amount: number): string {
  return amount.toFixed(2)
}

/** Output shapes for `csvDate`. Default is locale-neutral ISO. */
export type CsvDateFormat = 'yyyy-MM-dd' | 'dd/MM/yyyy'

/**
 * Calendar-day string from an ISO timestamp/date string, or '' when
 * absent/invalid.
 *
 * `format` defaults to ISO `yyyy-MM-dd` — locale-neutral, lexically sortable,
 * parsed by every spreadsheet. Pass `'dd/MM/yyyy'` for day-first locales
 * (e.g. pt-BR exports); it is a locale-FLAVORED convenience, never the
 * default.
 *
 * Pass the workspace's IANA `timeZone` so the exported calendar day matches
 * the workspace's wall clock (a sale recorded at 23:00 in São Paulo exports
 * as that day, not the next UTC day). Omitting `timeZone` falls back to UTC.
 */
export function csvDate(
  iso: string | null | undefined,
  opts: { timeZone?: string; format?: CsvDateFormat } = {},
): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  let yyyy: string, mm: string, dd: string
  if (opts.timeZone) {
    // en-CA yields 'YYYY-MM-DD' in the target tz.
    ;[yyyy, mm, dd] = new Intl.DateTimeFormat('en-CA', {
      timeZone: opts.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d).split('-')
  } else {
    yyyy = String(d.getUTCFullYear())
    mm   = String(d.getUTCMonth() + 1).padStart(2, '0')
    dd   = String(d.getUTCDate()).padStart(2, '0')
  }
  return opts.format === 'dd/MM/yyyy' ? `${dd}/${mm}/${yyyy}` : `${yyyy}-${mm}-${dd}`
}

/**
 * Build the standard download headers for a CSV attachment. `basename` is the
 * filename stem (e.g. `people`); a `-YYYY-MM-DD` date suffix is appended.
 */
export function csvResponseHeaders(basename: string): HeadersInit {
  const today = new Date().toISOString().slice(0, 10)
  return {
    'content-type':        'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="${basename}-${today}.csv"`,
    // Exported data is often sensitive — never cache on shared/proxy caches.
    'cache-control':       'private, no-store',
  }
}
