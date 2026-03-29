'use server'

import { z } from 'zod'
import { cookies, headers } from 'next/headers'
import { db } from '@/db/drizzle'
import { persons, users, sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyEmailOtp } from '@/lib/otp/email-otp'
import { createSessionToken } from '@/lib/auth/jwt'

const schema = z.object({
  email: z.string().email(),
  code:  z.string().min(4).max(10),
})

export async function verifyOtpAction(
  formData: FormData
): Promise<{ success: false; error: string } | { success: true; redirectTo: string }> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    code:  formData.get('code'),
  })
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const { email, code } = parsed.data

  const isValid = await verifyEmailOtp(email, code)
  if (!isValid) return { success: false, error: 'Invalid or expired code. Please try again.' }

  // Find or create person → then find or create user (auth role)
  let person = (await db.select().from(persons).where(eq(persons.email, email)).limit(1))[0]
  if (!person) {
    const [created] = await db.insert(persons).values({ email }).returning()
    person = created
  }

  let user = (await db.select().from(users).where(eq(users.personId, person.id)).limit(1))[0]
  if (!user) {
    const [created] = await db.insert(users).values({ personId: person.id }).returning()
    user = created
  }

  const token = await createSessionToken({ userId: String(user.id), email: person.email })

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  const headersList = await headers()
  await db.insert(sessions).values({
    userId:    user.id,
    token,
    expiresAt,
    userAgent:  headersList.get('user-agent') ?? undefined,
    ipAddress: headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? undefined,
  })

  const cookieStore = await cookies()
  cookieStore.set('session_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,
    path:     '/',
  })
  cookieStore.delete('auth_email')
  cookieStore.delete('auth_is_new')

  const returnTo = formData.get('returnTo')
  return { success: true, redirectTo: typeof returnTo === 'string' && returnTo ? returnTo : '/dashboard' }
}
