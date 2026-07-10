---
title: Data Flow
order: 9
category: Patterns
---

# How Data Flows — End to End

## On load

1. Browser requests `/bookings?page=2`.
2. Next.js renders `app/bookings/list/page.tsx`.
3. `page.tsx` calls `route.entry.parse(ctx)` — Zod validates and coerces `searchParams` into `{ page: 2 }`.
4. `page.tsx` calls `getBookingsListState()` (or renders `<BookingsList />` in a `<Suspense>`).
5. `getBookingsListState()` runs inside `'use cache'`, calls `tagWith(Tag.bookings({}))`, queries the DB, returns `State`.
6. `page.tsx` passes `state` as `initialState` to the section component.
7. Section renders via `switch (state.status)`.

## On mutation

1. User triggers an action (button click → server action call, or form submit).
2. Server action runs: validates input, calls domain function, updates DB.
3. Server action calls `invalidate(Tag.booking({ id }))` — this revalidates `booking:${id}` and `bookings`.
4. Next.js purges the affected cache entries.
5. On the next request (or on re-render if using `revalidatePath`), the section fetches fresh data.

## On client fetch

```
1. Parent section has selectedId in state
2. Parent renders <NoteDetail initialState={{ status: 'loading', id: selectedId }} />
3. NoteDetail mounts, useNoteLoader fires (state.status === 'loading')
4. Hook calls getNoteState(id) — a server action used as a data loader
5. Server action queries DB, returns data
6. Hook dispatches LOADED — section transitions to 'loaded' state
7. Component re-renders with content
```

---

## Worked Example — Appointment Booking Flow

Complete end-to-end: `/appointments/list` (list) and `/appointments/new` (create form).

### Shared tags

```typescript
// lib/appointment/tags.ts
import { createTagRegistry } from '@/lib/cache-registry'

export const { Tag, tagWith, invalidate, softInvalidate } = createTagRegistry({
  appointments: (_: Record<string, never>) => ['appointments'] as const,
  appointment:  (p: { id: string })        => ['appointments', `appointment:${p.id}`] as const,
})
```

---

### Route: /appointments/list

**entry.ts**:
```typescript
// app/appointments/list/entry.ts
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

const schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params) => `/appointments?page=${p.page}`,
  parse: (ctx: ParseContext) => schema.parse(ctx.searchParams),
}
```

**contract.ts**:
```typescript
// app/appointments/list/contract.ts
import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as newEntry }    from '../new/entry'
import { entry as detailEntry } from '../detail/entry'

export const route = createRoute({
  entry,
  exits: {
    new:    newEntry.href,
    detail: detailEntry.href,
  },
})
```

**AppointmentsList/state.ts**:
```typescript
export type Appointment = {
  id:       string
  service:  string
  date:     string
  status:   'confirmed' | 'pending' | 'cancelled'
}

export type State =
  | { status: 'empty' }
  | { status: 'loaded'; appointments: Appointment[] }

export type Event =
  | { type: 'SELECT'; id: string }
```

**AppointmentsList/transition.ts**:
```typescript
import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  // List section — navigation is via router.push, no local state transitions needed
  return state
}
```

**AppointmentsList/scene.ts**:
```typescript
import { createScene } from '@/lib/scene'
import { transition } from './transition'

export const scene = createScene(transition)
```

**AppointmentsList/query.ts**:
```typescript
import { db } from '@/db/drizzle'
import { Tag, tagWith } from '@/lib/appointment/tags'
import type { State } from './state'

export async function getAppointmentsListState(): Promise<State> {
  'use cache'
  tagWith(Tag.appointments({}))

  const rows = await db.query.appointments.findMany({ orderBy: (t, { desc }) => [desc(t.date)] })
  if (rows.length === 0) return { status: 'empty' }
  return { status: 'loaded', appointments: rows }
}
```

**AppointmentsList/fixtures.ts**:
```typescript
import type { State } from './state'

export const fixtures = {
  empty: { status: 'empty' } satisfies State,
  loaded: {
    status: 'loaded',
    appointments: [
      { id: '1', service: 'Haircut', date: '2026-04-01', status: 'confirmed' },
      { id: '2', service: 'Massage', date: '2026-04-03', status: 'pending'   },
    ],
  } satisfies State,
}
```

