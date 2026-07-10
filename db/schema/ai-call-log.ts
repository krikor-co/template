import { integer, text, pgTable, timestamp, jsonb, numeric } from 'drizzle-orm/pg-core'

/**
 * AI call telemetry — one row per LLM model call across the app. Records the
 * model, token usage, USD cost (gateway-reported when available, else computed
 * from `lib/ai/pricing.ts`), what the call was about (`purpose` + `details`),
 * and latency — so model swaps can be compared on cost + quality. Written
 * fail-open via `lib/ai/instrument.ts::recordAiCall` (never breaks a model
 * call). Nullable workspace/user scope: platform-level calls leave them null.
 */
export const aiCallLog = pgTable('ai_call_log', {
  id:           integer('id').primaryKey().generatedAlwaysAsIdentity(),
  workspaceId:  integer('workspace_id'),
  userId:       integer('user_id'),
  /** Stable label for WHAT the call was: e.g. 'assistant' | 'verify' | 'summarize' | … */
  purpose:      text('purpose').notNull(),
  /** The gateway model id, e.g. 'anthropic/claude-haiku-4.5'. */
  model:        text('model').notNull(),
  inputTokens:  integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  totalTokens:  integer('total_tokens'),
  /** USD cost (numeric → string in JS). */
  costUsd:      numeric('cost_usd', { precision: 12, scale: 6 }),
  /** 'gateway' (provider-reported) | 'computed' (pricing table) | null. */
  costSource:   text('cost_source'),
  /** FINAL turn outcome for a PRIMARY assistant pass — see lib/ai/outcome.ts
   *  ('answer' | 'propose' | 'refuse' | 'unavailable' | 'rate_limited' |
   *  'error'). Powers per-model refusal-rate tracking. Null for cost-only rows
   *  (auxiliary passes). */
  outcome:      text('outcome'),
  latencyMs:    integer('latency_ms'),
  /** The question/prompt context + raw provider usage/metadata, for audit. */
  details:      jsonb('details'),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
