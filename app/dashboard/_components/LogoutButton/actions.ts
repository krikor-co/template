'use server'

import { Effect, pipe } from 'effect'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { sessions } from '@/db/schema'
import { runAction } from '@/lib/effect/run-action'
import { mapResult } from '@/lib/effect/boundary'
import { dbE } from '@/lib/effect/db'
import {
  AUTH_SESSION_COOKIE,
  AUTH_IDENTIFIER_COOKIE,
  AUTH_IDENTIFIER_TYPE_COOKIE,
  AUTH_IS_NEW_COOKIE,
} from '@/lib/auth/identifier'

/**
 * Worked example of the Effect action pattern (see docs/data-flow.md →
 * "Server actions and cached queries with Effect"): pure-pipe business
 * logic, `runAction` boundary (30s timeout + `logoutAction` span into
 * trace_span), `mapResult` collapsing every failure kind to one user-facing
 * message. The result signature is the flat legacy shape, so the section
 * component is unchanged.
 */
const logout = (token: string | undefined) => pipe(
  Effect.Do,
  Effect.tap(() =>
    token
      ? dbE.run(db.update(sessions).set({ forceDeactivation: true }).where(eq(sessions.token, token)))
      : Effect.void,
  ),
  Effect.map(() => ({})),
)

export async function logoutAction(): Promise<
  { success: true } | { success: false; error: string }
> {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value

  const result = await runAction(logout(token), { actionName: 'logoutAction' })

  // Cookies clear regardless of DB outcome — a failed session-row update
  // must not leave the client logged in. (The legacy version threw before
  // reaching this point on DB error; this is strictly safer.)
  const cookieOpts = { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const }
  cookieStore.set(AUTH_SESSION_COOKIE, '', { ...cookieOpts, maxAge: 0 })
  cookieStore.set(AUTH_IDENTIFIER_COOKIE, '', { ...cookieOpts, maxAge: 0 })
  cookieStore.set(AUTH_IDENTIFIER_TYPE_COOKIE, '', { ...cookieOpts, maxAge: 0 })
  cookieStore.set(AUTH_IS_NEW_COOKIE, '', { ...cookieOpts, maxAge: 0 })

  return mapResult(result, { fallback: 'Could not log out. Please try again.' })
}
