import { db } from '@/db/drizzle'
import { otpCodes } from '@/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { generateOtp } from './generate-otp'
import { hashOtp, verifyOtpHash } from './hash-otp'

const OTP_EXPIRATION_MINUTES = 15
const MAX_ATTEMPTS = 5

export async function createEmailOtp(email: string): Promise<{ code: string; expiresAt: Date }> {
  const code = generateOtp(6)
  const hashedCode = hashOtp(code)
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRATION_MINUTES)

  await db.insert(otpCodes).values({ email, code: hashedCode, expiresAt })

  return { code, expiresAt }
}

export async function verifyEmailOtp(email: string, code: string): Promise<boolean> {
  const records = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), eq(otpCodes.used, false), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)

  if (records.length === 0) return false

  const record = records[0]

  if (record.attempts >= MAX_ATTEMPTS) {
    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, record.id))
    return false
  }

  if (verifyOtpHash(code, record.code)) {
    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, record.id))
    return true
  }

  await db.update(otpCodes).set({ attempts: record.attempts + 1 }).where(eq(otpCodes.id, record.id))
  return false
}
