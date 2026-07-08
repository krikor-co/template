import { Effect, pipe } from 'effect'
import { getSession } from '@/lib/auth/session'
import type { SessionPayload } from '@/lib/auth/jwt'
import { Forbidden, Unauthenticated } from './errors'
import { AdminGuardError, requireAdmin as requireAdminRaw } from '@/app/admin/guards'
import { WorkspaceGuardError, requireWorkspaceRole as requireWorkspaceRoleRaw } from '@/app/workspace/guards'

/**
 * Effect-flavored auth guard adapters. Each maps a throw/null-based guard
 * into typed Effect failures so consumers can pattern-match on the
 * discriminator inside a pipe.
 *
 * The unauthenticated/forbidden split is intentional UX: `Unauthenticated`
 * means "no session, send to login"; `Forbidden` means "logged in but lacks
 * the required role, show no-permission copy". Conflating them loses that.
 */

/** Require a valid session; yields the session payload for attribution. */
export const requireSessionE = (): Effect.Effect<SessionPayload, Unauthenticated> =>
  pipe(
    // getSession never rejects (it catches internally and returns null).
    Effect.promise(() => getSession()),
    Effect.flatMap((session) =>
      session === null
        ? Effect.fail(new Unauthenticated({ message: 'Not signed in' }))
        : Effect.succeed(session),
    ),
  )

/**
 * Effect-flavored platform-admin guard. Wraps the throw-based
 * `requireAdmin` (app/admin/guards.ts — checks `users.role === 'admin'`,
 * NOT workspace-scoped) with `Effect.tryPromise` and maps:
 *   AdminGuardError.reason === 'unauthenticated' → Unauthenticated
 *   anything else                                → Forbidden (safe default)
 * Used by every admin-only server action.
 */
export const requireAdminE = (): Effect.Effect<void, Forbidden | Unauthenticated> =>
  Effect.tryPromise({
    try:   () => requireAdminRaw(),
    catch: (e) => {
      if (e instanceof AdminGuardError && e.reason === 'unauthenticated') {
        return new Unauthenticated({ message: 'Not signed in' })
      }
      return new Forbidden({ message: 'Admin role required' })
    },
  })

/**
 * Effect-flavored workspace-role guard. Pass a single role for exact-role
 * surfaces (`'owner'`) or an array for any-of (`['owner', 'member']`).
 * Wraps the throw-based `requireWorkspaceRole` (app/workspace/guards.ts)
 * with `Effect.tryPromise` and maps:
 *   WorkspaceGuardError.reason === 'unauthenticated' → Unauthenticated
 *   anything else                                    → Forbidden (safe default)
 * Used by every workspace-scoped server action.
 */
export const requireWorkspaceRoleE = (
  workspaceId: string,
  role: string | string[],
): Effect.Effect<void, Forbidden | Unauthenticated> =>
  Effect.tryPromise({
    try:   () => requireWorkspaceRoleRaw(workspaceId, role),
    catch: (e) => {
      if (e instanceof WorkspaceGuardError && e.reason === 'unauthenticated') {
        return new Unauthenticated({ message: 'Not signed in' })
      }
      return new Forbidden({ message: 'Workspace role required' })
    },
  })
