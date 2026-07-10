/**
 * AI call telemetry — `recordAiCall` writes ONE `ai_call_log` row per LLM model
 * call (e.g. an assistant loop, a verifier pass, generative UI). Captures
 * model, token usage, USD cost, what the call was about, and latency — so
 * model swaps can be compared on cost + quality.
 *
 * FAIL-OPEN + FIRE-AND-FORGET: a telemetry write must NEVER break or slow an AI
 * call. Callers don't await it; every error is swallowed. The DB write is a single
 * insert off the request's hot path.
 *
 * Cost source: prefer the GATEWAY-reported cost on the response (the real charge),
 * else compute from `pricing.ts`. We try a few likely providerMetadata shapes
 * since the Vercel AI Gateway's metadata layout can vary; the raw usage/metadata
 * is also stored in `details` so the extraction can be refined from real data.
 */

import { db } from '@/db/drizzle'
import { aiCallLog } from '@/db/schema'
import { priceFor } from './pricing'

/** The token-usage shape across AI SDK versions (v5 input/output, older prompt/completion). */
type Usage = {
  inputTokens?: number; outputTokens?: number; totalTokens?: number
  promptTokens?: number; completionTokens?: number
} | undefined

/** Pull a gateway-reported USD cost out of providerMetadata, if present. */
function gatewayCost(meta: unknown): number | null {
  if (!meta || typeof meta !== 'object') return null
  const m = meta as Record<string, unknown>
  const gw = m.gateway as Record<string, unknown> | undefined
  // VERIFIED against a real Vercel AI Gateway response (Claude Haiku 4.5):
  // the per-call USD charge is a STRING at `providerMetadata.gateway.cost`
  // (e.g. "0.000056"), alongside `gatewayCost` / `marketCost` / `inferenceCost`.
  // We read `.cost` first (the real charge), then a couple of aliases as a hedge
  // against future layout drift; the raw metadata is stored in `details` anyway.
  const candidates = [
    gw?.cost,
    gw?.gatewayCost,
    gw?.inferenceCost,
    m.cost,
  ]
  for (const c of candidates) {
    const n = typeof c === 'string' ? Number(c) : typeof c === 'number' ? c : NaN
    if (Number.isFinite(n)) return n
  }
  return null
}

export function recordAiCall(input: {
  purpose:           string
  model:             string
  usage?:            Usage
  providerMetadata?: unknown
  workspaceId?:      number | string | null
  userId?:           number | string | null
  latencyMs?:        number
  /** What the call was about — e.g. { question } — plus anything useful to audit. */
  details?:          Record<string, unknown>
  /** FINAL turn outcome for the PRIMARY assistant pass — 'answer' | 'propose' |
   *  'refuse' | 'unavailable' | 'rate_limited' | 'error' — see lib/ai/outcome.ts.
   *  Left undefined for cost-only rows (auxiliary passes). */
  outcome?:          string
}): void {
  void (async () => {
    try {
      const u = input.usage ?? {}
      const inTok  = u.inputTokens  ?? u.promptTokens     ?? null
      const outTok = u.outputTokens ?? u.completionTokens ?? null
      const totTok = u.totalTokens  ?? (inTok != null || outTok != null ? (inTok ?? 0) + (outTok ?? 0) : null)

      const fromGateway = gatewayCost(input.providerMetadata)
      const cost = fromGateway ?? priceFor(input.model, inTok ?? 0, outTok ?? 0)
      const costSource = fromGateway != null ? 'gateway' : cost != null ? 'computed' : null

      const wid = typeof input.workspaceId === 'string' ? Number(input.workspaceId) : input.workspaceId
      const uid = typeof input.userId === 'string' ? Number(input.userId) : input.userId

      await db.insert(aiCallLog).values({
        workspaceId:  wid != null && Number.isFinite(wid) ? wid : null,
        userId:       uid != null && Number.isFinite(uid) ? uid : null,
        purpose:      input.purpose,
        model:        input.model,
        inputTokens:  inTok,
        outputTokens: outTok,
        totalTokens:  totTok,
        costUsd:      cost != null ? String(cost) : null,
        costSource,
        outcome:      input.outcome ?? null,
        latencyMs:    input.latencyMs ?? null,
        details:      input.details ?? null,
      })
    } catch {
      /* telemetry must never break an AI call */
    }
  })()
}
