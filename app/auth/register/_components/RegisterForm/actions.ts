'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { db } from '@/db/drizzle'
import { persons } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createEmailOtp } from '@/lib/otp/email-otp'
import { sendTwilioOtp } from '@/lib/twilio/send-otp'
import { isTwilioEnabled } from '@/lib/twilio/config'
import { Resend } from 'resend'
import { transitions } from '@/app/auth/guards'
import { createRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  AUTH_IDENTIFIER_COOKIE,
  AUTH_IDENTIFIER_TYPE_COOKIE,
  AUTH_IS_NEW_COOKIE,
} from '@/lib/auth/identifier'
import { getPublicLocale } from '@/lib/i18n/getLocale'
import { tracedAction } from '@/lib/effect/traced'

const registerLimit = createRateLimit({ action: 'register', max: 3, windowMs: 15 * 60 * 1000 })

const resend = new Resend(process.env.RESEND_API_KEY)

const schema = z.object({
  identifier:     z.string().min(1),
  identifierType: z.enum(['phone', 'email']),
  name:           z.string().trim().optional(),
})

export async function registerAction(
  formData: FormData
): Promise<{ success: false; error: string } | { success: true }> {
  return tracedAction('registerAction', {}, async () => {
  const parsed = schema.safeParse({
    identifier:     formData.get('identifier'),
    identifierType: formData.get('identifierType'),
    name:           formData.get('name') || undefined,
  })
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const { identifierType, name } = parsed.data
  // Canonicalize email to lowercase so accounts are case-insensitive.
  const identifier = identifierType === 'email' ? parsed.data.identifier.toLowerCase() : parsed.data.identifier

  // Defense-in-depth: the identify step already gates phone, but the cookie
  // round-trip means this action must fail closed too if Twilio is unset.
  if (identifierType === 'phone' && !isTwilioEnabled()) {
    return { success: false, error: 'Phone sign-up is not available. Please use your email.' }
  }

  const ip = await getClientIp()
  const limit = await registerLimit.check(identifier, ip)
  if (!limit.ok) return { success: false, error: limit.error }

  // Check the person doesn't already exist
  const existing = identifierType === 'email'
    ? await db.select().from(persons).where(eq(persons.email, identifier)).limit(1)
    : await db.select().from(persons).where(eq(persons.phoneNumber, identifier)).limit(1)

  if (existing.length > 0) return { success: false, error: 'Account already exists.' }

  // Create the person with the identifier they used. Stamp the locale the
  // visitor ACTUALLY saw during signup (app.locale cookie override, else
  // DEFAULT_LOCALE) — persons.locale has a static default that must not
  // silently override what they experienced.
  await db.insert(persons).values({
    name:   name ?? null,
    locale: await getPublicLocale(),
    ...(identifierType === 'email' ? { email: identifier } : { phoneNumber: identifier }),
  })

  // Send the OTP over the matching channel
  if (identifierType === 'email') {
    const { code } = await createEmailOtp(identifier)
    // DEV convenience: print the code to the server console so you can log in
    // locally without waiting on email delivery. Never runs in production.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[auth] DEV login code for ${identifier} -> ${code}\n`)
    }
    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
      to:      identifier,
      subject: 'Your login code',
      html:    `<p>Your login code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
    })
    if (error) return { success: false, error: 'Failed to send code. Please try again.' }
  } else {
    const result = await sendTwilioOtp(identifier, await getPublicLocale())
    if (!result.success) return { success: false, error: result.error }
  }

  const cookieStore = await cookies()
  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge:   60 * 15,
    path:     '/',
  }
  cookieStore.set(AUTH_IDENTIFIER_COOKIE, identifier, cookieOpts)
  cookieStore.set(AUTH_IDENTIFIER_TYPE_COOKIE, identifierType, cookieOpts)
  cookieStore.delete(AUTH_IS_NEW_COOKIE)
  await transitions.register.grant()

  return { success: true }
  })
}
