import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { workspaces, workspaceMembers } from '@/db/schema'
import { getSession } from '@/lib/auth/session'

/**
 * Sentinel error thrown by `requireWorkspaceRole` when the caller is not
 * authenticated or does not hold one of the required roles on the requested
 * workspace. Layouts catch this and redirect; server actions go through the
 * Effect adapter `requireWorkspaceRoleE` (lib/effect/auth.ts) instead.
 */
export class WorkspaceGuardError extends Error {
  constructor(public readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason)
    this.name = 'WorkspaceGuardError'
  }
}

function parseWorkspaceId(workspaceId: string): number {
  const id = Number.parseInt(workspaceId, 10)
  if (!Number.isFinite(id) || id <= 0) {
    throw new WorkspaceGuardError('forbidden')
  }
  return id
}

/**
 * Guard for all `/workspace/:workspaceId/...` routes and workspace-scoped
 * server actions.
 *
 * Verifies that:
 *   1. A valid session exists (delegates to `getSession()`).
 *   2. The session user has an ACTIVE membership on the workspace whose role
 *      is one of `role` (string or array — pass `['owner', 'member']` for
 *      "any member", `'owner'` for owner-only surfaces). Soft-deleted
 *      memberships AND soft-deleted workspaces fail the guard.
 *
 * On failure, throws a `WorkspaceGuardError`. The workspace layout wraps this
 * in try/catch and redirects (unauthenticated → login, forbidden → dashboard).
 */
export async function requireWorkspaceRole(workspaceId: string, role: string | string[]): Promise<void> {
  const session = await getSession()
  if (!session) throw new WorkspaceGuardError('unauthenticated')

  const workspaceIdNum = parseWorkspaceId(workspaceId)
  const roles = Array.isArray(role) ? role : [role]

  const [membership] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    // Join the workspace so a soft-deleted workspace fails the guard: an
    // active workspace still passes; a deleted one is rejected (→ redirect).
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceIdNum),
        eq(workspaceMembers.userId, Number(session.userId)),
        inArray(workspaceMembers.role, roles),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    )
    .limit(1)

  if (!membership) throw new WorkspaceGuardError('forbidden')
}
