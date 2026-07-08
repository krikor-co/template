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
import { transitions, AUTH_RETURN_TO_COOKIE } from '@/app/auth/guards'
import { createRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  detectIdentifierType,
  normalizePhone,
  AUTH_IDENTIFIER_COOKIE,
  AUTH_IDENTIFIER_TYPE_COOKIE,
  AUTH_IS_NEW_COOKIE,
} from '@/lib/auth/identifier'
import { getPublicLocale } from '@/lib/i18n/getLocale'
import { tracedAction } from '@/lib/effect/traced'

const sendOtpLimit = createRateLimit({ action: 'send_otp', max: 3, windowMs: 15 * 60 * 1000 })

const resend = new Resend(process.env.RESEND_API_KEY)

const schema = z.object({
  identifier: z.string().min(1),
  returnTo: z.string().optional(),
})

export async function sendLoginOtp(
  formData: FormData
): Promise<{ success: false; error: string } | { success: true; isNew: boolean }> {
  return tracedAction('sendLoginOtp', {}, async () => {
  const parsed = schema.safeParse({
    identifier: formData.get('identifier'),
    returnTo: formData.get('returnTo') || undefined,
  })
  if (!parsed.success) return { success: false, error: 'Please enter an email or phone number.' }

  const { returnTo } = parsed.data
  const rawIdentifier = parsed.data.identifier.trim()

  const identifierType = detectIdentifierType(rawIdentifier)
  if (!identifierType) return { success: false, error: 'Please enter a valid email or phone number.' }

  // Phone OTP is feature-flagged on the TWILIO_* env vars — without them the
  // app is email-only and phone identifiers are rejected up front.
  if (identifierType === 'phone' && !isTwilioEnabled()) {
    return { success: false, error: 'Phone sign-in is not available. Please use your email.' }
  }

  // Emails are case-insensitive — lowercase so "User@…" matches the existing
  // "user@…" person instead of creating a duplicate account.
  const identifier = identifierType === 'phone' ? normalizePhone(rawIdentifier) : rawIdentifier.toLowerCase()

  const ip = await getClientIp()
  const limit = await sendOtpLimit.check(identifier, ip)
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

  // Check if a person exists for the channel they used
  const existing = identifierType === 'email'
    ? await db.select().from(persons).where(eq(persons.email, identifier)).limit(1)
    : await db.select().from(persons).where(eq(persons.phoneNumber, identifier)).limit(1)

  if (existing.length === 0) {
    // New user — skip OTP, go to register
    cookieStore.set(AUTH_IDENTIFIER_COOKIE, identifier, cookieOpts)
    cookieStore.set(AUTH_IDENTIFIER_TYPE_COOKIE, identifierType, cookieOpts)
    cookieStore.set(AUTH_IS_NEW_COOKIE, '1', cookieOpts)
    await transitions.identify.grant()
    return { success: true, isNew: true }
  }

  // Existing user — send the OTP over the matching channel
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
    // SMS language follows the visitor's resolved locale, never a hardcoded tag.
    const result = await sendTwilioOtp(identifier, await getPublicLocale())
    if (!result.success) return { success: false, error: result.error }
  }

  cookieStore.set(AUTH_IDENTIFIER_COOKIE, identifier, cookieOpts)
  cookieStore.set(AUTH_IDENTIFIER_TYPE_COOKIE, identifierType, cookieOpts)
  await transitions.identify.grant()

  return { success: true, isNew: false }
  })
}
