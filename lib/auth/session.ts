import { cache } from 'react'
import { getCurrentUser, type SessionPayload } from './jwt'

/**
 * Request-scoped session snapshot.
 * cache() ensures all consumers in one request share the same cookie read.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  return getCurrentUser()
})

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) throw new Error('Unauthenticated')
  return session
}
