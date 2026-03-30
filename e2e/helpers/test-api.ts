import type { APIRequestContext } from '@playwright/test'

async function callOtpApi(request: APIRequestContext, data: object) {
  const res = await request.post('/api/test/otp', { data })
  if (!res.ok()) throw new Error(`OTP API failed: ${res.status()} ${await res.text()}`)
  return res.json()
}

/**
 * Plants a known OTP code ("000000") for the given email directly in the DB,
 * bypassing Resend. Use this after navigating to /auth/verify to set up a
 * code the test can submit.
 */
export async function insertTestOtp(request: APIRequestContext, email: string): Promise<string> {
  const { code } = await callOtpApi(request, { email, action: 'insert' })
  return code as string
}

/**
 * Sets the attempts counter to 4 on the current active OTP for the given email.
 * One more wrong submission will then trigger the MAX_ATTEMPTS lockout.
 */
export async function maxOutOtpAttempts(request: APIRequestContext, email: string): Promise<void> {
  await callOtpApi(request, { email, action: 'set-attempts' })
}
