---
title: Sections
order: 4
category: Core
---

# Section — Component State

## What is a section

A **primitive** is a stateless UI element: `<Button>`, `<Input>`, `<Badge>`, `<Spinner>`. It has no domain meaning, no loading states, no mutations. Primitives live in `components/ui/`.

Everything else is a **section**. If a component touches data, represents a domain concept, has more than one meaningful thing to show, or can be in an error state — it is a section. Sections live in a section folder named after the component, with a `state.ts` that defines the exhaustive state type.

## File structure

Only create the files a section actually needs:

```
ComponentName/
  ├── state.ts            — exhaustive State discriminated union
  ├── fixtures.ts         — one example per state
  ├── ComponentName.tsx   — switch on state.status, nothing else
  ├── deps.ts             — injectable contract          (server section that fetches)
  ├── query.ts            — server fn returning State    (server section that fetches)
  ├── tags.ts             — typed cache tag registry     (server section that fetches)
  ├── transition.ts       — (state, event) → state       (client section)
  ├── scene.ts            — createScene(transition)      (client section)
  ├── useXxxLoader.ts     — fetch hook                   (client section that fetches via server action)
  └── actions.ts          — 'use server' mutations + loaders
```

### File responsibilities

| File | Purpose |
|------|---------|
| `entry.ts` | Defines `href(params)` and `parse(ctx)` for entering this route |
| `contract.ts` | Calls `createRoute({ entry, exits })` — the single source of truth for this route's navigation |
| `page.tsx` | Server component: parses URL via `route.entry.parse()`, composes shells and sections. Never fetches — sections own their data |
| `state.ts` | Exhaustive discriminated union `State` type + `Event` type |
| `transition.ts` | Pure function `(state, event) => state` — no side effects |
| `scene.ts` | `createScene(transition)` — provides `scene.useScene(initialState)` returning `[state, send, reset]` |
| `fixtures.ts` | One concrete `State` example per status variant — used in Suspense fallbacks and tests |
| `query.ts` | Server function returning `Promise<State>` — applies cache tags via `tagWith()` |
| `tags.ts` | `createTagRegistry(...)` scoped to this domain |
| `actions.ts` | `'use server'` — mutations that invalidate cache and return domain results; data loaders for client sections. Never calls `redirect()` and never imports route contracts or entry points — actions return domain data (e.g., `{ success: true, isNew: boolean }`), and the section maps results to routes using its own contract's exits |
| `useXxxLoader.ts` | Custom hook that calls a server action loader and dispatches result to the section |
| `ComponentName.tsx` | Renders: `switch (state.status)` only — no business logic |
| `ComponentName.stories.tsx` | Storybook stories — one named export per `fixtures` key, passes fixture as `initialState` |

## The hooks rule

`useState`, `useEffect`, `useReducer`, and all React hooks live **only** in custom hooks — never directly in component functions. Components call hooks; they do not contain hook logic.

```tsx
// ❌ hooks in component
export function BookingsList({ initialState }: { initialState: State }) {
  const [state, send, reset] = scene.useScene(initialState)
  useEffect(() => { /* fetch logic */ }, [state.id]) // ← wrong: hook logic in component
  ...
}

// ✅ hooks extracted
export function BookingsList({ initialState }: { initialState: State }) {
  const [state, send, reset] = scene.useScene(initialState)
  useBookingLoader(state, send) // ← all side-effect logic lives in the hook
  ...
}
```

## The redirect-reset pattern

`useScene` returns `[state, send, reset]`. The `reset()` function restores the scene to its `initialState`.

Sections that redirect after success **must** call `reset()` after `router.push`. The Next.js Router Cache can serve stale rendered output — if a section is cached in its `success` state, returning to that page will replay the redirect and cause an infinite loop.

`useRedirectOnSuccess(state, reset)` handles this automatically:

```tsx
import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'

export function LoginForm({ initialState }: { initialState: State }) {
  const [state, send, reset] = scene.useScene(initialState)
  useRedirectOnSuccess(state, reset) // resets to idle after router.push

  // ...
}
```

If you redirect manually instead of using the hook, call `reset()` after `router.push`:

```tsx
router.push(route.exits.next({ id: result.id }))
reset()
```

## The client boundary rule

Default to server. Add `'use client'` only at the smallest subtree that requires interactivity. Push the boundary as far toward the leaves as possible. A component that renders client children does not need to be client itself.

```
page.tsx (server)
  └── Shell.Modal (client — needs open/close state)
        └── BookingDetail (server — just renders data, no interactivity)  ← stays server
```

---

## Six section types

### Type 1: Server component without fetch

No deps, no query, no tags. Receives props, derives state inline.

```
BookingStatusBadge/
  ├── state.ts
  ├── BookingStatusBadge.tsx
  └── fixtures.ts
```

