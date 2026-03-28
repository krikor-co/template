import { revalidateTag, cacheTag } from 'next/cache'

type Resolver<P> = (params: P) => readonly string[]
type Registry = Record<string, Resolver<any>>

type TagFunctions<R extends Registry> = {
  [K in keyof R]: R[K] extends Resolver<infer P>
    ? (params: P) => readonly string[]
    : never
}

/**
 * Creates a typed, hierarchical cache tag registry.
 *
 * Resolvers return a chain of tags from least to most specific:
 *   booking: (p) => ['bookings', `booking:${p.id}`]
 *
 * tagWith() applies the most specific tag inside a 'use cache' scope.
 * invalidate() revalidates the full chain — entity + all ancestors.
 *
 * Usage:
 *   export const { Tag, tagWith, invalidate, softInvalidate } = createTagRegistry({
 *     bookings: (_: Record<string, never>) => ['bookings'] as const,
 *     booking:  (p: { id: string })        => ['bookings', `booking:${p.id}`] as const,
 *   })
 */
export function createTagRegistry<R extends Registry>(resolvers: R) {
  const Tag = resolvers as unknown as TagFunctions<R>

  function tagWith(descriptor: readonly string[]) {
    cacheTag(descriptor[descriptor.length - 1])
  }

  function invalidate(descriptor: readonly string[]) {
    for (const tag of descriptor) {
      revalidateTag(tag)
    }
  }

  function softInvalidate(descriptor: readonly string[]) {
    invalidate(descriptor)
  }

  return { Tag, tagWith, invalidate, softInvalidate }
}
