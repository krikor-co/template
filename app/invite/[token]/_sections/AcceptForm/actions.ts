'use server'

import { Effect, pipe } from 'effect'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { db } from '@/db/drizzle'
import { invites, workspaceMembers, persons, users, sessions } from '@/db/schema'
import { createSessionToken } from '@/lib/auth/jwt'
import { AUTH_SESSION_COOKIE } from '@/lib/auth/identifier'
import { getCurrentLocale } from '@/lib/i18n/getLocale'
import { t } from '@/lib/i18n/messages'
import { validateInvite } from '@/lib/invite/validate'
import { runAction } from '@/lib/effect/run-action'
import { mapResult } from '@/lib/effect/boundary'
import { dbE } from '@/lib/effect/db'
import { validate } from '@/lib/effect/validate'
import { NotFound, ValidationFailed } from '@/lib/effect/errors'

const acceptSchema = z.object({
  token: z.string().min(1),
  name:  z.string().trim().max(120).optional(),
})

export type AcceptInviteInput = z.infer<typeof acceptSchema>

export type AcceptInviteResult =
  | { success: true; workspaceId: string; role: string }
  | { success: false; error: string; needsName?: boolean }

/**
 * Magic-link accept. The invite TOKEN (delivered only to the invitee's email)
 * is the credential — NO prior sign-in is required. We:
 *   1. re-validate the token + 'pending' status + expiry server-side,
 *   2. find-or-create the `persons` row for the invite's email (creating one
 *      needs a name — the form collects/confirms it),
 *   3. find-or-create the `users` row and the `workspace_members` row (role
 *      from the invite),
 *   4. mark the invite accepted (guarded by status='pending' → SINGLE-USE),
 *   5. MINT A SESSION + set the session cookie (logs them in),
 * then return the workspaceId + role so the section routes into the workspace.
 */
const acceptInviteE = (raw: unknown) => pipe(
  Effect.Do,
  Effect.bind('input', () => validate(acceptSchema, raw)),

  // Server-side token + status + expiry validation (client supplies only token).
  Effect.bind('inviteRow', ({ input }) =>
    pipe(
      dbE.findFirst(
        db
          .select({
            id:          invites.id,
            workspaceId: invites.workspaceId,
            email:       invites.email,
            role:        invites.role,
            status:      invites.status,
            expiresAt:   invites.expiresAt,
          })
          .from(invites)
          .where(eq(invites.token, input.token))
          .limit(1),
      ),
      Effect.flatMap((row) => {
        if (!row) return Effect.fail(new NotFound({ entity: 'invite' }))
        const validity = validateInvite(row)
        if (!validity.ok) return Effect.fail(new NotFound({ entity: 'invite' }))
        return Effect.succeed(row)
      }),
    ),
  ),

  // A brand-new invitee (no persons row for this email yet) must supply a
  // name. Surface a typed validation error so the form can show the field.
  Effect.bind('existingPerson', ({ inviteRow }) =>
    dbE.findFirst(
      db.select({ id: persons.id }).from(persons).where(eq(persons.email, inviteRow.email)).limit(1),
    ),
  ),
  Effect.tap(({ existingPerson, input }) =>
    existingPerson || (input.name ?? '').trim().length > 0
      ? Effect.void
      : Effect.fail(new ValidationFailed({ message: 'NAME_REQUIRED' })),
  ),

  // Provision identity + membership in one transaction → returns the userId.
  Effect.bind('provision', ({ input, inviteRow }) =>
    dbE.transaction(async (tx) => {
      const name = (input.name ?? '').trim()

      let [p] = await tx
        .select({ id: persons.id })
        .from(persons)
        .where(eq(persons.email, inviteRow.email))
        .limit(1)
      if (!p) {
        const [created] = await tx
          .insert(persons)
          .values({ name, email: inviteRow.email, emailVerified: true })
          .returning({ id: persons.id })
        p = created
      } else if (name) {
        // Existing record — the invitee VALIDATED/corrected their name on the
        // accept screen; persist any change. emailVerified flips true since
        // they just proved control of the email via the invite link.
        await tx
          .update(persons)
          .set({ name, emailVerified: true })
          .where(eq(persons.id, p.id))
      }

      let [u] = await tx.select({ id: users.id }).from(users).where(eq(users.personId, p.id)).limit(1)
      if (!u) {
        const [created] = await tx.insert(users).values({ personId: p.id }).returning({ id: users.id })
        u = created
      }

      await tx
        .insert(workspaceMembers)
        .values({ workspaceId: inviteRow.workspaceId, userId: u.id, role: inviteRow.role })
        .onConflictDoNothing({ target: [workspaceMembers.workspaceId, workspaceMembers.userId] })

      // SINGLE-USE: only a still-pending invite flips to accepted.
      await tx
        .update(invites)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(and(eq(invites.id, inviteRow.id), eq(invites.status, 'pending')))

      return { userId: u.id }
    }),
  ),

  // Log the invitee in — mint a session row + set the session cookie.
  Effect.tap(({ provision }) =>
    dbE.run((async () => {
      const token = await createSessionToken({ userId: provision.userId })
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)
      const h = await headers()
      await db.insert(sessions).values({
        userId:    provision.userId,
        token,
        expiresAt,
        userAgent: h.get('user-agent') ?? undefined,
        ipAddress: h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? undefined,
      })
      const c = await cookies()
      c.set(AUTH_SESSION_COOKIE, token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   60 * 60 * 24 * 30,
        path:     '/',
      })
      return undefined
    })()),
  ),

  Effect.map(({ inviteRow }) => ({
    workspaceId: String(inviteRow.workspaceId),
    role:        inviteRow.role,
  })),
)

export async function acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
  const locale = await getCurrentLocale()
  const m = t(locale).invite

  const result = await runAction(acceptInviteE(input), {
    actionName: 'acceptInvite',
    timeout:    '10 seconds',
    attributes: {},
  })

  // Surface the "needs a name" validation specially so the form can react.
  if (!result.success && result.kind === 'ValidationFailed' && result.error === 'NAME_REQUIRED') {
    return { success: false, error: m.nameRequired, needsName: true }
  }

  return mapResult(result, {
    fallback: m.errors.accept,
    notFound: m.errors.notFound,
  })
}