**AppointmentsList/AppointmentsList.tsx**:
```tsx
'use client'
import Link from 'next/link'
import { route } from '../../contract'
import { scene } from './scene'
import type { State } from './state'

export function AppointmentsList({ initialState }: { initialState: State }) {
  const [state] = scene.useScene(initialState)

  switch (state.status) {
    case 'empty':
      return (
        <div>
          <p className="text-muted-foreground">No appointments yet.</p>
          <Link href={route.exits.new({})}>Book your first appointment</Link>
        </div>
      )
    case 'loaded':
      return (
        <ul>
          {state.appointments.map((a) => (
            <li key={a.id}>
              <Link href={route.exits.detail({ id: a.id })}>
                {a.service} — {a.date} — {a.status}
              </Link>
            </li>
          ))}
        </ul>
      )
  }
}
```

**page.tsx**:
```tsx
// app/appointments/list/page.tsx
import { Suspense } from 'react'
import { Shell } from '@/lib/shell'
import { route } from './contract'
import { getAppointmentsListState } from './_components/AppointmentsList/query'
import { AppointmentsList } from './_components/AppointmentsList/AppointmentsList'
import { fixtures } from './_components/AppointmentsList/fixtures'
import Link from 'next/link'

type Props = { searchParams: Record<string, string | string[] | undefined> }

export default async function AppointmentsListPage({ searchParams }: Props) {
  const params = route.entry.parse({ params: {}, searchParams, cookies: {} })
  const initialState = await getAppointmentsListState()

  return (
    <Shell.FullPage title="Appointments">
      <div className="flex justify-end mb-4">
        <Link href={route.exits.new({})}>New appointment</Link>
      </div>
      <Suspense fallback={<AppointmentsList initialState={fixtures.empty} />}>
        <AppointmentsList initialState={initialState} />
      </Suspense>
    </Shell.FullPage>
  )
}
```

---

### Route: /appointments/new

**entry.ts**:
```typescript
// app/appointments/new/entry.ts
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

const schema = z.object({
  returnTo: z.string().optional(),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params) => p.returnTo ? `/appointments/new?returnTo=${encodeURIComponent(p.returnTo)}` : `/appointments/new`,
  parse: (ctx: ParseContext) => schema.parse(ctx.searchParams),
}
```

**contract.ts**:
```typescript
// app/appointments/new/contract.ts
import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as listEntry }   from '../list/entry'
import { entry as detailEntry } from '../detail/entry'

export const route = createRoute({
  entry,
  exits: {
    list:   listEntry.href,
    detail: detailEntry.href,
  },
})
```

**CreateAppointmentForm/state.ts**:
```typescript
export type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error';   message: string }
  | { status: 'success'; redirectTo: string }

export type Event =
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; redirectTo: string }
  | { type: 'ERROR';   message: string }
  | { type: 'RETRY' }
```

**CreateAppointmentForm/transition.ts**:
```typescript
import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'SUBMIT') return { status: 'submitting' }
      break
    case 'submitting':
      if (event.type === 'SUCCESS') return { status: 'success', redirectTo: event.redirectTo }
      if (event.type === 'ERROR')   return { status: 'error', message: event.message }
      break
    case 'error':
      if (event.type === 'RETRY')  return { status: 'idle' }
      if (event.type === 'SUBMIT') return { status: 'submitting' }
      break
  }
  return state
}
```

**CreateAppointmentForm/scene.ts**:
```typescript
import { createScene } from '@/lib/scene'
import { transition } from './transition'

export const scene = createScene(transition)
```

**CreateAppointmentForm/actions.ts**:
```typescript
'use server'
import { db } from '@/db/drizzle'
import { appointments } from '@/db/schema'
import { invalidate } from '@/lib/appointment/tags'
import { Tag } from '@/lib/appointment/tags'

export async function createAppointment(
  formData: FormData,
): Promise<{ success: true; appointmentId: string } | { success: false; error: string }> {
  const service = formData.get('service') as string
  const date = formData.get('date') as string
  if (!service || !date) return { success: false, error: 'Service and date are required.' }

  const [row] = await db
    .insert(appointments)
    .values({ service, date, status: 'pending' })
    .returning({ id: appointments.id })
  invalidate(Tag.appointments({}))
  return { success: true, appointmentId: row.id }
}
```

**CreateAppointmentForm/fixtures.ts**:
```typescript
import type { State } from './state'

export const fixtures = {
  idle:       { status: 'idle' }                                                              satisfies State,
  submitting: { status: 'submitting' }                                                        satisfies State,
  error:      { status: 'error',   message: 'Something went wrong.' }                         satisfies State,
  success:    { status: 'success', redirectTo: '/appointments/detail?id=abc123' }              satisfies State,
}
```

