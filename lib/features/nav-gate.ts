import 'server-only'
import { resolveFeatureFlags, type FeatureContext } from './resolve'

/**
 * A FAIL-OPEN predicate: "should this nav entry render?" for a feature key.
 *
 * Returns `true` (SHOW) for everything EXCEPT a key whose resolved value is
 * EXACTLY `false`. So unmapped entries (no key), unknown keys, and any value
 * that isn't a hard `false` all SHOW.
 */
export type NavGate = (featureKey?: string | null) => boolean

/**
 * Resolve feature flags ONCE for a request and return a FAIL-OPEN gate that
 * nav/layout code uses to decide whether to render an entry.
 *
 * SAFETY — FAIL-OPEN by construction. A nav entry is hidden ONLY when its
 * mapped key resolves to EXACTLY `false`:
 *   • no key (unmapped entry)            → SHOW
 *   • key absent from the resolved map   → SHOW
 *   • key present but not strictly false → SHOW
 *   • resolution throws / is unavailable → SHOW everything
 *
 * `resolveFeatureFlags` already never throws (DB errors fall back to the full
 * set of registry defaults), but we still wrap it in try/catch so that NO
 * wiring bug — here or upstream — can ever hide navigation by default. The
 * default state of this gate, on any failure, is "render everything".
 */
export async function createNavGate(ctx: FeatureContext): Promise<NavGate> {
  let flags: Record<string, boolean>
  try {
    flags = await resolveFeatureFlags(ctx)
  } catch {
    // Defensive belt-and-suspenders: fail-open to "show everything".
    flags = {}
  }
  return (featureKey) => {
    if (!featureKey) return true // unmapped entry → SHOW
    return flags[featureKey] !== false // hide ONLY on a strict false
  }
}
