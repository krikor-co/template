import { Effect, pipe, Schedule } from 'effect'
import { getTwilioConfig } from './config'
import { ExternalServiceError, Timeout } from '@/lib/effect/errors'
import { TracingLayer } from '@/lib/effect/tracing'
import type { Locale } from '@/lib/i18n/types'

/**
 * Effect-flavoured Twilio Verify helpers.
 *
 * This is the canonical demo of the four Effect features at once:
 *   - typed errors:  `ExternalServiceError | Timeout`
 *   - timeout:       5s ceiling per attempt via `Effect.timeoutFail`
 *   - retry:         3 attempts with exponential-jittered backoff
 *   - observability: an OTel span around every call (`twilio.send_otp` /
 *                    `twilio.verify_otp`), with phone redacted to last 4
 *   - i18n:          SMS language comes from the caller's resolved locale
 *                    (Twilio Verify accepts BCP-47 tags like 'en', 'pt-BR')
 *
 * The Promise-returning shims in `send-otp.ts` and `verify-otp.ts` call into
 * these via `Effect.runPromise`, so existing call-sites get the upgrade for
 * free without changing.
 */

const TWILIO_BASE = 'https://verify.twilio.com/v2/Services'

const lastFour = (phone: string) => phone.replace(/[^0-9]/g, '').slice(-4)

const fetchTwilio = (
  url:    string,
  body:   URLSearchParams,
  config: ReturnType<typeof getTwilioConfig>,
) =>
  Effect.tryPromise({
    try: () => fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:  `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
      },
      body,
    }),
    catch: (cause) => new ExternalServiceError({ service: 'twilio', cause }),
  })

// ─── sendTwilioOtpE ─────────────────────────────────────────────────────────

export const sendTwilioOtpE = (to: string, locale: Locale): Effect.Effect<void, ExternalServiceError | Timeout> => pipe(
  Effect.try({
    try:   () => getTwilioConfig(),
    catch: (cause) => new ExternalServiceError({ service: 'twilio', cause }),
  }),
  Effect.flatMap((config) =>
    fetchTwilio(
      `${TWILIO_BASE}/${config.serviceSid}/Verifications`,
      new URLSearchParams({ To: to, Channel: 'sms', Locale: locale }),
      config,
    ),
  ),
  Effect.flatMap((res) => res.ok
    ? Effect.void
    : pipe(
        Effect.tryPromise({
          try:   () => res.json() as Promise<{ message?: string }>,
          catch: (cause) => new ExternalServiceError({ service: 'twilio', cause }),
        }),
        Effect.flatMap((body) => Effect.fail(new ExternalServiceError({
          service: 'twilio',
          cause:   body.message ?? `HTTP ${res.status}`,
        }))),
      ),
  ),
  // 5-second ceiling per attempt — typed Timeout instead of Effect's built-in.
  Effect.timeoutFail({
    duration:  '5 seconds',
    onTimeout: () => new Timeout({ message: 'Twilio send_otp timed out', durationMs: 5000 }),
  }),
  // 3 retries on transient failures with exponential jittered backoff.
  Effect.retry({
    times:    2,
    schedule: Schedule.exponential('200 millis').pipe(Schedule.jittered),
  }),
  Effect.withSpan('twilio.send_otp', { attributes: { 'phone.last4': lastFour(to) } }),
)

// ─── verifyTwilioOtpE ───────────────────────────────────────────────────────

export const verifyTwilioOtpE = (to: string, code: string): Effect.Effect<boolean, ExternalServiceError | Timeout> => pipe(
  Effect.try({
    try:   () => getTwilioConfig(),
    catch: (cause) => new ExternalServiceError({ service: 'twilio', cause }),
  }),
  Effect.flatMap((config) =>
    fetchTwilio(
      `${TWILIO_BASE}/${config.serviceSid}/VerificationCheck`,
      new URLSearchParams({ To: to, Code: code }),
      config,
    ),
  ),
  Effect.flatMap((res) => {
    // Verify endpoint: a 4xx is an INVALID code (not a transport failure) — return false, don't fail.
    if (res.status === 404 || res.status === 400) return Effect.succeed(false)
    if (!res.ok) return Effect.fail(new ExternalServiceError({
      service: 'twilio',
      cause:   `HTTP ${res.status}`,
    }))
    return Effect.tryPromise({
      try:   () => res.json() as Promise<{ valid?: boolean; status?: string }>,
      catch: (cause) => new ExternalServiceError({ service: 'twilio', cause }),
    }).pipe(
      Effect.map((body) => body.valid === true && body.status === 'approved'),
    )
  }),
  Effect.timeoutFail({
    duration:  '5 seconds',
    onTimeout: () => new Timeout({ message: 'Twilio verify_otp timed out', durationMs: 5000 }),
  }),
  // Don't retry verify — the user typed a code, retrying could double-consume.
  Effect.withSpan('twilio.verify_otp', { attributes: { 'phone.last4': lastFour(to) } }),
)

// ─── Boundary: run the Effect with TracingLayer provided ────────────────────

/**
 * Bridge: run a Twilio Effect to a Promise. The TracingLayer is provided here
 * so spans emit. Errors are re-thrown so the caller can pattern-match if it
 * cares, or use the Promise-shim wrappers in `send-otp.ts` / `verify-otp.ts`.
 */
export const runTwilio = <A, E>(effect: Effect.Effect<A, E, never>): Promise<A> =>
  Effect.runPromise(pipe(effect, Effect.provide(TracingLayer)))
