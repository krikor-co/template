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
  const [state, send, reset] = scene.useScene(initialState)
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
              reset()
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
