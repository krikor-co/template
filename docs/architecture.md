# Architecture

Read this document before writing any feature. It describes four parts that compose into one system: **RouteRegistry**, **Shell**, **Section**, and **CacheRegistry**. Every page, component, and data-fetching pattern in this codebase follows the rules here. There are no exceptions.

---

## Pages

A page's job is minimal: parse the URL, fetch data, and compose Shells and Sections. No logic, no state, no business decisions.

Every page is one of two types:

### Single-section page — a step in a flow

One Shell, one Section. The page IS the step. Part of a routed flow navigated via RouteRegistry exits.

Use this when the page demands full attention: a form, a confirmation, an onboarding step, a detail view.

```tsx
// app/bookings/new/page.tsx
export default async function NewBookingPage({ searchParams }: Props) {
  const entry = route.entry.parse(ctx)
  return (
    <Shell.FullPage title="New Booking">
      <CreateBookingSection initialState={await getCreateBookingState(entry)} />
    </Shell.FullPage>
  )
}
```

### Multi-section page — an overview

Multiple Shells each wrapping an independent Section. Sections stream independently via their own Suspense boundaries. Each has its own data, error boundary, and refresh.

Use this when the page aggregates several independent concerns: a dashboard, a profile, a settings page.

```tsx
// app/dashboard/page.tsx
export default async function DashboardPage() {
  return (
    <main className="space-y-6 p-6">
      <Shell.Card title="Upcoming Bookings" onRefresh={...}>
        <Suspense fallback={<BookingsSection initialState={fixtures.loading} />}>
          <BookingsSection deps={{ getState: () => getBookingsState() }} />
        </Suspense>
      </Shell.Card>

      <Shell.Card title="Revenue">
        <Suspense fallback={<RevenueSection initialState={fixtures.loading} />}>
          <RevenueSection deps={{ getState: () => getRevenueState() }} />
        </Suspense>
      </Shell.Card>
    </main>
  )
}
```

### The strict hierarchy

```
Page
  └── Shell           (FullPage · Card · Modal · Drawer)
        └── Section   (the feature: state machine, data, actions)
              └── Primitives   (Button · Input · Badge · …)
```

- **Pages** never contain Primitives directly — always through a Shell and Section
- **Sections** never reference their Shell — the Shell is always the caller's concern
- **Primitives** have no data, no state, no domain logic — if it fetches, it's a Section

---

## 2. The System

```
┌─────────────────────────────────────────────────────────────┐
│  RouteRegistry                                               │
│  Organizes navigation. Each URL is one focused route.       │
│  State travels via the URL. No central orchestrator.        │
├─────────────────────────────────────────────────────────────┤
│  Shell                                                       │
│  Organizes presentation context. Provides container         │
│  queries, step transitions, error boundaries, and           │
│  global actions. Sections know nothing about their Shell.   │
├─────────────────────────────────────────────────────────────┤
│  Section                                                     │
│  Organizes component state. Every non-primitive component   │
│  is an independent block with an exhaustive state type.     │
├─────────────────────────────────────────────────────────────┤
│  CacheRegistry                                              │
│  Organizes data invalidation. Tags are typed, hierarchical, │
│  and defined once. Queries apply them. Actions invalidate.  │
└─────────────────────────────────────────────────────────────┘
```

Each part answers one question:

- **RouteRegistry**: where does the user go next, and what data does the next page need?
- **Shell**: what presentation context does this Section live in?
- **Section**: what can this component show, and what can the user do from each state?
- **CacheRegistry**: when data changes, what cached entries are now stale?

### How they compose

```
URL
 │
 ▼
page.tsx  ← RouteRegistry: parses URL into typed params via route.entry.parse()
 │
 ▼
<Shell.Card title="Appointments">   ← Shell: presentation context + global affordances
  │
  ▼
  <AppointmentsList initialState={...} />   ← Section: state machine drives UI
    │
    ├── query.ts   ← fetches data, applies cache tags via tagWith()
    │
    └── actions.ts ← mutates data, invalidates cache, returns typed result (incl. redirectTo)
</Shell.Card>
```

---

## 3. Declarative Flows

> Design starts from the action vocabulary, not the UI. Before writing any component, enumerate what the user is allowed to DO in this context. Each action becomes a state machine event. The UI is a consequence of the state machine — a button exists because an event exists, not the other way around. There are no implicit affordances.

