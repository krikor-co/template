import { db } from '@/db/drizzle'
import { rateLimits } from '@/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { headers } from 'next/headers'

type RateLimitConfig = {
  /** Maximum number of attempts within the window */
  max: number
  /** Window duration in milliseconds */
  windowMs: number
  /** Action identifier (e.g., 'send_otp', 'verify_otp') */
  action: string
}

type RateLimitResult =
  | { ok: true }
  | { ok: false; error: string }

export function createRateLimit(config: RateLimitConfig) {
  const { max, windowMs, action } = config

  return {
    /**
     * Check rate limit for one or more keys (e.g., email, IP).
     * Each key is checked independently — if any key is over the limit, the request is denied.
     */
    async check(...keys: string[]): Promise<RateLimitResult> {
      const windowStart = new Date(Date.now() - windowMs)

      for (const key of keys) {
        const rows = await db
          .select()
          .from(rateLimits)
          .where(
            and(
              eq(rateLimits.key, key),
              eq(rateLimits.action, action),
              gt(rateLimits.windowStart, windowStart),
            ),
          )
          .limit(1)

        const row = rows[0]

        if (!row) {
          await db.insert(rateLimits).values({ key, action, count: 1 })
          continue
        }

        if (row.count >= max) {
          return { ok: false, error: 'Too many attempts. Please try again later.' }
        }

        await db
          .update(rateLimits)
          .set({ count: row.count + 1 })
          .where(eq(rateLimits.id, row.id))
      }

      return { ok: true }
    },
  }
}

/** Helper to extract IP address from request headers */
export async function getClientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? h.get('x-real-ip')
    ?? 'unknown'
}
