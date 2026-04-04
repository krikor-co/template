'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { db } from '@/db/drizzle'
import { persons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createEmailOtp } from '@/lib/otp/email-otp'
import { Resend } from 'resend'
import { transitions } from '@/app/auth/guards'
import { createRateLimit, getClientIp } from '@/lib/rate-limit'

const registerLimit = createRateLimit({ action: 'register', max: 3, windowMs: 15 * 60 * 1000 })

const resend = new Resend(process.env.RESEND_API_KEY)

const schema = z.object({
  email: z.string().email(),
  name:  z.string().trim().optional(),
})

export async function registerAction(
  formData: FormData
): Promise<{ success: false; error: string } | { success: true }> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    name:  formData.get('name') || undefined,
  })
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const { email, name } = parsed.data

  const ip = await getClientIp()
  const limit = await registerLimit.check(email, ip)
  if (!limit.ok) return { success: false, error: limit.error }

  const existing = await db.select().from(persons).where(eq(persons.email, email)).limit(1)
  if (existing.length > 0) return { success: false, error: 'Account already exists.' }

  await db.insert(persons).values({ email, name: name ?? null })

  const { code } = await createEmailOtp(email)

  const { error } = await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@verify.prolizz.com',
    to:      email,
    subject: 'Your login code',
    html:    `<p>Your login code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
  })

  if (error) return { success: false, error: 'Failed to send code. Please try again.' }

  const cookieStore = await cookies()
  cookieStore.set('auth_email', email, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 15,
    path:     '/',
  })
  cookieStore.delete('auth_is_new')
  await transitions.register.grant()

  return { success: true }
}