Instead of "a page with a delete button," design "a section where the user can DELETE." Model that as `{ type: 'DELETE', id }`. Then render the button as a consequence of the state machine allowing that event. If the state machine has no DELETE event, there is no delete button — not hidden, not disabled by a flag, simply absent.

This applies to every piece of interactive UI: navigation links, form submissions, confirmation dialogs, retry buttons. Each is the consequence of an event being reachable from the current state.

See `docs/declarative-flows.md` for the full design process guide.

---

## 4. Full File Map

For a typical CRUD flow:

```
app/bookings/
  list/
    entry.ts                    ← href to this route + Zod parse
    contract.ts                 ← createRoute: entry + exits
    page.tsx                    ← async server component, parses URL, wraps sections in shells
    _components/
      BookingsList/
        state.ts                ← discriminated union State type
        transition.ts           ← pure (state, event) → state   [client section only]
        scene.ts                ← createScene(transition)        [client section only]
        fixtures.ts             ← one example per state variant
        query.ts                ← getBookingsListState(): Promise<State>  [if fetches]
        tags.ts                 ← createTagRegistry(...)          [if fetches]
        actions.ts              ← 'use server' mutations + loaders [if mutates or client-fetches]
        useBookingsLoader.ts    ← fetch hook                      [if client section that fetches]
        BookingsList.tsx        ← switch on state.status, render only

  new/
    entry.ts
    contract.ts
    page.tsx
    _components/
      CreateBookingForm/
        ...

lib/
  booking/
    tags.ts                     ← shared tag registry for the booking domain (optional — can live in section)
    create-booking.ts
    update-booking.ts
    delete-booking.ts
    get-bookings.ts

components/
  ui/                           ← primitives: Button, Input, Badge, etc. No sections.

lib/
  shell.tsx                     ← Shell.FullPage, Shell.Card, Shell.Modal, Shell.Drawer
  scene.ts                      ← createScene
  route-registry.ts             ← createRoute
  cache-registry.ts             ← createTagRegistry
```

### File responsibilities

| File | Purpose |
|------|---------|
| `entry.ts` | Defines `href(params)` and `parse(ctx)` for entering this route |
| `contract.ts` | Calls `createRoute({ entry, exits })` — the single source of truth for this route's navigation |
| `page.tsx` | Async server component: parses URL via `route.entry.parse()`, fetches initial state, wraps sections in shells |
| `state.ts` | Exhaustive discriminated union `State` type + `Event` type |
| `transition.ts` | Pure function `(state, event) => state` — no side effects |
| `scene.ts` | `createScene(transition)` — provides `scene.useScene(initialState)` |
| `fixtures.ts` | One concrete `State` example per status variant — used in Suspense fallbacks and tests |
| `query.ts` | Server function returning `Promise<State>` — applies cache tags via `tagWith()` |
| `tags.ts` | `createTagRegistry(...)` scoped to this domain |
| `actions.ts` | `'use server'` — mutations that invalidate cache and return typed results; data loaders for client sections. Never calls `redirect()` — returns `redirectTo` for the section to navigate |
| `useXxxLoader.ts` | Custom hook that calls a server action loader and dispatches result to the section |
| `ComponentName.tsx` | Renders: `switch (state.status)` only — no business logic |
| `ComponentName.stories.tsx` | Storybook stories — one named export per `fixtures` key, passes fixture as `initialState` |

---

## 4b. Storybook

Storybook is configured in `.storybook/` and stories are co-located with their components.

### Story placement

| Layer | File location |
|-------|--------------|
| Section | `_components/[Name]/[Name].stories.tsx` |
| Shell | `lib/shell.stories.tsx` |
| Page (visual reconstruction) | `app/[route]/page.stories.tsx` |
| Primitive | `components/ui/[Name]/[Name].stories.tsx` |

Glob patterns registered in `.storybook/main.ts`:

```ts
stories: [
  '../app/**/*.stories.tsx',
  '../components/**/*.stories.tsx',
  '../lib/shell.stories.tsx',
]
```

### Section stories

One named export per `fixtures` key. Pass the fixture as `initialState`. Server actions are mocked automatically by `@storybook/nextjs` — no extra setup needed for `'use client'` components.

```tsx
// RegisterForm/RegisterForm.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { RegisterForm } from './RegisterForm'
import { fixtures } from './fixtures'

const meta: Meta<typeof RegisterForm> = {
  component: RegisterForm,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof RegisterForm>

export const Idle: Story       = { args: { initialState: fixtures.idle } }
export const Submitting: Story = { args: { initialState: fixtures.submitting } }
export const Error: Story      = { args: { initialState: fixtures.error } }
```

