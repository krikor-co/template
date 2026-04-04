---
title: Caching
order: 5
category: Core
---

# CacheRegistry — Data Invalidation

Never call `cacheTag`, `revalidateTag`, or `updateTag` directly. Always go through a `createTagRegistry`.

## Setup

```typescript
// lib/appointment/tags.ts  (or in the section's tags.ts)
import { createTagRegistry } from '@/lib/cache-registry'

export const { Tag, tagWith, invalidate, softInvalidate } = createTagRegistry({
  appointments: (_: Record<string, never>) => ['appointments'] as const,
  appointment:  (p: { id: string })        => ['appointments', `appointment:${p.id}`] as const,
})
```

## In query.ts — tag the cache

```typescript
export async function getAppointmentsState(): Promise<State> {
  'use cache'
  tagWith(Tag.appointments({}))
  // ... fetch and return state
}
```

Use `cacheLife()` when you need to control the cache duration explicitly. Next.js provides built-in profiles (`'seconds'`, `'minutes'`, `'hours'`, `'days'`, `'weeks'`, `'max'`) or you can define custom profiles. When omitted, the default cache lifetime applies. Only add `cacheLife` when the default doesn't fit — most queries work fine without it.

## In actions.ts — invalidate after mutation

```typescript
'use server'
export async function deleteAppointment(id: string) {
  await db.delete(appointments).where(eq(appointments.id, id))
  invalidate(Tag.appointment({ id }))
  // Invalidating appointment:123 also invalidates the parent 'appointments' list tag
}
```

## Rules

- Never call `cacheTag`, `revalidateTag` directly — always use the registry.
- `tagWith` only inside `'use cache'` scope.
- `invalidate(Tag.entity({ id }))` invalidates the entity AND its parent list — the hierarchy is encoded in the resolver.
- Use `softInvalidate` when eventual consistency is acceptable (background revalidation, no blocking).
