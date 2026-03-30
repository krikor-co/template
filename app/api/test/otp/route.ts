import { NextResponse } from 'next/server'
import { db } from '@/db/drizzle'
import { otpCodes } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { hashOtp } from '@/lib/otp/hash-otp'

export async function POST(req: Request) {
  if (process.env.PLAYWRIGHT_TEST !== '1') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { email, action = 'insert' } = await req.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  if (action === 'insert') {
    const code = '000000'
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    await db.delete(otpCodes).where(eq(otpCodes.email, email))
    await db.insert(otpCodes).values({ email, code: hashOtp(code), expiresAt })
    return NextResponse.json({ code })
  }

  if (action === 'set-attempts') {
    // Pre-sets attempts to 4 so one more wrong attempt triggers the max-attempts lockout
    await db
      .update(otpCodes)
      .set({ attempts: 4 })
      .where(
        and(eq(otpCodes.email, email), eq(otpCodes.used, false), gt(otpCodes.expiresAt, new Date()))
      )
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
