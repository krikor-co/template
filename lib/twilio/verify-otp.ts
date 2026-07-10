import { Effect, Cause } from 'effect'
import { verifyTwilioOtpE } from './effect'
import { TracingLayer } from '@/lib/effect/tracing'

/**
 * Promise-returning shim for backward compatibility. Real implementation in
 * `./effect.ts` (pipe of Effect combinators with timeout + span; no retry on
 * verify because retrying could double-consume the user's typed code).
 *
 * Test bypass (`TEST_OTP_BYPASS=true`) short-circuits — code matches if it
 * equals the configured `TEST_OTP_CODE` (default `'123456'`).
 *
 * Returns `false` on transport failure (legacy behavior — caller treats it
 * as "code is invalid"). The Effect version exposes `ExternalServiceError`
 * for callers that want to distinguish.
 */
export async function verifyTwilioOtp(to: string, code: string): Promise<boolean> {
  if (process.env.TEST_OTP_BYPASS === 'true') {
    return code === (process.env.TEST_OTP_CODE ?? '123456')
  }

  const exit = await Effect.runPromiseExit(
    Effect.provide(verifyTwilioOtpE(to, code), TracingLayer),
  )

  if (exit._tag === 'Success') return exit.value

  // Legacy contract: any failure → false. Log defects so we don't lose them silently.
  const failure = Cause.failureOption(exit.cause)
  if (failure._tag === 'None') {
    console.error('[verifyTwilioOtp defect]', Cause.pretty(exit.cause))
  }
  return false
}

export { verifyTwilioOtpE }