### Shell stories

Live in `lib/shell.stories.tsx`. One story per shell variant. Modal and Drawer pass `open` as `true` and a no-op `onClose` to show the open state.

### Page stories

Page stories reconstruct the visual layout using fixture data — they do **not** call the async page function (which requires cookies, DB, and guards). Import the Shell and Section directly and compose them with the fixture state you want to show.

```tsx
// app/auth/register/page.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { RegisterForm } from './_components/RegisterForm/RegisterForm'
import { fixtures } from './_components/RegisterForm/fixtures'

const meta: Meta = { title: 'Pages/Auth/Register' }
export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <RegisterForm initialState={fixtures.idle} />
      </div>
    </div>
  ),
}
```

### Primitive stories

Co-located in `components/ui/[Name]/[Name].stories.tsx`. Standard args pattern — no state machine, just prop variants.

### Running Storybook

```bash
npm run storybook        # dev server at localhost:6006
npm run build-storybook  # static export
```

---

## 5. RouteRegistry — Navigation

Every URL in the app has an `entry.ts` and a `contract.ts`. These two files are the complete definition of a route's navigation contract. Never write a raw URL string anywhere else.

### entry.ts

Defines how to enter this route: how to build the URL and how to parse it back into typed params.

```typescript
// app/bookings/list/entry.ts
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

const schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params) => `/bookings?page=${p.page}`,
  parse: (ctx: ParseContext) => schema.parse(ctx.searchParams),
}
```

### contract.ts

Wires `entry` together with `exits` — the routes this page can navigate to.

```typescript
// app/bookings/list/contract.ts
import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as newEntry } from '../new/entry'

export const route = createRoute({
  entry,
  exits: {
    new:    (p: Record<string, never>) => newEntry.href({ ...p }),
    detail: (p: { id: string }) => `/bookings/${p.id}`,
  },
})
```

### Usage in components

```typescript
import { route } from './contract'

// In a Link (no async work):
<Link href={route.exits.new({})}>New booking</Link>

// In a client component after async work:
router.push(route.exits.detail({ id: booking.id }))

// In a server action or server component:
redirect(route.exits.detail({ id: booking.id }))

// In page.tsx to parse the URL:
const params = route.entry.parse(ctx)
```

### Rules

- Never write raw URL strings in `href`, `router.push`, or `redirect`.
- Always use `route.exits.*()` or `route.entry.href()`.
- `entry.ts` never imports a neighbor route's `contract.ts` or `page.tsx` — only its own schema.
- `contract.ts` imports only neighbor `entry.ts` files — never their contracts or pages.
- One `contract.ts` per route — it is the single source of truth for that route's navigation.
- **Actions and queries never call `redirect()`** — they return a typed result (e.g. `{ success: true; redirectTo: string }`) and the section is responsible for orchestrating the navigation. This keeps timing, animation, and sequencing decisions in the component layer where they belong.

---

## 6. Section — Component State

### What is a section

A **primitive** is a stateless UI element: `<Button>`, `<Input>`, `<Badge>`, `<Spinner>`. It has no domain meaning, no loading states, no mutations. Primitives live in `components/ui/`.

Everything else is a **section**. If a component touches data, represents a domain concept, has more than one meaningful thing to show, or can be in an error state — it is a section. Sections live in a section folder named after the component, with a `state.ts` that defines the exhaustive state type.

### File structure

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

### The hooks rule

`useState`, `useEffect`, `useReducer`, and all React hooks live **only** in custom hooks — never directly in component functions. Components call hooks; they do not contain hook logic.

```tsx
// ❌ hooks in component
export function BookingsList({ initialState }: { initialState: State }) {
  const [state, send] = scene.useScene(initialState)
  useEffect(() => { /* fetch logic */ }, [state.id]) // ← wrong: hook logic in component
  ...
}

// ✅ hooks extracted
export function BookingsList({ initialState }: { initialState: State }) {
  const [state, send] = scene.useScene(initialState)
  useBookingLoader(state, send) // ← all side-effect logic lives in the hook
  ...
}
```

### The client boundary rule

Default to server. Add `'use client'` only at the smallest subtree that requires interactivity. Push the boundary as far toward the leaves as possible. A component that renders client children does not need to be client itself.