**state.ts**:
```typescript
export type State =
  | { status: 'confirmed' }
  | { status: 'pending' }
  | { status: 'cancelled' }
```

**fixtures.ts**:
```typescript
import type { State } from './state'

export const fixtures = {
  confirmed: { status: 'confirmed' } satisfies State,
  pending:   { status: 'pending'   } satisfies State,
  cancelled: { status: 'cancelled' } satisfies State,
}
```

**BookingStatusBadge.tsx**:
```tsx
import type { State } from './state'

export function BookingStatusBadge({ state }: { state: State }) {
  switch (state.status) {
    case 'confirmed': return <span className="badge badge-green">Confirmed</span>
    case 'pending':   return <span className="badge badge-yellow">Pending</span>
    case 'cancelled': return <span className="badge badge-red">Cancelled</span>
  }
}
```

---

### Type 2: Server component with fetch

Async server component. Uses `deps.ts` injection pattern so the query can be tested with a stub.

```
BookingsList/
  ├── state.ts
  ├── deps.ts
  ├── BookingsList.tsx
  ├── fixtures.ts
  ├── query.ts
  └── tags.ts
```

**state.ts**:
```typescript
export type Booking = {
  id:        string
  clientName: string
  date:      string
  status:    'confirmed' | 'pending' | 'cancelled'
}

export type State =
  | { status: 'empty' }
  | { status: 'loaded'; bookings: Booking[] }
```

**tags.ts**:
```typescript
import { createTagRegistry } from '@/lib/cache-registry'

export const { Tag, tagWith, invalidate, softInvalidate } = createTagRegistry({
  bookings: (_: Record<string, never>) => ['bookings'] as const,
  booking:  (p: { id: string })        => ['bookings', `booking:${p.id}`] as const,
})
```

**query.ts**:
```typescript
import { db } from '@/db/drizzle'
import { Tag, tagWith } from './tags'
import type { State } from './state'

export async function getBookingsListState(): Promise<State> {
  'use cache'
  tagWith(Tag.bookings({}))

  const rows = await db.query.bookings.findMany({ orderBy: (t, { desc }) => [desc(t.date)] })
  if (rows.length === 0) return { status: 'empty' }
  return { status: 'loaded', bookings: rows }
}
```

**deps.ts**:
```typescript
import { getBookingsListState } from './query'

export type Deps = {
  getState: () => Promise<import('./state').State>
}

export const defaultDeps: Deps = {
  getState: getBookingsListState,
}
```

**fixtures.ts**:
```typescript
import type { State } from './state'

export const fixtures = {
  empty: { status: 'empty' } satisfies State,
  loaded: {
    status: 'loaded',
    bookings: [
      { id: '1', clientName: 'Alice', date: '2026-04-01', status: 'confirmed' },
      { id: '2', clientName: 'Bob',   date: '2026-04-02', status: 'pending'   },
    ],
  } satisfies State,
}
```

**BookingsList.tsx**:
```tsx
import { defaultDeps, type Deps } from './deps'
import type { State } from './state'

type Props = { deps?: Deps }

export async function BookingsList({ deps = defaultDeps }: Props) {
  const state = await deps.getState()
  return <BookingsListView state={state} />
}

function BookingsListView({ state }: { state: State }) {
  switch (state.status) {
    case 'empty':
      return <p className="text-muted-foreground">No bookings yet.</p>
    case 'loaded':
      return (
        <ul>
          {state.bookings.map((b) => (
            <li key={b.id}>{b.clientName} — {b.date} — {b.status}</li>
          ))}
        </ul>
      )
  }
}
```

**In page.tsx** — wrap in Suspense with a fixture fallback:

```tsx
import { Suspense } from 'react'
import { BookingsList } from './_components/BookingsList/BookingsList'
import { fixtures } from './_components/BookingsList/fixtures'
import { BookingsListView } from './_components/BookingsList/BookingsList'

export default async function Page() {
  return (
    <Shell.FullPage title="Bookings">
      <Suspense fallback={<BookingsListView state={fixtures.empty} />}>
        <BookingsList />
      </Suspense>
    </Shell.FullPage>
  )
}
```

---

### Type 3: Server component with server action

Derives state from props, has a mutation form. No client state needed.

```
CancelBookingForm/
  ├── state.ts
  ├── CancelBookingForm.tsx
  ├── fixtures.ts
  └── actions.ts
```

**state.ts**:
```typescript
export type State =
  | { status: 'idle';     id: string; clientName: string }
  | { status: 'success';  id: string }
```

**actions.ts**:
```typescript
'use server'
import { db } from '@/db/drizzle'
import { eq } from 'drizzle-orm'
import { bookings } from '@/db/schema'
import { invalidate } from '../tags'
import { Tag } from '../tags'

export async function cancelBooking(id: string) {
  await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, id))
  invalidate(Tag.booking({ id }))
}
```

