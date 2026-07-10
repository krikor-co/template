import { cacheLife, revalidateTag, updateTag, cacheTag } from 'next/cache'

/**
 * Named cache-life profiles, in seconds.
 *
 * Push-based invalidation (via `invalidate(Tag.X)`) is the primary mechanism:
 * every server action that mutates data calls it on the right tags. These
 * profiles are a SAFETY NET for the cases push-invalidation can't observe:
 * raw-SQL maintenance, cron jobs, external integrations, and the occasional
 * mutation that ships without an invalidate call.
 *
 *   hot   — operational data users watch in near-real-time.
 *           Dashboard widgets, activity feeds, live counters.
 *           30s revalidate, 5min absolute expire.
 *   warm  — aggregates and detail views the user expects to be "recent".
 *           Entity detail pages, lists, reports.
 *           2min revalidate, 30min expire.
 *   cold  — reference data that changes rarely (settings, catalogs, locale).
 *           10min revalidate, 24h expire.
 *
 * `revalidate` = how soon Next will refetch in the background; `expire`
 * = hard ceiling past which a stale cache entry is discarded entirely.
 * `stale` mirrors `revalidate` so client-side hints align.
 */
export const CacheProfile = {
  hot:  { revalidate: 30,        expire: 5  * 60,      stale: 30 },
  warm: { revalidate: 2  * 60,   expire: 30 * 60,      stale: 2  * 60 },
  cold: { revalidate: 10 * 60,   expire: 24 * 60 * 60, stale: 10 * 60 },
} as const

export type CacheProfileName = keyof typeof CacheProfile

/**
 * Apply a named profile to the current `'use cache'` scope. Call once per
 * cached function — multiple calls don't compose, the last one wins per
 * Next semantics. Pair with `tagWith()` for invalidation control.
 */
export function withCacheProfile(name: CacheProfileName): void {
  cacheLife(CacheProfile[name])
}

type Resolver<P> = (params: P) => readonly string[]
type Registry = Record<string, Resolver<any>>

type TagFunctions<R extends Registry> = {
  [K in keyof R]: R[K] extends Resolver<infer P>
    ? (params: P) => readonly string[]
    : never
}

/**
 * Descriptor-level helpers. Exported at module level (and returned by
 * `createTagRegistry` — same references) so framework wrappers like the
 * Effect adapter `lib/effect/cache.ts` can operate on any registry's
 * descriptors without importing an app-specific tags module. App code
 * should keep importing them from its own tags module for readability.
 */
export function tagWith(descriptor: readonly string[]) {
  cacheTag(descriptor[descriptor.length - 1])
}

export function invalidate(descriptor: readonly string[]) {
  for (const tag of descriptor) {
    updateTag(tag)
  }
}

export function softInvalidate(descriptor: readonly string[], profile: string = 'default') {
  for (const tag of descriptor) {
    revalidateTag(tag, profile)
  }
}

/**
 * Creates a typed, hierarchical cache tag registry.
 *
 * Resolvers return a chain of tags from least to most specific:
 *   booking: (p) => ['bookings', `booking:${p.id}`]
 *
 * tagWith() applies the most specific tag inside a 'use cache' scope.
 * invalidate() uses updateTag — immediate freshness (read-your-own-writes).
 * softInvalidate() uses revalidateTag — serves stale while revalidating in background.
 *
 * Usage:
 *   export const { Tag, tagWith, invalidate, softInvalidate } = createTagRegistry({
 *     bookings: (_: Record<string, never>) => ['bookings'] as const,
 *     booking:  (p: { id: string })        => ['bookings', `booking:${p.id}`] as const,
 *   })
 */
export function createTagRegistry<R extends Registry>(resolvers: R) {
  const Tag = resolvers as unknown as TagFunctions<R>
  return { Tag, tagWith, invalidate, softInvalidate }
}
