import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? (() => { throw new Error('AUTH_SECRET is not configured') })()
)

export type SessionPayload = {
  userId: string
  email:  string
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, secret)

  if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') {
    throw new Error('Invalid session token payload')
  }

  return { userId: payload.userId, email: payload.email }
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session_token')?.value
    if (!token) return null
    return await verifySessionToken(token)
  } catch {
    return null
  }
}
