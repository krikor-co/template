/**
 * Shared auth gate for every `app/api/cron/*` route (see docs/cron.md).
 *
 * Fail-closed: with CRON_SECRET unset every cron route answers 401 — a
 * misconfigured deploy can never expose an open cron endpoint. Accepts BOTH
 * scheduler conventions:
 *   - Vercel Cron:            `Authorization: Bearer <secret>`
 *   - cron-job.org / curl:    `x-cron-secret: <secret>`
 *
 * Uses web-standard Request/Response (not NextResponse) so it stays
 * unit-testable without a Next runtime; route handlers can return the
 * Response as-is.
 */

import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Constant-time secret comparison. Both sides are hashed to a fixed 32 bytes
 * first, so `timingSafeEqual` never throws on a length mismatch and the
 * comparison leaks neither content nor length via timing.
 */
function secretEquals(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a).digest()
  const bh = createHash('sha256').update(b).digest()
  return timingSafeEqual(ah, bh)
}

/** True when the request carries the expected secret via either convention. */
export function isCronAuthorized(req: Request, expected: string): boolean {
  const viaHeader = req.headers.get('x-cron-secret')
  if (viaHeader !== null && secretEquals(viaHeader, expected)) return true
  const viaAuth = req.headers.get('authorization')
  if (viaAuth !== null && secretEquals(viaAuth, `Bearer ${expected}`)) return true
  return false
}

/**
 * Gate a cron route. Returns `null` when authorized, otherwise the error
 * Response to return immediately:
 *
 *   const denied = requireCronAuth(req)
 *   if (denied) return denied
 */
export function requireCronAuth(req: Request): Response | null {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return Response.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 401 })
  }
  if (!isCronAuthorized(req, expected)) {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  return null
}
