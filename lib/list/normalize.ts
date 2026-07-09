/**
 * Accent- and case-insensitive normaliser for client-side list search.
 *
 * Strips diacritics via NFD decomposition so "José" matches "jose" and
 * "Insumo Básico" matches "basico". Lives in `lib/` (a framework utility,
 * not a section) so both the `useListFilter` hook and any server-side
 * keyword precompute can share one definition.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * True when every whitespace-separated token of `query` appears somewhere in
 * `haystack`. Both sides are normalised. An empty query always matches — the
 * caller decides whether to short-circuit to the unfiltered list.
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = normalizeText(query)
  if (q.length === 0) return true
  const hay = normalizeText(haystack)
  return q.split(/\s+/).every((token) => hay.includes(token))
}