```
page.tsx (server)
  └── Shell.Modal (client — needs open/close state)
        └── BookingDetail (server — just renders data, no interactivity)  ← stays server
```

---

### Six section types

#### Type 1: Server component without fetch

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

#### Type 2: Server component with fetch

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

#### Type 3: Server component with server action

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

#### Type 4: Client section without server action

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
  const [state, send] = scene.useScene(initialState)
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

#### Type 5: Client section with server action

State machine plus a mutation. `'use client'`, calls a server action, dispatches the result.

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
  const [state, send] = scene.useScene(initialState)
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

#### Type 6: Client section with server action loader

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
  const [state, send] = scene.useScene(initialState)
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

---

## 7. Shell — Presentation Context

The Shell wraps a Section and provides:

- `@container` queries so sections can respond to their container's width
- An error boundary that catches runtime errors and offers a refresh affordance
- `title`, `onRefresh`, and `onFeedback` global affordances
- Structural layout (full-page, card, modal, drawer)

Sections **never** import or reference the Shell. The Shell is always the caller's concern — `page.tsx` or a parent component decides which Shell to use.

### The four Shell types

| Situation | Shell |
|-----------|-------|
| Page is the entire content | `Shell.FullPage` |
| Section within a page | `Shell.Card` |
| Blocking confirmation, quick form | `Shell.Modal` |
| Detail view, settings, side panel | `Shell.Drawer` |
| Sub-sections within a client section that animate | `Shell.AnimatedStep` |

### Full implementation

```tsx
// lib/shell.tsx
'use client'
import { AnimatePresence, motion } from 'framer-motion'
import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type ShellBaseProps = {
  children:    React.ReactNode
  title?:      string
  onRefresh?:  () => void
  onFeedback?: () => void
  className?:  string
}

function ShellBase({ children, title, onRefresh, onFeedback, className }: ShellBaseProps) {
  return (
    <div className={cn('@container', className)}>
      {(title || onRefresh || onFeedback) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          <div className="flex gap-2">
            {onRefresh  && <button onClick={onRefresh}  className="text-sm text-muted-foreground hover:text-foreground">Refresh</button>}
            {onFeedback && <button onClick={onFeedback} className="text-sm text-muted-foreground hover:text-foreground">Feedback</button>}
          </div>
        </div>
      )}
      <SceneErrorBoundary onRefresh={onRefresh}>
        {children}
      </SceneErrorBoundary>
    </div>
  )
}

type ShellProps = Omit<ShellBaseProps, 'className'>

function FullPage({ children, ...props }: ShellProps) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <ShellBase {...props}>{children}</ShellBase>
    </main>
  )
}

function Card({ children, ...props }: ShellProps) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <ShellBase {...props}>{children}</ShellBase>
    </div>
  )
}

function Modal({
  children, open, onClose, ...props
}: ShellProps & { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <ShellBase {...props}>{children}</ShellBase>
      </DialogContent>
    </Dialog>
  )
}

function Drawer({
  children, open, onClose, side = 'right', ...props
}: ShellProps & { open: boolean; onClose: () => void; side?: 'left' | 'right' }) {
  // implement with DrawerPrimitive from shadcn
  return (
    <DrawerPrimitive open={open} onOpenChange={(o) => { if (!o) onClose() }} direction={side}>
      <DrawerContent>
        <ShellBase {...props}>{children}</ShellBase>
      </DrawerContent>
    </DrawerPrimitive>
  )
}

type AnimatedStepProps = { children: React.ReactNode; stepKey: string }

function AnimatedStep({ children, stepKey }: AnimatedStepProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

class SceneErrorBoundary extends React.Component<
  { children: React.ReactNode; onRefresh?: () => void },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-sm text-destructive">
          <p>Something went wrong.</p>
          {this.props.onRefresh && (
            <button onClick={this.props.onRefresh} className="mt-2 underline">
              Try again
            </button>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

export const Shell = { FullPage, Card, Modal, Drawer, AnimatedStep }
```

---

## 8. CacheRegistry — Data Invalidation

Never call `cacheTag`, `revalidateTag`, or `updateTag` directly. Always go through a `createTagRegistry`.

### Setup

```typescript
// lib/appointment/tags.ts  (or in the section's tags.ts)
import { createTagRegistry } from '@/lib/cache-registry'

export const { Tag, tagWith, invalidate, softInvalidate } = createTagRegistry({
  appointments: (_: Record<string, never>) => ['appointments'] as const,
  appointment:  (p: { id: string })        => ['appointments', `appointment:${p.id}`] as const,
})
```

