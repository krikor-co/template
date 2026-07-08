import { Effect, pipe } from 'effect'
import { getSession } from '@/lib/auth/session'
import type { SessionPayload } from '@/lib/auth/jwt'
import { Forbidden, Unauthenticated } from './errors'

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
 * STUB — the admin guard (`requireAdmin` / `AdminGuardError` over
 * `users.role === 'admin'`) is not wired yet. Fails closed with `Forbidden`
 * until then. The real implementation wraps the throw-based `requireAdmin()`
 * with `Effect.tryPromise` and maps
 * `AdminGuardError.reason === 'unauthenticated'` → `Unauthenticated`,
 * everything else → `Forbidden`.
 */
export const requireAdminE = (): Effect.Effect<void, Forbidden | Unauthenticated> =>
  Effect.fail(new Forbidden({ message: 'Admin guard not wired yet' }))

/**
 * STUB — the workspace-role guard (`requireWorkspaceRole` /
 * `WorkspaceGuardError` over workspace_members) is not wired yet. Fails
 * closed with `Forbidden` until then. Pass a single role for exact-role
 * surfaces (`'owner'`) or an array for any-of (`['owner', 'member']`).
 * The real implementation wraps the throw-based
 * `requireWorkspaceRole(workspaceId, role)` with `Effect.tryPromise` and maps
 * `WorkspaceGuardError.reason === 'unauthenticated'` → `Unauthenticated`,
 * everything else → `Forbidden`.
 */
export const requireWorkspaceRoleE = (
  workspaceId: string,
  role: string | string[],
): Effect.Effect<void, Forbidden | Unauthenticated> =>
  Effect.fail(new Forbidden({
    message: `Workspace guard not wired yet — workspace ${workspaceId}, role ${Array.isArray(role) ? role.join(', ') : role}`,
  }))
