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

### Cache-life profiles

Named profiles live in `lib/cache-registry.ts` (`CacheProfile`) and are applied with `withCacheProfile(name)` inside the `'use cache'` scope, right after `tagWith`:

| Profile | revalidate | expire | Use for |
|---|---|---|---|
| `hot`  | 30s    | 5 min  | operational data users watch in near-real-time (dashboard widgets, activity feeds) |
| `warm` | 2 min  | 30 min | aggregates and detail views expected to be "recent" (entity detail, lists, reports) |
| `cold` | 10 min | 24 h   | reference data that changes rarely (settings, catalogs, locale) |

```typescript
import { withCacheProfile } from '@/lib/cache-registry'

export async function getPersonsState(): Promise<State> {
  'use cache'
  tagWith(Tag.persons({}))
  withCacheProfile('warm')
  // ... fetch and return state
}
```

Profile rules:

- **Push-first.** Push-based invalidation (`invalidate(Tag.X)` after every mutation) is the primary freshness mechanism.
- **Profiles are a safety net, not a strategy.** They cover what push can't observe: raw-SQL maintenance, cron jobs, external integrations, a missed invalidate call. Never rely on `revalidate` for read-your-own-writes.
- **Once per cached fn.** Call `withCacheProfile` exactly once per `'use cache'` function — multiple calls don't compose; the last one wins per Next semantics.
- Reach for Next's raw `cacheLife()` only when none of the three profiles fit — and consider adding a profile instead.

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

---

## Cached queries with Effect

The body of a `'use cache'` function stays plain async at the signature — Next inspects it that way to register the cache key. Effect lives **inside** the body via `runQuery(pipe(...))`, which uses `Effect.runPromise` to collapse the chain back into the resolved `Promise<A>` Next stores under the cache key.

The pattern is always: `'use cache'` → `tagWith(Tag.x(...))` → `withCacheProfile('hot' | 'warm' | 'cold')` → `return runQuery(pipe(...), { queryName, attributes })`.

```typescript
import { Effect, pipe } from 'effect'
import { runQuery } from '@/lib/effect/run-query'
import { dbE } from '@/lib/effect/db'
import { withCacheProfile } from '@/lib/cache-registry'
import { Tag, tagWith } from '@/lib/person/tags'

export async function fetchRecentPersons(): Promise<PersonRow[]> {
  'use cache'
  tagWith(Tag.persons({}))
  withCacheProfile('warm')

  return runQuery(pipe(
    dbE.run(db.select().from(persons).orderBy(desc(persons.createdAt)).limit(10)),
    Effect.map((rows) => rows.map(toPersonRow)),
  ), { queryName: 'fetchRecentPersons' })
}
```

**Cache hits bypass the body entirely** — the registered cache key resolves before the function executes, so no Effect runs and no span is emitted. Spans appear only on **misses**, which is exactly when the work happened and is worth tracing.

`runQuery` bakes in a 30s timeout by default and provides the `TracingLayer`. Pass `timeout: '5 seconds'` for tighter ceilings, or `null` to disable. Failures **throw** at the boundary (matching Drizzle's native semantics) — no `{ success, error }` envelope.

For the full mutation/query pattern, typed-error union, and pipe step reference, see [`data-flow.md` → "Server actions and cached queries with Effect"](data-flow.md#server-actions-and-cached-queries-with-effect).
