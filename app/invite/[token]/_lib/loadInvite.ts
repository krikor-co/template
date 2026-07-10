import { eq } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { invites, workspaces, persons } from '@/db/schema'
import { validateInvite } from '@/lib/invite/validate'

export type InviteLoad =
  | {
      ok: true
      invite: {
        id:            number
        workspaceId:   number
        workspaceName: string
        email:         string
        role:          string
        token:         string
        /** Existing name on record for the invite's email, or null if brand-new. */
        existingName: string | null
      }
    }
  | { ok: false; reason: 'notFound' | 'expired' | 'used' | 'revoked' }

/**
 * Loads an invite by token and validates it server-side. The token is the only
 * credential, so the lookup is by token alone; all status/expiry checks happen
 * in `validateInvite` (never trust the client). Joins the workspace for its
 * display name, and looks up whether the invited email already has a `persons`
 * record (so the accept screen can pre-fill the name).
 */
export async function loadInvite(token: string): Promise<InviteLoad> {
  const [row] = await db
    .select({
      id:            invites.id,
      workspaceId:   invites.workspaceId,
      email:         invites.email,
      role:          invites.role,
      token:         invites.token,
      status:        invites.status,
      expiresAt:     invites.expiresAt,
      workspaceName: workspaces.name,
    })
    .from(invites)
    .innerJoin(workspaces, eq(workspaces.id, invites.workspaceId))
    .where(eq(invites.token, token))
    .limit(1)

  const validity = validateInvite(row)
  if (!validity.ok) return validity

  const [pers] = await db
    .select({ name: persons.name })
    .from(persons)
    .where(eq(persons.email, row.email))
    .limit(1)
  const existingName = pers?.name?.trim() || null

  return {
    ok: true,
    invite: {
      id:            row.id,
      workspaceId:   row.workspaceId,
      workspaceName: row.workspaceName,
      email:         row.email,
      role:          row.role,
      token:         row.token,
      existingName,
    },
  }
}
