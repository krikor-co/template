# Declarative Flows

## The Principle

Design starts from the action vocabulary, not the UI.

Before writing any component, enumerate what the user is allowed to DO in this context. Each action becomes a state machine event. The UI is a consequence of the state machine — a button exists because an event exists, not the other way around. There are no implicit affordances.

## Why this matters

Contrast with UI-first design:
- ❌ UI-first: "I need a page with a list, a delete button, and a search bar" → you build components, then figure out state
- ✅ Action-first: "The user can: search bookings, delete a booking, navigate to create" → you model these as events, then render their affordances

When you design from actions:
- Every state is intentional — you can't be in a state you didn't define
- Dead-end states are impossible — the type system enforces valid transitions
- QA is trivial — enumerate all states, check each fixture
- The component is just a render function for the state machine

## The process (step by step)

For any new feature, before writing code:

**Step 1 — Name the context**
What is the user doing? "Managing bookings", "Writing a note", "Selecting a service"

**Step 2 — Enumerate actions**
What can the user DO here? List as verbs:
- Search bookings
- Delete a booking
- Navigate to create a new booking
- Load the next page

**Step 3 — Map to events**
Each action becomes a typed event:
```typescript
export type Event =
  | { type: 'SEARCH';      query: string }
  | { type: 'DELETE';      bookingId: string }
  | { type: 'DELETE_SUCCESS' }
  | { type: 'DELETE_ERROR'; message: string }
  | { type: 'NAVIGATE_NEW' }
```

**Step 4 — Define states**
What states emerge from these actions? Each transition implies states:
```typescript
export type State =
  | { status: 'idle';     bookings: Booking[]; query: string }
  | { status: 'deleting'; bookings: Booking[]; query: string; deletingId: string }
  | { status: 'error';    bookings: Booking[]; query: string; message: string }
```

**Step 5 — Write the transition**
One case per legal (state, event) pair. Everything else returns state unchanged:
```typescript
export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'DELETE')
        return { ...state, status: 'deleting', deletingId: event.bookingId }
      if (event.type === 'SEARCH')
        return { ...state, query: event.query }
      break
    case 'deleting':
      if (event.type === 'DELETE_SUCCESS')
        return { ...state, status: 'idle', bookings: state.bookings.filter(b => b.id !== state.deletingId) }
      if (event.type === 'DELETE_ERROR')
        return { ...state, status: 'error', message: event.message }
      break
    case 'error':
      if (event.type === 'DELETE')
        return { ...state, status: 'deleting', deletingId: event.bookingId }
      break
  }
  return state
}
```

**Step 6 — Write fixtures**
One per state variant. The component renders correctly for each:
```typescript
export const fixtures = {
  idle:     { status: 'idle',     bookings: [...], query: '' } satisfies State,
  deleting: { status: 'deleting', bookings: [...], query: '', deletingId: 'b1' } satisfies State,
  error:    { status: 'error',    bookings: [...], query: '', message: 'Network error' } satisfies State,
}
```

**Step 7 — Render the switch**
The component renders only a switch — no logic, no conditions outside the switch:
```tsx
switch (state.status) {
  case 'idle':
    return (
      <div>
        <SearchInput value={state.query} onChange={(q) => send({ type: 'SEARCH', query: q })} />
        <BookingList bookings={state.bookings} onDelete={(id) => send({ type: 'DELETE', bookingId: id })} />
        <Link href={route.exits.new({})}>New booking</Link>
      </div>
    )
  case 'deleting':
    return (
      <div>
        {/* same UI but delete button is disabled */}
        <BookingList bookings={state.bookings} deletingId={state.deletingId} />
      </div>
    )
  case 'error':
    return <ErrorBanner message={state.message} onRetry={() => send({ type: 'DELETE', bookingId: state.deletingId })} />
}
```

## What "declarative" means here

The component *declares* what to show for each state. It does not *decide* what to show based on conditions. There are no `if (isLoading && hasData)` boolean combinations. There is only `switch (state.status)`. The state machine already resolved every ambiguity.

## Anti-patterns to avoid

```tsx
// ❌ imperative UI — building from components and adding state
const [isDeleting, setIsDeleting] = useState(false)
const [error, setError] = useState<string | null>(null)
return (
  <div>
    <button onClick={handleDelete} disabled={isDeleting}>
      {isDeleting ? 'Deleting...' : 'Delete'}
    </button>
    {error && <p>{error}</p>}
  </div>
)

// ✅ declarative — state machine defines what's possible
switch (state.status) {
  case 'idle':     return <button onClick={() => send({ type: 'DELETE', bookingId })}>Delete</button>
  case 'deleting': return <button disabled>Deleting…</button>
  case 'error':    return <><p>{state.message}</p><button onClick={() => send({ type: 'RETRY' })}>Retry</button></>
}
```

## Connection to the system

Declarative Flows is the design principle. Scene is its implementation. RouteRegistry ensures navigation is also declarative — exits are named and typed, not raw strings. The full system is a consequence of this one principle applied at every layer.