### In query.ts — tag the cache

```typescript
export async function getAppointmentsState(): Promise<State> {
  'use cache'
  cacheLife('seconds')
  tagWith(Tag.appointments({}))
  // ... fetch and return state
}
```

### In actions.ts — invalidate after mutation

```typescript
'use server'
export async function deleteAppointment(id: string) {
  await db.delete(appointments).where(eq(appointments.id, id))
  invalidate(Tag.appointment({ id }))
  // Invalidating appointment:123 also invalidates the parent 'appointments' list tag
}
```

### Rules

- Never call `cacheTag`, `revalidateTag` directly — always use the registry.
- `tagWith` only inside `'use cache'` scope.
- `invalidate(Tag.entity({ id }))` invalidates the entity AND its parent list — the hierarchy is encoded in the resolver.
- Use `softInvalidate` when eventual consistency is acceptable (background revalidation, no blocking).

---

## 9. How Data Flows — End to End

### On load

1. Browser requests `/bookings?page=2`.
2. Next.js renders `app/bookings/list/page.tsx`.
3. `page.tsx` calls `route.entry.parse(ctx)` — Zod validates and coerces `searchParams` into `{ page: 2 }`.
4. `page.tsx` calls `getBookingsListState()` (or renders `<BookingsList />` in a `<Suspense>`).
5. `getBookingsListState()` runs inside `'use cache'`, calls `tagWith(Tag.bookings({}))`, queries the DB, returns `State`.
6. `page.tsx` passes `state` as `initialState` to the section component.
7. Section renders via `switch (state.status)`.

### On mutation

1. User triggers an action (button click → server action call, or form submit).
2. Server action runs: validates input, calls domain function, updates DB.
3. Server action calls `invalidate(Tag.booking({ id }))` — this revalidates `booking:${id}` and `bookings`.
4. Next.js purges the affected cache entries.
5. On the next request (or on re-render if using `revalidatePath`), the section fetches fresh data.

### On client fetch

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

## 10. Worked Example — Appointment Booking Flow

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
import { entry as newEntry } from '../new/entry'

