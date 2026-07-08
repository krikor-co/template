import { Effect } from 'effect'
import { sendTwilioOtpE, runTwilio } from './effect'
import type { Locale } from '@/lib/i18n/types'

/**
 * Promise-returning shim for backward compatibility. The real implementation
 * is in `./effect.ts` as a pipe of Effect combinators (retry + timeout +
 * span). Existing call sites can keep using this shim unchanged; the upgrade
 * is transparent.
 *
 * Test bypass (`TEST_OTP_BYPASS=true`) short-circuits before any Twilio call.
 */
export async function sendTwilioOtp(to: string, locale: Locale): Promise<{ success: true } | { success: false; error: string }> {
  if (process.env.TEST_OTP_BYPASS === 'true') {
    return { success: true }
  }

  // Bridge: convert the Effect to a Promise<Either>-like result. We use
  // runPromiseExit so we can pattern-match on the failure cause and return
  // the legacy `{ success, error }` shape.
  const exit = await Effect.runPromiseExit(
    Effect.provide(sendTwilioOtpE(to, locale), (await import('@/lib/effect/tracing')).TracingLayer),
  )

  if (exit._tag === 'Success') return { success: true }

  // Failure — extract the typed error if any, fall back to a generic message.
  const { Cause } = await import('effect')
  const failure = Cause.failureOption(exit.cause)
  if (failure._tag === 'Some') {
    const e = failure.value
    return { success: false, error: e.message }
  }
  return { success: false, error: 'Failed to send SMS code.' }
}

// Keep the runTwilio export here in case future callers want the typed Effect form directly.
export { sendTwilioOtpE, runTwilio }