**CancelBookingForm.tsx**:
```tsx
import { cancelBooking } from './actions'
import type { State } from './state'

export function CancelBookingForm({ state }: { state: State }) {
  switch (state.status) {
    case 'idle':
      return (
        <form action={cancelBooking.bind(null, state.id)}>
          <p>Cancel booking for {state.clientName}?</p>
          <button type="submit">Confirm cancellation</button>
        </form>
      )
    case 'success':
      return <p>Booking {state.id} cancelled.</p>
  }
}
```

---

### Type 4: Client section without server action

State machine with local transitions only. Navigates via `route.exits` when done.

```
ServicePicker/
  ├── state.ts
  ├── transition.ts
  ├── scene.ts
  ├── ServicePicker.tsx
  └── fixtures.ts
```

**state.ts**:
```typescript
export type Service = { id: string; name: string; durationMinutes: number }

export type State =
  | { status: 'idle';     services: Service[] }
  | { status: 'selected'; services: Service[]; selectedId: string }

export type Event =
  | { type: 'SELECT';  id: string }
  | { type: 'CLEAR' }
```

**transition.ts**:
```typescript
import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (event.type) {
    case 'SELECT':
      return { ...state, status: 'selected', selectedId: event.id }
    case 'CLEAR':
      return { ...state, status: 'idle' }
    default:
      return state
  }
}
```

**scene.ts**:
```typescript
import { createScene } from '@/lib/scene'
import { transition } from './transition'

export const scene = createScene(transition)
```

**ServicePicker.tsx**:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { route } from '../../contract'
import { scene } from './scene'
import type { State } from './state'

export function ServicePicker({ initialState }: { initialState: State }) {
  const [state, send, reset] = scene.useScene(initialState)
  const router = useRouter()

  switch (state.status) {
    case 'idle':
      return (
        <ul>
          {state.services.map((s) => (
            <li key={s.id}>
              <button onClick={() => send({ type: 'SELECT', id: s.id })}>{s.name}</button>
            </li>
          ))}
        </ul>
      )
    case 'selected':
      return (
        <div>
          <p>Selected: {state.services.find((s) => s.id === state.selectedId)?.name}</p>
          <button onClick={() => send({ type: 'CLEAR' })}>Change</button>
          <button onClick={() => router.push(route.exits.confirm({ serviceId: state.selectedId }))}>
            Continue
          </button>
        </div>
      )
  }
}
```

---

### Type 5: Client section with server action

State machine plus a mutation. `'use client'`, calls a server action, dispatches the result.

**If the section contains a form**, add `useFormValues` to capture input values across React 19's form reset. See [`forms.md`](forms.md) for the full pattern. The three-hook standard:

```tsx
const [state, send, reset] = scene.useScene(initialState)   // status lifecycle
const form = useFormValues()                                  // input values + errors
useRedirectOnSuccess(state, reset)                            // navigation after success
```

```
ConfirmBookingForm/
  ├── state.ts
  ├── transition.ts
  ├── scene.ts
  ├── ConfirmBookingForm.tsx
  ├── fixtures.ts
  └── actions.ts
```

**state.ts**:
```typescript
export type State =
  | { status: 'idle';        serviceId: string; date: string }
  | { status: 'submitting';  serviceId: string; date: string }
  | { status: 'error';       serviceId: string; date: string; message: string }
  | { status: 'success';     bookingId: string }

export type Event =
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; bookingId: string }
  | { type: 'ERROR';   message: string }
  | { type: 'RETRY' }
```

**transition.ts**:
```typescript
import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (event.type) {
    case 'SUBMIT':
      if (state.status !== 'idle') return state
      return { ...state, status: 'submitting' }
    case 'SUCCESS':
      return { status: 'success', bookingId: event.bookingId }
    case 'ERROR':
      if (state.status !== 'submitting') return state
      return { ...state, status: 'error', message: event.message }
    case 'RETRY':
      if (state.status !== 'error') return state
      return { ...state, status: 'idle' }
    default:
      return state
  }
}
```

**scene.ts**:
```typescript
import { createScene } from '@/lib/scene'
import { transition } from './transition'

export const scene = createScene(transition)
```

**actions.ts**:
```typescript
'use server'
import { db } from '@/db/drizzle'
import { bookings } from '@/db/schema'
import { invalidate } from '../tags'
import { Tag } from '../tags'

