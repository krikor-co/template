import { cache } from 'react'
import { cookies } from 'next/headers'
import { verifySessionToken, type SessionPayload } from './jwt'
import { db } from '@/db/drizzle'
import { sessions } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'

/**
 * Request-scoped session snapshot.
 * Verifies the JWT signature AND checks the DB session row:
 * - exists
 * - not expired
 * - not force-deactivated
 *
 * cache() ensures all consumers in one request share the same result.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session_token')?.value
    if (!token) return null

    const payload = await verifySessionToken(token)

    const [row] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.token, token),
          eq(sessions.forceDeactivation, false),
          gt(sessions.expiresAt, new Date()),
        )
      )
      .limit(1)

    if (!row) return null

    return payload
  } catch {
    return null
  }
})

/**
 * Asserts that a valid session exists. Use in server actions and queries
 * that run behind an authenticated layout guard.
 *
 * This should never be the first line of defense — layouts handle the
 * redirect. If this throws, it means a layout guard is missing.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) throw new Error('Unauthenticated — missing layout guard?')
  return session
}