**CreateAppointmentForm/CreateAppointmentForm.tsx**:
```tsx
'use client'
import { route } from '../../contract'
import { scene } from './scene'
import { createAppointment } from './actions'
import { useFormValues } from '@/lib/hooks/useFormValues'
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
import type { State } from './state'

export function CreateAppointmentForm({ initialState }: { initialState: State }) {
  const [state, send, reset] = scene.useScene(initialState)
  const form = useFormValues()
  useRedirectOnSuccess(state, [reset, form.reset])

  const handleSubmit = async (formData: FormData) => {
    form.capture(formData)
    send({ type: 'SUBMIT' })
    const result = await createAppointment(formData)
    if (result.success) {
      send({ type: 'SUCCESS', redirectTo: route.exits.detail({ id: result.appointmentId }) })
    } else {
      send({ type: 'ERROR', message: result.error })
    }
  }

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="service">Service</label>
            <input id="service" name="service" defaultValue={form.values.service} placeholder="Service" />
          </div>
          <div className="space-y-2">
            <label htmlFor="date">Date</label>
            <input id="date" name="date" type="date" defaultValue={form.values.date} />
          </div>
          {state.status === 'error' && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <button type="submit" disabled={state.status === 'submitting'}>
            {state.status === 'submitting' ? 'Booking…' : 'Book appointment'}
          </button>
        </form>
      )
    case 'success':
      return (
        <form className="space-y-4 opacity-60" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <label htmlFor="service">Service</label>
            <input id="service" name="service" defaultValue={form.values.service} disabled />
          </div>
          <div className="space-y-2">
            <label htmlFor="date">Date</label>
            <input id="date" name="date" type="date" defaultValue={form.values.date} disabled />
          </div>
          <p className="text-sm text-muted-foreground">Redirecting…</p>
          <button type="button" disabled>Redirecting…</button>
        </form>
      )
  }
}
```

**page.tsx**:
```tsx
// app/appointments/new/page.tsx
import { Shell } from '@/lib/shell'
import { route } from './contract'
import { CreateAppointmentForm } from './_components/CreateAppointmentForm/CreateAppointmentForm'
import { fixtures } from './_components/CreateAppointmentForm/fixtures'

export default async function NewAppointmentPage() {
  return (
    <Shell.FullPage title="New Appointment">
      <CreateAppointmentForm initialState={fixtures.idle} />
    </Shell.FullPage>
  )
}
```

---

## Server actions and cached queries with Effect

Every server action mutation, read action, and `'use cache'` query runs inside an Effect program. Two boundary helpers — `runAction` and `runQuery` — convert Effects back into the plain `Promise<...>` shapes Next.js expects. Business logic stays composable; cross-cutting concerns (timeout, retry, observability, typed errors) live at the boundary.

### Why Effect

- **Typed errors as values.** Every action lists exactly which errors it can fail with (`Effect.Effect<A, ValidationFailed | NotFound | DbError>`). Adding a new error path is a compile-time event.
- **Pipe composition.** Cross-cutting concerns (`Effect.timeoutFail`, `Effect.retry`, `Effect.withSpan`) plug onto the boundary without touching business logic.
- **Free parallelism.** `Effect.all({ a, b, c }, { concurrency: 'unbounded' })` is the structured-concurrency equivalent of `Promise.all` — same perf, typed errors flow through.
- **Free observability.** Every action and query gets an OTel span via `Effect.withSpan(...)`, persisted to the `trace_span` table.

### The infrastructure (`lib/effect/`)

