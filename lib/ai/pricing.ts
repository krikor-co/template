/**
 * Per-model pricing — the FALLBACK cost source for AI call telemetry when the AI
 * Gateway doesn't report a cost on the response. Values are USD per 1,000,000
 * tokens (input / output). MAINTAIN THIS as models/prices change — and prefer the
 * gateway-reported cost (it's the real charge); this table is only an estimate so
 * a row always has *some* cost for comparison.
 *
 * Keys are the gateway model ids (the exact string passed to generateText/
 * generateObject). Match is exact, then a loose contains-fallback by family.
 */
type Price = { inputPerM: number; outputPerM: number }

const PRICING: Record<string, Price> = {
  // Anthropic (gateway ids). Update with the real gateway rates.
  'anthropic/claude-haiku-4.5':   { inputPerM: 1.0,  outputPerM: 5.0 },
  'anthropic/claude-sonnet-4.5':  { inputPerM: 3.0,  outputPerM: 15.0 },
  'anthropic/claude-sonnet-4-5':  { inputPerM: 3.0,  outputPerM: 15.0 },
  'anthropic/claude-opus-4.5':    { inputPerM: 5.0,  outputPerM: 25.0 },
  'anthropic/claude-opus-4-5':    { inputPerM: 5.0,  outputPerM: 25.0 },
  // OpenAI (in case we experiment).
  'openai/gpt-4.1-mini':          { inputPerM: 0.4,  outputPerM: 1.6 },
  'openai/gpt-4.1':               { inputPerM: 2.0,  outputPerM: 8.0 },
  'openai/gpt-4o-mini':           { inputPerM: 0.15, outputPerM: 0.6 },
}

/** Loose family fallback so an unlisted exact id still gets a ballpark. */
function familyPrice(model: string): Price | null {
  const m = model.toLowerCase()
  if (m.includes('haiku'))  return { inputPerM: 1.0,  outputPerM: 5.0 }
  if (m.includes('sonnet')) return { inputPerM: 3.0,  outputPerM: 15.0 }
  if (m.includes('opus'))   return { inputPerM: 5.0,  outputPerM: 25.0 }
  if (m.includes('mini'))   return { inputPerM: 0.4,  outputPerM: 1.6 }
  return null
}

/** Estimated USD cost for a call, or null if the model is unknown. */
export function priceFor(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = PRICING[model] ?? familyPrice(model)
  if (!p) return null
  return (inputTokens / 1_000_000) * p.inputPerM + (outputTokens / 1_000_000) * p.outputPerM
}
