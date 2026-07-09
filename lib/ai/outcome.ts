/**
 * AI turn-outcome classification — the taxonomy `ai_call_log.outcome` uses.
 *
 * The load-bearing rule (irene commit 9b1ac1f): INFRA IS NOT A REFUSAL.
 * `unavailable` (gateway outage / over its spend cap), `rate_limited`, and
 * `error` (generic api/gateway failure) are TEMPORARY service problems — they
 * must never be counted as the model refusing, or an outage pollutes every
 * quality metric (irene's $10-cap outage logged thousands of false capability
 * gaps before this split). Genuine turn results:
 *
 *   - `answer`  — the model answered from real data.
 *   - `propose` — the model proposed a write (pending user confirm).
 *   - `refuse`  — an honest "I can't do that" on a working service.
 *
 * Thread the outcome into `recordAiCall({ outcome })` AFTER the final result
 * settles; auxiliary passes (retries, verifiers) leave it undefined.
 */
export type AiOutcome = 'answer' | 'propose' | 'refuse' | 'unavailable' | 'rate_limited' | 'error'

/** Turns where the model actually resolved the request (denominator for rates). */
export const RESOLVED_OUTCOMES: ReadonlySet<AiOutcome> = new Set(['answer', 'propose', 'refuse'])

/** Temporary service problems — never quality signals. */
export const INFRA_OUTCOMES: ReadonlySet<AiOutcome> = new Set(['unavailable', 'rate_limited', 'error'])

export function isInfraFailure(outcome: string | null | undefined): boolean {
  return outcome != null && INFRA_OUTCOMES.has(outcome as AiOutcome)
}

/**
 * Classify a caught failure from an LLM code path. Recognizes the tagged-error
 * convention of `lib/effect/errors.ts` (`_tag`): an `ExternalServiceError` is
 * the gateway/provider being down or capped → `unavailable`; `RateLimited` is
 * our own limiter → `rate_limited`; anything else is a generic `error`.
 */
export function classifyFailure(err: unknown): 'unavailable' | 'rate_limited' | 'error' {
  const tag = (err as { _tag?: string } | null | undefined)?._tag
  if (tag === 'ExternalServiceError') return 'unavailable'
  if (tag === 'RateLimited') return 'rate_limited'
  return 'error'
}

/**
 * Per-model refusal rate over a set of logged outcomes: refusals / resolved
 * turns. Infra failures and cost-only rows (null outcome) are EXCLUDED from
 * the denominator. Returns null when nothing resolved.
 */
export function refusalRate(outcomes: ReadonlyArray<string | null | undefined>): number | null {
  const resolved = outcomes.filter(
    (o): o is AiOutcome => o != null && RESOLVED_OUTCOMES.has(o as AiOutcome),
  )
  if (resolved.length === 0) return null
  const refusals = resolved.filter((o) => o === 'refuse').length
  return refusals / resolved.length
}
