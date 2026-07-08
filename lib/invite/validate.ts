/**
 * Pure invite-validity check, shared by the invite page loader
 * (app/invite/[token]/_lib/loadInvite.ts) and the accept action. The token is
 * the only credential, so ALL status/expiry checks happen server-side against
 * the loaded row — never trust the client.
 *
 * Single-use invariant: the accept transaction flips status
 * pending → accepted guarded by `status = 'pending'`; any subsequent load of
 * the same token lands in the 'used' branch here.
 */
export type InviteStatusRow = {
  /** 'pending' | 'accepted' | 'revoked' | 'expired' (text column). */
  status:    string
  expiresAt: Date
}

export type InviteValidation =
  | { ok: true }
  | { ok: false; reason: 'notFound' | 'expired' | 'used' | 'revoked' }

export function validateInvite(
  row: InviteStatusRow | null | undefined,
  now: Date = new Date(),
): InviteValidation {
  if (!row) return { ok: false, reason: 'notFound' }
  if (row.status === 'revoked') return { ok: false, reason: 'revoked' }
  if (row.status === 'accepted') return { ok: false, reason: 'used' }
  if (row.status === 'expired' || row.expiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: 'expired' }
  }
  if (row.status !== 'pending') return { ok: false, reason: 'notFound' }
  return { ok: true }
}
