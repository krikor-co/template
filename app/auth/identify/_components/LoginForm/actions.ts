'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { db } from '@/db/drizzle'
import { persons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createEmailOtp } from '@/lib/otp/email-otp'
import { Resend } from 'resend'
import { route } from '../../contract'

const resend = new Resend(process.env.RESEND_API_KEY)

const schema = z.object({
  email:    z.string().email(),
  returnTo: z.string().optional(),
})

export async function sendLoginOtp(
  formData: FormData
): Promise<{ success: false; error: string } | never> {
  const parsed = schema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { success: false, error: 'Invalid email address.' }

  const { email, returnTo } = parsed.data

  const existing = await db.select().from(persons).where(eq(persons.email, email)).limit(1)
  if (existing.length === 0) {
    const cookieStore = await cookies()
    const cookieOpts = {
      httpOnly: false,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge:   60 * 15,
      path:     '/',
    }
    cookieStore.set('auth_email',  email, cookieOpts)
    cookieStore.set('auth_is_new', '1',   cookieOpts)
    redirect(route.exits.register({ returnTo }))
  }

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
    httpOnly: false,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 15,
    path:     '/',
  })

  redirect(route.exits.verify({}))
}
