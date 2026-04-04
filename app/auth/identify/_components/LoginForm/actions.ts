'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { db } from '@/db/drizzle'
import { persons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createEmailOtp } from '@/lib/otp/email-otp'
import { Resend } from 'resend'
import { transitions, AUTH_RETURN_TO_COOKIE } from '@/app/auth/guards'
import { createRateLimit, getClientIp } from '@/lib/rate-limit'

const sendOtpLimit = createRateLimit({ action: 'send_otp', max: 3, windowMs: 15 * 60 * 1000 })

const resend = new Resend(process.env.RESEND_API_KEY)

const schema = z.object({
  email: z.string().email(),
  returnTo: z.string().optional(),
})

export async function sendLoginOtp(
  formData: FormData
): Promise<{ success: false; error: string } | { success: true; isNew: boolean }> {
  const parsed = schema.safeParse({ email: formData.get('email'), returnTo: formData.get('returnTo') || undefined })
  if (!parsed.success) return { success: false, error: 'Invalid email address.' }

  const { email, returnTo } = parsed.data

  const ip = await getClientIp()
  const limit = await sendOtpLimit.check(email, ip)
  if (!limit.ok) return { success: false, error: limit.error }

  const cookieStore = await cookies()
  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge:   60 * 15,
    path:     '/',
  }

  if (returnTo) {
    cookieStore.set(AUTH_RETURN_TO_COOKIE, returnTo, cookieOpts)
  } else {
    cookieStore.delete(AUTH_RETURN_TO_COOKIE)
  }

  const existing = await db.select().from(persons).where(eq(persons.email, email)).limit(1)

  if (existing.length === 0) {
    cookieStore.set('auth_email',  email, cookieOpts)
    cookieStore.set('auth_is_new', '1',   cookieOpts)
    await transitions.identify.grant()
    return { success: true, isNew: true }
  }

  const { code } = await createEmailOtp(email)

  const { error } = await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@verify.prolizz.com',
    to:      email,
    subject: 'Your login code',
    html:    `<p>Your login code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
  })

  if (error) return { success: false, error: 'Failed to send code. Please try again.' }

  cookieStore.set('auth_email', email, cookieOpts)
  await transitions.identify.grant()

  return { success: true, isNew: false }
}