| File | Role |
|---|---|
| `errors.ts` | Tagged error classes: `Forbidden`, `Unauthenticated`, `NotFound`, `ValidationFailed`, `RateLimited`, `Conflict`, `ExternalServiceError`, `DbError`, `Timeout`, `SubscriptionInactive`. All extend `Data.TaggedError(...)`. |
| `db.ts` | Drizzle bridge. `dbE.try(fn)`, `dbE.findFirst(query)`, `dbE.run(query)`, `dbE.transaction(asyncCallback)`. Maps thrown errors to `DbError`. |
| `cache.ts` | `cacheE.invalidate(Tag.X(...))` and `cacheE.softInvalidate(...)` — Effect wrappers over the cache-registry helpers, composable via `Effect.tap`. |
| `auth.ts` | `requireSessionE()`, `requireAdminE()`, `requireWorkspaceRoleE(workspaceId, role)`. Map throw-based guards into typed `Forbidden` / `Unauthenticated`. The admin/workspace adapters fail closed until their guards land (see the file's comments). |
| `validate.ts` | `validate(zodSchema, raw)` — runs `schema.parse` inside Effect, maps `ZodError` to `ValidationFailed` with `fieldErrors`. |
| `parse.ts` | `parseIdE(raw, label)` — string → positive int, failing with `ValidationFailed` (never a thrown defect). |
| `tracing.ts` | `TracingLayer` — `@effect/opentelemetry` NodeSdk wired to `DbSpanExporter` (spans persist to `trace_span`). Provided automatically by `runAction`/`runQuery`. |
| `db-span-exporter.ts` | Batched SpanExporter writing to Postgres. Denormalizes `workspaceId`/`userId` from span attributes. Never breaks the app on failure. |
| `run-action.ts` | Server-action boundary. Returns `Promise<ActionResult<A>>` (flat `{ success: true, ...data } \| { success: false, error, kind }`). Bakes default 30s timeout + span when `actionName` is supplied; attributes the span to the session user and the AI `actor` marker. |
| `run-query.ts` | Cached-query boundary. Returns `Promise<A>`, throws on failure (matches Drizzle/Promise semantics). Bakes default 30s timeout + span when `queryName` is supplied. |
| `boundary.ts` | `mapResult(result, copy)` — collapses the per-action `switch (result.kind)` boilerplate into one copy object with per-kind overrides and a `custom` hook. |
| `traced.ts` | `tracedAction(name, attributes, fn)` — span for plain-async actions not yet on the Effect boundary. Same trace stream, zero rewrite. |
| `actor-context.ts` | `withActor('assistant', fn)` / `currentActor()` — AsyncLocalStorage marker distinguishing AI-initiated work in spans. |
| `markers.ts` | `Markers` sentinel-string registry + `isMarker` for boundary copy routing. Ships empty; apps add entries. |

### Style: pure pipe + `Effect.Do`

**No `Effect.gen`, no generators.** Every Effect program is a `pipe(Effect.Do, Effect.bind('x', ...), Effect.tap(...), Effect.flatMap(...), Effect.map(...))` chain.

- `Effect.bind('name', (acc) => effect)` — run an Effect, attach the result to the record under `name`.
- `Effect.let('name', (acc) => value)` — synchronous derived value.
- `Effect.tap((acc) => effect)` — side-effect (auth gate, cache invalidate, log); record stays unchanged.
- `Effect.flatMap((acc) => effect)` — branching. Use this for `T | undefined` narrowing (`filterOrFail` does NOT narrow).
- `Effect.filterOrFail((acc) => boolean, (acc) => error)` — invariants that don't need narrowing.
- `Effect.map((acc) => value)` — final projection.

### The mutation pattern (server actions)

```typescript
// app/people/_components/RenamePersonDialog/actions.ts
'use server'

import { Effect, pipe } from 'effect'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { persons } from '@/db/schema'
import { runAction } from '@/lib/effect/run-action'
import { dbE } from '@/lib/effect/db'
import { cacheE } from '@/lib/effect/cache'
import { requireSessionE } from '@/lib/effect/auth'
import { validate } from '@/lib/effect/validate'
import { parseIdE } from '@/lib/effect/parse'
import { NotFound } from '@/lib/effect/errors'
import { Tag } from '@/lib/person/tags'

const Input = z.object({
  personId: z.string(),
  name:     z.string().min(1, 'Name is required'),
})

// Pure-pipe business logic.
const renamePerson = (raw: unknown) => pipe(
  Effect.Do,
  Effect.bind('input',    () => validate(Input, raw)),
  Effect.tap (()          => requireSessionE()),
  Effect.bind('personId', ({ input }) => parseIdE(input.personId, 'personId')),

  Effect.bind('person', ({ personId }) =>
    dbE.findFirst(db.select({ id: persons.id }).from(persons).where(eq(persons.id, personId)).limit(1))),
  // T | undefined narrowing — use Effect.flatMap, NOT filterOrFail.
  Effect.flatMap((acc) => acc.person == null
    ? Effect.fail(new NotFound({ entity: 'person', id: acc.personId }))
    : Effect.succeed(acc)),

  Effect.tap(({ personId, input }) =>
    dbE.run(db.update(persons).set({ name: input.name }).where(eq(persons.id, personId)))),
  Effect.tap(({ personId }) => cacheE.invalidate(Tag.person({ id: String(personId) }))),
  Effect.map(({ personId }) => ({ personId })),
)

// Boundary — defaults bake in a 30s timeout and a span when `actionName` is set.
export async function renamePersonAction(input: { personId: string; name: string }) {
  return runAction(renamePerson(input), {
    actionName: 'renamePersonAction',
    attributes: { personId: input.personId },
  })
}
```

For a live, minimal example in this repo, see `app/dashboard/_components/LogoutButton/actions.ts`.

### The cached-query pattern (`'use cache'`)

`'use cache'` requires a plain async function. We satisfy that at the boundary; Effect lives inside the body via `runQuery(pipe(...))`.

```typescript
// lib/person/queries.ts
export async function fetchRecentPersons(): Promise<PersonRow[]> {
  'use cache'                                              // ← Next sees a plain async fn
  tagWith(Tag.persons({}))
  withCacheProfile('warm')

  return runQuery(pipe(
    dbE.run(db.select().from(persons).orderBy(desc(persons.createdAt)).limit(10)),
    Effect.map((rows) => rows.map(toPersonRow)),
  ), { queryName: 'fetchRecentPersons' })
}
```

The cache machinery (`'use cache'`, `tagWith`, `withCacheProfile`) runs first and registers the cache key + tags + TTL. `runQuery(pipe(...))` then collapses the Effect chain into the resolved Promise that Next stores under that key. Cache hits bypass the body entirely — no Effect runs, no span is emitted.

### Boundary error mapping with `mapResult`

`runAction` returns `{ success: false, error, kind }` where `kind` is the error's `_tag`. Instead of a 15–25-line `switch (result.kind)` per action, route copy with `mapResult`:

```typescript
const result = await runAction(renamePerson(input), { actionName: 'renamePersonAction' })
return mapResult(result, {
  fallback: 'Could not rename this person.',
  notFound: 'This person no longer exists.',
  custom:   (r) => (r.kind === 'ValidationFailed' && r.fieldErrors?.name?.length)
    ? 'Name is required.'
    : null,
})
```

Default routing: every kind → `fallback`. Override per kind (`validation`, `notFound`, `forbidden`, `conflict`, `rateLimit`, `timeout`, `external`, `db`, `subscriptionInactive`); `custom` runs first and wins when it returns a string. `rateLimit` omitted passes the limiter's own message through.

### The boundary defaults

Both `runAction` and `runQuery` bake in two defaults when you supply an `actionName`/`queryName`:

| Default | Override |
|---|---|
| `Effect.timeoutFail({ duration: '30 seconds', onTimeout: () => new Timeout(...) })` | Pass `timeout: '5 seconds'` (or any `Duration.DurationInput`), or `null` to disable. |
| `Effect.withSpan(actionName, { attributes })` | Pass `attributes: { workspaceId, ... }` to enrich. Inner `Effect.withSpan(...)` calls nest under it. |

Inner per-step `timeoutFail` always wins over the outer default (an inner 5s fires before the outer 30s).

### Hard rules

| Rule | Why |
|---|---|
| No `Effect.gen`, ever | Pure pipe + `Effect.Do` everywhere. Single paradigm across the codebase. |
| No `Effect.Layer` except `TracingLayer` | Single Drizzle pool, no DI graph to inject. |
| `dbE.transaction` callback stays plain async | Drizzle's API is callback-style; throw inside to roll back. Typed errors do NOT propagate through the transaction body — do read-checks before. |
| Result shape is FLAT | `runAction` returns `{ success: true, ...data }` (spread), not `{ success: true, data }` (nested). Sections read success-branch fields directly. |
| `filterOrFail` does NOT narrow | For `T \| undefined` → `T`, use `Effect.flatMap` with explicit null check. |
| Untyped catches are forbidden | `catch: () => ({})` pollutes the error union with `{}`. Always map to a typed error. |
| Cached queries use `runQuery`, not `runAction` | `'use cache'` consumers expect plain `Promise<A>` that throws on failure, not the discriminated envelope. |
| No client-cancel propagation | Next 16 doesn't expose request `AbortSignal` to server actions. `Effect.timeout` is the only ceiling available. |

### Sentinel markers for specific error copy

When a `Conflict` needs to map to a specific user-facing string (several distinct conflict reasons behind one `_tag`), register a sentinel in `lib/effect/markers.ts` and route at the boundary — never invent file-local marker constants:

```typescript
// lib/effect/markers.ts
export const Markers = {
  orderLocked: 'order_locked',
} as const

// inside the pipe:
Effect.fail(new ConflictError({ message: Markers.orderLocked }))

// at the boundary:
return mapResult(result, {
  fallback: 'Could not update the order.',
  custom:   (r) => isMarker(r.error, Markers.orderLocked) ? 'This order is locked.' : null,
})
```