export async function createBooking(
  serviceId: string,
  date: string,
): Promise<{ bookingId: string }> {
  const [row] = await db.insert(bookings).values({ serviceId, date }).returning({ id: bookings.id })
  invalidate(Tag.bookings({}))
  return { bookingId: row.id }
}
```

**ConfirmBookingForm.tsx**:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { route } from '../../contract'
import { scene } from './scene'
import { createBooking } from './actions'
import type { State } from './state'

export function ConfirmBookingForm({ initialState }: { initialState: State }) {
  const [state, send, reset] = scene.useScene(initialState)
  const router = useRouter()

  switch (state.status) {
    case 'idle':
      return (
        <div>
          <p>Service: {state.serviceId} on {state.date}</p>
          <button
            onClick={async () => {
              send({ type: 'SUBMIT' })
              try {
                const result = await createBooking(state.serviceId, state.date)
                send({ type: 'SUCCESS', bookingId: result.bookingId })
                router.push(route.exits.detail({ id: result.bookingId }))
              } catch (e) {
                send({ type: 'ERROR', message: (e as Error).message })
              }
            }}
          >
            Confirm
          </button>
        </div>
      )
    case 'submitting':
      return <p>Booking…</p>
    case 'error':
      return (
        <div>
          <p>{state.message}</p>
          <button onClick={() => send({ type: 'RETRY' })}>Try again</button>
        </div>
      )
    case 'success':
      return <p>Booking {state.bookingId} confirmed.</p>
  }
}
```

---

### Type 6: Client section with server action loader

Use this pattern when a component opens with client-controlled state (e.g. a selected ID set by a parent) and needs to fetch its own data. The server action is used as a **data loader**, not a mutation.

```
NoteDetail/
  ├── state.ts
  ├── transition.ts
  ├── scene.ts
  ├── fixtures.ts
  ├── useNoteLoader.ts
  ├── NoteDetail.tsx
  └── actions.ts
```

**state.ts**:
```typescript
export type State =
  | { status: 'loading'; id: string }
  | { status: 'loaded';  id: string; content: string; createdAt: string }
  | { status: 'error';   id: string; message: string }

export type Event =
  | { type: 'LOADED'; content: string; createdAt: string }
  | { type: 'ERROR';  message: string }
  | { type: 'RETRY' }
```

**transition.ts**:
```typescript
import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (event.type) {
    case 'LOADED':
      if (state.status !== 'loading') return state
      return { status: 'loaded', id: state.id, content: event.content, createdAt: event.createdAt }
    case 'ERROR':
      if (state.status !== 'loading') return state
      return { status: 'error', id: state.id, message: event.message }
    case 'RETRY':
      if (state.status !== 'error') return state
      return { status: 'loading', id: state.id }
    default:
      return state
  }
}
```

**scene.ts**:
```typescript
import { createScene } from '@/lib/scene'
import { transition } from './transition'

export const scene = createScene(transition)
```

**actions.ts** (server action used as a loader, not a mutation):
```typescript
'use server'
import { db } from '@/db/drizzle'

export async function getNoteState(
  id: string,
): Promise<{ content: string; createdAt: string } | null> {
  return db.query.notes.findFirst({ where: (t, { eq }) => eq(t.id, id) }) ?? null
}
```

**useNoteLoader.ts**:
```typescript
import { useEffect } from 'react'
import type { State, Event } from './state'
import type { Send } from '@/lib/scene'
import { getNoteState } from './actions'

export function useNoteLoader(state: State, send: Send<Event>) {
  useEffect(() => {
    if (state.status !== 'loading') return
    let cancelled = false
    getNoteState(state.id).then(
      (note) => {
        if (cancelled) return
        if (note) send({ type: 'LOADED', content: note.content, createdAt: note.createdAt })
        else      send({ type: 'ERROR', message: 'Note not found' })
      },
      (e) => { if (!cancelled) send({ type: 'ERROR', message: (e as Error).message }) },
    )
    return () => { cancelled = true }
  }, [state.status === 'loading' ? state.id : null]) // eslint-disable-line react-hooks/exhaustive-deps
}
```

**NoteDetail.tsx**:
```tsx
'use client'
import { scene } from './scene'
import { useNoteLoader } from './useNoteLoader'
import type { State } from './state'

export function NoteDetail({ initialState }: { initialState: State }) {
  const [state, send, reset] = scene.useScene(initialState)
  useNoteLoader(state, send)

  switch (state.status) {
    case 'loading':
      return <Spinner />
    case 'loaded':
      return (
        <div>
          <p>{state.content}</p>
          <time>{state.createdAt}</time>
        </div>
      )
    case 'error':
      return (
        <div>
          <p>{state.message}</p>
          <button onClick={() => send({ type: 'RETRY' })}>Retry</button>
        </div>
      )
  }
}
```

Wired from a parent client section:

```tsx
// Parent dispatches SELECT → NoteDetail receives initialState with status: 'loading'
<NoteDetail initialState={{ status: 'loading', id: state.selectedId }} />
```