export const route = createRoute({
  entry,
  exits: {
    new:    (_: Record<string, never>) => newEntry.href({}),
    detail: (p: { id: string }) => `/appointments/${p.id}`,
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
import { entry as listEntry } from '../list/entry'

export const route = createRoute({
  entry,
  exits: {
    list:   (_: Record<string, never>) => listEntry.href({ page: 1 }),
    detail: (p: { id: string }) => `/appointments/${p.id}`,
  },
})
```

**CreateAppointmentForm/state.ts**:
```typescript
export type State =
  | { status: 'idle';       service: string; date: string }
  | { status: 'submitting'; service: string; date: string }
  | { status: 'error';      service: string; date: string; message: string }
  | { status: 'success';    appointmentId: string }

export type Event =
  | { type: 'SET_SERVICE'; service: string }
  | { type: 'SET_DATE';    date: string }
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; appointmentId: string }
  | { type: 'ERROR';   message: string }
  | { type: 'RETRY' }
```

**CreateAppointmentForm/transition.ts**:
```typescript
import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (event.type) {
    case 'SET_SERVICE':
      if (state.status !== 'idle' && state.status !== 'error') return state
      return { ...state, status: 'idle', service: event.service }
    case 'SET_DATE':
      if (state.status !== 'idle' && state.status !== 'error') return state
      return { ...state, status: 'idle', date: event.date }
    case 'SUBMIT':
      if (state.status !== 'idle') return state
      return { ...state, status: 'submitting' }
    case 'SUCCESS':
      return { status: 'success', appointmentId: event.appointmentId }
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
  service: string,
  date: string,
): Promise<{ appointmentId: string }> {
  const [row] = await db
    .insert(appointments)
    .values({ service, date, status: 'pending' })
    .returning({ id: appointments.id })
  invalidate(Tag.appointments({}))
  return { appointmentId: row.id }
}
```

**CreateAppointmentForm/fixtures.ts**:
```typescript
import type { State } from './state'

export const fixtures = {
  idle:       { status: 'idle',       service: '',         date: ''           } satisfies State,
  submitting: { status: 'submitting', service: 'Haircut',  date: '2026-04-10' } satisfies State,
  error:      { status: 'error',      service: 'Haircut',  date: '2026-04-10', message: 'Server error' } satisfies State,
  success:    { status: 'success',    appointmentId: 'abc123'                  } satisfies State,
}
```

**CreateAppointmentForm/CreateAppointmentForm.tsx**:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { route } from '../../contract'
import { scene } from './scene'
import { createAppointment } from './actions'
import type { State } from './state'

export function CreateAppointmentForm({ initialState }: { initialState: State }) {
  const [state, send] = scene.useScene(initialState)
  const router = useRouter()

  switch (state.status) {
    case 'idle':
    case 'error':
      return (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            send({ type: 'SUBMIT' })
            try {
              const result = await createAppointment(state.service, state.date)
              send({ type: 'SUCCESS', appointmentId: result.appointmentId })
              router.push(route.exits.detail({ id: result.appointmentId }))
            } catch (err) {
              send({ type: 'ERROR', message: (err as Error).message })
            }
          }}
        >
          <input
            value={state.service}
            onChange={(e) => send({ type: 'SET_SERVICE', service: e.target.value })}
            placeholder="Service"
          />
          <input
            type="date"
            value={state.date}
            onChange={(e) => send({ type: 'SET_DATE', date: e.target.value })}
          />
          {state.status === 'error' && <p className="text-destructive">{state.message}</p>}
          <button type="submit">Book appointment</button>
        </form>
      )
    case 'submitting':
      return <p>Booking…</p>
    case 'success':
      return <p>Appointment {state.appointmentId} booked.</p>
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

## 11. Critical Invariants — Never Break These

### Navigation

- Never write raw URL strings in `href`, `router.push`, or `redirect`.
- Always use `route.exits.*()` or `route.entry.href()`.
- `entry.ts` never imports a neighbor route's `contract.ts` or `page.tsx`.
- `contract.ts` imports only neighbor `entry.ts` files — never their contracts or pages.

### Section / component state

- Every non-primitive component is a section — no exceptions.
- `State` must be a discriminated union — every status is explicit and exhaustive.
- The component renders only a `switch (state.status)` — no business logic in JSX.
- `useState`, `useEffect`, and all React hooks live only in custom hooks — never directly in component functions.
- **Input field values do not belong in the scene.** Controlled input values (`email`, `code`, `name`, etc.) are local UI state — use `useState` in the component. The scene tracks *what the user is doing* (idle, submitting, error, success), not *what they are typing*. If typing should clear an error, call `send({ type: 'RETRY' })` alongside the local `setState` — don't route the keystrokes through the state machine.

### Client boundary

- Server by default — only add `'use client'` at the smallest subtree that needs it.
- Push the `'use client'` boundary as far toward the leaves as possible.
- A component that renders client children does not itself need to be client.

### Cache

- Never call `cacheTag`, `revalidateTag`, or `updateTag` directly — always use the registry.
- `tagWith` only inside `'use cache'` scope.
- `invalidate` in server actions after mutations.
- One `invalidate(Tag.entity({ id }))` covers the entity and its parent list.

### Client sections that fetch

- Server actions can be used as data loaders, not just mutations.
- All fetch logic lives in a `useXxxLoader.ts` hook — never inline in the component.
- The `loading` state variant carries all parameters needed for the fetch (e.g. `{ status: 'loading', id }`).
- Always cancel in-flight requests on cleanup (`let cancelled = false` + cleanup function).

---

## 12. Decision Guide

| Situation | What to do |
|-----------|------------|
| New page / URL | RouteRegistry: `entry.ts` + `contract.ts` + `page.tsx` |
| Component has data, loading, or errors | Section — always |
| Simple `<Button>`, `<Input>`, `<Badge>` | No section — primitive |
| Component fetches AND data can be mutated | Add `tags.ts` |
| After mutation, want immediate freshness | `invalidate(Tag.x(...))` |
| After mutation, eventual consistency is fine | `softInvalidate(Tag.x(...))` |
| Navigate after async work in a client component | `router.push(route.exits.next(...))` |
| Navigate from a server component or action | `redirect(route.exits.next(...))` |
| Navigate with no async work | `<Link href={route.exits.next(...)}>` |
| Client section needs to fetch data | Server action as loader + `useXxxLoader.ts` hook |
| Modal/Drawer needs client state but server content | Client shell + server `children` passed from `page.tsx` |
| Component needs interactivity | `'use client'` — push boundary as far down as possible |
| Need hook logic in a component | Extract to `useXxx.ts` — components never contain hook bodies |
