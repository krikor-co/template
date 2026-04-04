'use server'

import { cookies } from 'next/headers'
import { db } from '@/db/drizzle'
import { sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function logoutAction(): Promise<
  { success: true } | { success: false; error: string }
> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (token) {
    await db
      .update(sessions)
      .set({ forceDeactivation: true })
      .where(eq(sessions.token, token))
  }

  const cookieOpts = { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const }
  cookieStore.set('session_token', '', { ...cookieOpts, maxAge: 0 })
  cookieStore.set('auth_email', '', { ...cookieOpts, maxAge: 0 })
  cookieStore.set('auth_is_new', '', { ...cookieOpts, maxAge: 0 })

  return { success: true }
}
