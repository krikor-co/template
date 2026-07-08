import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { users } from '@/db/schema'
import { getSession } from '@/lib/auth/session'

/**
 * Sentinel error thrown by `requireAdmin` when the caller is not authenticated
 * or does not have the platform `admin` role. Layouts catch this and redirect;
 * server actions go through the Effect adapter `requireAdminE`.
 */
export class AdminGuardError extends Error {
  constructor(public readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason)
    this.name = 'AdminGuardError'
  }
}

/**
 * Guard for `/admin/...` routes and admin server actions.
 *
 * Verifies that a valid session exists AND the session user has the platform
 * `admin` role (`users.role`, NOT workspace-scoped). Throws `AdminGuardError`
 * on failure — there is intentionally NO environment bypass; an admin surface
 * mutates platform state, so it must never be reachable unauthenticated.
 */
export async function requireAdmin(): Promise<void> {
  const session = await getSession()
  if (!session) throw new AdminGuardError('unauthenticated')

  const [found] = await db
    .select({ role: users.role })
    .from(users)
    .where(and(eq(users.id, Number(session.userId)), isNull(users.deletedAt)))
    .limit(1)

  if (found?.role !== 'admin') throw new AdminGuardError('forbidden')
}
