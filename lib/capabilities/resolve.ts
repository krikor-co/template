import type { CapNotFound } from './types'

/**
 * Name → id resolution conventions for capability `ai.resolve` adapters.
 *
 * The model only ever passes a free-text NAME; a resolver is the
 * workspace-scoped boundary that turns that name into a real, owned id. A
 * non-match returns `null` — the adapter then returns `notFound(name)` and the
 * tool REFUSES rather than inventing a record. Rules every resolver follows:
 *
 *   - WORKSPACE-SCOPED: every query filters on the workspace id from `ctx` —
 *     never an LLM argument.
 *   - READ-ONLY: resolvers run inside preview/execute paths; they never mutate.
 *   - LIVE reads (uncached): a proposal's figures and an execute's
 *     re-verification must reflect current state.
 *
 * Shape (implement per entity in your app, e.g. lib/capabilities/resolvers.ts):
 *
 *   export type ProjectRow = { id: string; name: string }
 *   export const resolveProjectRow: EntityResolver<ProjectRow> =
 *     async (workspaceId, name) => { … fuzzy match, workspace-scoped … }
 */
export type EntityResolver<Row> = (workspaceId: string, name: string) => Promise<Row | null>

/** Build the "could not resolve this entity" sentinel an `ai.resolve` returns. */
export const notFound = (searchedFor: string): CapNotFound => ({ error: 'not_found', searchedFor })

/** Guard for the sentinel — tools/generators short-circuit on it. */
export function isCapNotFound(x: unknown): x is CapNotFound {
  return !!x && typeof x === 'object' && (x as { error?: string }).error === 'not_found'
}
