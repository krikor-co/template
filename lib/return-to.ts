/**
 * Same-origin path validation for user-influenced return/redirect targets —
 * the auth `returnTo` cookie flow and the `?from=` flow param share this ONE
 * guard so the rules can never drift.
 *
 * A value is accepted only when it is an in-app path:
 *
 *   - starts with `/` but not `//` — blocks absolute (`https://evil.com`) and
 *     protocol-relative (`//evil.com`) URLs;
 *   - contains no backslash and no ASCII control characters. The WHATWG URL
 *     parser (browsers, and anything resolving a Location header) treats `\`
 *     as `/` and STRIPS tab/CR/LF entirely — so `/\evil.com` resolves to
 *     `https://evil.com/` and `/<TAB>/evil.com` collapses to the
 *     protocol-relative `//evil.com`. Rejecting the raw characters closes
 *     both bypasses (an encoded `%09` stays inert in a path; it only becomes
 *     dangerous once decoded to a literal tab, which this catches).
 */
export function isSafeInternalPath(raw: string): boolean {
  if (!raw.startsWith('/') || raw.startsWith('//')) return false
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return false
  return true
}

/**
 * Pass a raw (possibly absent) returnTo value through the guard.
 * Anything unsafe or empty collapses to `null` — callers fall back to their
 * canonical destination (e.g. the dashboard).
 */
export function safeReturnTo(raw: string | null | undefined): string | null {
  return raw && isSafeInternalPath(raw) ? raw : null
}
