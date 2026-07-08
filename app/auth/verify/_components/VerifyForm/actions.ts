'use server'

import { z } from 'zod'
import { cookies, headers } from 'next/headers'
import { db } from '@/db/drizzle'
import { persons, users, sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createEmailOtp, verifyEmailOtp } from '@/lib/otp/email-otp'
import { sendTwilioOtp } from '@/lib/twilio/send-otp'
import { verifyTwilioOtp } from '@/lib/twilio/verify-otp'
import { createSessionToken } from '@/lib/auth/jwt'
import { transitions, AUTH_RETURN_TO_COOKIE } from '@/app/auth/guards'
import { createRateLimit, getClientIp } from '@/lib/rate-limit'
import { Resend } from 'resend'
import {
  AUTH_SESSION_COOKIE,
  AUTH_IDENTIFIER_COOKIE,
  AUTH_IDENTIFIER_TYPE_COOKIE,
  AUTH_IS_NEW_COOKIE,
  type IdentifierType,
} from '@/lib/auth/identifier'
import { getPublicLocale } from '@/lib/i18n/getLocale'
import { tracedAction } from '@/lib/effect/traced'

const verifyLimit = createRateLimit({ action: 'verify_otp', max: 5, windowMs: 15 * 60 * 1000 })
const resendLimit = createRateLimit({ action: 'resend_otp', max: 3, windowMs: 15 * 60 * 1000 })

const resend = new Resend(process.env.RESEND_API_KEY)

const schema = z.object({
  identifier:     z.string().min(1),
  identifierType: z.enum(['phone', 'email']),
  code:           z.string().min(4).max(10),
})

export async function verifyOtpAction(
  formData: FormData
): Promise<{ success: false; error: string } | { success: true }> {
  return tracedAction('verifyOtpAction', {}, async () => {
  const parsed = schema.safeParse({
    identifier:     formData.get('identifier'),
    identifierType: formData.get('identifierType'),
    code:           formData.get('code'),
  })
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const { identifierType, code } = parsed.data
  // Canonicalize email to lowercase so the OTP + person lookup are case-insensitive.
  const identifier = identifierType === 'email' ? parsed.data.identifier.toLowerCase() : parsed.data.identifier

  const ip = await getClientIp()
  const limit = await verifyLimit.check(identifier, ip)
  if (!limit.ok) return { success: false, error: limit.error }

  // Verify the OTP via the matching channel
  const isValid = identifierType === 'email'
    ? await verifyEmailOtp(identifier, code)
    : await verifyTwilioOtp(identifier, code)

  if (!isValid) return { success: false, error: 'Invalid or expired code. Please try again.' }

  // The person must already exist — registerAction created it for new users.
  const [person] = identifierType === 'email'
    ? await db.select().from(persons).where(eq(persons.email, identifier)).limit(1)
    : await db.select().from(persons).where(eq(persons.phoneNumber, identifier)).limit(1)

  if (!person) return { success: false, error: 'Account not found.' }

  // Find or create the auth role for this person
  let [user] = await db.select().from(users).where(eq(users.personId, person.id)).limit(1)
  if (!user) {
    const [created] = await db.insert(users).values({ personId: person.id }).returning()
    user = created
  }

  const token = await createSessionToken({ userId: user.id })

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  const headersList = await headers()
  await db.insert(sessions).values({
    userId:    user.id,
    token,
    expiresAt,
    userAgent: headersList.get('user-agent') ?? undefined,
    ipAddress: headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? undefined,
  })

  const cookieStore = await cookies()
  cookieStore.set(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,
    path:     '/',
  })
  cookieStore.set(AUTH_IDENTIFIER_COOKIE, '', { path: '/', maxAge: 0 })
  cookieStore.set(AUTH_IDENTIFIER_TYPE_COOKIE, '', { path: '/', maxAge: 0 })
  cookieStore.set(AUTH_IS_NEW_COOKIE, '', { path: '/', maxAge: 0 })
  cookieStore.set(AUTH_RETURN_TO_COOKIE, '', { path: '/', maxAge: 0 })
  await transitions.verify.grant()

  return { success: true }
  })
}

const resendSchema = z.object({
  identifier:     z.string().min(1),
  identifierType: z.enum(['phone', 'email']),
})

export async function resendOtpAction(
  identifier: string,
  identifierType: IdentifierType,
): Promise<{ success: true } | { success: false; error: string }> {
  return tracedAction('resendOtpAction', {}, async () => {
  // Server actions are public endpoints — runtime-validate even typed params.
  const parsed = resendSchema.safeParse({ identifier, identifierType })
  if (!parsed.success) return { success: false, error: 'Invalid input.' }

  const target = parsed.data.identifierType === 'email'
    ? parsed.data.identifier.toLowerCase()
    : parsed.data.identifier

  const ip = await getClientIp()
  const limit = await resendLimit.check(target, ip)
  if (!limit.ok) return { success: false, error: limit.error }

  if (parsed.data.identifierType === 'email') {
    const { code } = await createEmailOtp(target)
    // DEV convenience: print the code to the server console so you can log in
    // locally without waiting on email delivery. Never runs in production.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[auth] DEV login code for ${target} -> ${code}\n`)
    }
    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
      to:      target,
      subject: 'Your login code',
      html:    `<p>Your login code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
    })
    if (error) return { success: false, error: 'Failed to send code. Please try again.' }
  } else {
    const result = await sendTwilioOtp(target, await getPublicLocale())
    if (!result.success) return { success: false, error: result.error }
  }

  return { success: true }
  })
}
