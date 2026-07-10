/**
 * The workspace roles an invite may grant. Mirrors the seeded vocabulary of
 * the `workspace_members.role` TEXT column — extend BOTH together when your
 * app adds roles. Owner is intentionally excluded from the invite UI's
 * selectable roles — workspace ownership is not handed out via the team
 * invite form — but the type still includes it so a label can be rendered
 * for any existing member/invite row.
 */
export const WORKSPACE_ROLES = ['owner', 'member'] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

/** Roles selectable in an invite form. */
export const INVITABLE_ROLES = ['member'] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

export function isInvitableRole(v: string): v is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(v)
}
