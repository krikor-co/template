import { Effect } from 'effect'
import { invalidate as invalidateRaw, softInvalidate as softInvalidateRaw } from '@/lib/cache-registry'

/**
 * Effect-flavored thin wrappers around the cache registry. These exist so
 * cache mutations can be composed inside a `pipe(...)` (typically via
 * `Effect.tap`) without breaking the Effect chain — no need to bridge in/out
 * of Promise-land mid-pipeline. Both descriptors come straight from
 * `Tag.X({...})`, which returns `readonly string[]`.
 */
export const cacheE = {
  /** Mutation read-your-own-writes (server actions only) — `updateTag` under the hood. */
  invalidate:     (descriptor: readonly string[]) => Effect.sync(() => invalidateRaw(descriptor)),
  /** Background revalidation — serves stale while refreshing. Use when eventual consistency is OK. */
  softInvalidate: (descriptor: readonly string[]) => Effect.sync(() => softInvalidateRaw(descriptor)),
}
