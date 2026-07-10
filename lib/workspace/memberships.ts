import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { workspaces, workspaceMembers, users } from '@/db/schema'

export interface UserWorkspace {
  id:   number
  name: string
  /** The membership's role — template seeds 'owner' | 'member' (app-extensible). */
  role: string
}

/**
 * Every ACTIVE membership the user holds, joined to its workspace. Powers the
 * post-login dispatcher (0 → onboarding, 1 → workspace home, N → picker).
 * Soft-deleted memberships and soft-deleted workspaces are excluded.
 */
export async function getUserWorkspaces(userId: number): Promise<UserWorkspace[]> {
  return db
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    )
    .orderBy(workspaces.id)
}

/** Platform admins keep the dashboard even with no workspace of their own. */
export async function isPlatformAdmin(userId: number): Promise<boolean> {
  const [account] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return account?.role === 'admin'
}
