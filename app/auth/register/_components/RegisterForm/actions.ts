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
  name:     z.string().trim().optional(),
  returnTo: z.string().optional(),
})

export async function registerAction(
  formData: FormData
): Promise<{ success: false; error: string } | never> {
  const parsed = schema.safeParse({
    email:    formData.get('email'),
    name:     formData.get('name') || undefined,
    returnTo: formData.get('returnTo') || undefined,
  })
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const { email, name, returnTo } = parsed.data

  const existing = await db.select().from(persons).where(eq(persons.email, email)).limit(1)
  if (existing.length === 0) {
    await db.insert(persons).values({ email, name: name ?? null })
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
  cookieStore.delete('auth_is_new')

  redirect(route.exits.verify({ returnTo }))
}
