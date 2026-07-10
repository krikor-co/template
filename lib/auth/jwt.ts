import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? (() => { throw new Error('AUTH_SECRET is not configured') })()
)

/**
 * The session payload is deliberately SLIM: a numeric `userId` only. The
 * token is decoupled from any particular identifier — email/phone can
 * change or be absent (phone-only accounts) without invalidating sessions.
 * Everything else is looked up fresh per request via getSession's DB check.
 */
export type SessionPayload = {
  userId: number
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, secret)

  if (typeof payload.userId !== 'number') {
    throw new Error('Invalid session token payload')
  }

  return { userId: payload.userId }
}
