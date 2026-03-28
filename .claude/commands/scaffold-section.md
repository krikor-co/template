Create a new Section following this project's architecture.

Sections are the feature units of the UI. They live inside Shells, inside Pages. A section can fetch data, trigger actions, hold a state machine, or just be a styled collection of primitives — but it is always an independent, self-contained block.

## What you will create

For the section described in $ARGUMENTS (or ask if not provided), determine its type and create the appropriate files.

## Step 1 — Determine section type

Ask these questions (or infer from context):

1. **Does it fetch data from the database?** → needs `deps.ts` + `query.ts` + `tags.ts`
2. **Does it mutate data?** → needs `actions.ts` with `'use server'`
3. **Does it need client interactivity** (clicks, form inputs, local UI state)? → needs `transition.ts` + `scene.ts` + `'use client'`
4. **Is it a client section that needs to fetch data based on runtime state** (e.g. selected ID from parent)? → needs `useXxxLoader.ts` + server action loader in `actions.ts`

## Step 2 — Create the files

### Always create these three

**`state.ts`** — exhaustive discriminated union. Every possible thing the component can show:
```typescript
export type State =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'loaded'; items: Item[] }
  | { status: 'error'; message: string }

// Add Event type only if client section
export type Event =
  | { type: 'SELECT'; id: string }
  | { type: 'DESELECT' }
```

**`fixtures.ts`** — one example per state variant, used by tests and Storybook:
```typescript
import type { State } from './state'

export const fixtures = {
  loading: { status: 'loading' } satisfies State,
  empty:   { status: 'empty' }   satisfies State,
  loaded:  { status: 'loaded', items: [{ id: '1', name: 'Example' }] } satisfies State,
  error:   { status: 'error', message: 'Something went wrong' } satisfies State,
}
```

**`ComponentName.tsx`** — switch on state.status, nothing else:
```tsx
// Add 'use client' only if client section
import type { State } from './state'

export function ComponentName({ initialState }: { initialState: State }) {
  // For client sections: const [state, send] = scene.useScene(initialState)
  // For server sections: const state = await deps.getState()

  switch (state.status) {
    case 'loading': return <Skeleton />
    case 'empty':   return <p>Nothing here yet.</p>
    case 'loaded':  return <ul>{state.items.map(i => <li key={i.id}>{i.name}</li>)}</ul>
    case 'error':   return <p>{state.message}</p>
  }
}
```

### If server section with fetch — also create

**`deps.ts`**:
```typescript
import type { State } from './state'
export type Deps = { getState: () => Promise<State> }
```

**`tags.ts`**:
```typescript
import { createTagRegistry } from '@/lib/cache-registry'
export const { Tag, tagWith, invalidate, softInvalidate } = createTagRegistry({
  items:  (_: Record<string, never>) => ['items'] as const,
  item:   (p: { id: string })        => ['items', `item:${p.id}`] as const,
})
```

**`query.ts`**:
```typescript
import { cacheLife } from 'next/cache'
import { tagWith, Tag } from './tags'
import type { State } from './state'

export async function getXxxState(/* params */): Promise<State> {
  'use cache'
  cacheLife('seconds')
  tagWith(Tag.items({}))
  try {
    const items = await db.query.items.findMany()
    return items.length === 0 ? { status: 'empty' } : { status: 'loaded', items }
  } catch (e) {
    return { status: 'error', message: (e as Error).message }
  }
}
```

### If client section — also create

**`transition.ts`** — pure function, no side effects:
```typescript
import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'SELECT') return { ...state, status: 'selected', selectedId: event.id }
      break
    case 'selected':
      if (event.type === 'DESELECT') return { ...state, status: 'idle' }
      break
  }
  return state
}
```

**`scene.ts`** — the state machine for this section:
```typescript
import { createScene } from '@/lib/scene'
import { transition } from './transition'
export const scene = createScene(transition)
```

### If client section that fetches — also create

**`useXxxLoader.ts`** — ALL fetch logic lives here, never in the component:
```typescript
import { useEffect } from 'react'
import type { State } from './state'
import type { Send } from '@/lib/scene'
import { getXxxState } from './actions'

export function useXxxLoader(state: State, send: Send<Event>) {
  useEffect(() => {
    if (state.status !== 'loading') return
    let cancelled = false
    getXxxState(state.id).then(
      (data) => { if (!cancelled) send({ type: 'LOADED', ...data }) },
      (e)    => { if (!cancelled) send({ type: 'ERROR', message: (e as Error).message }) }
    )
    return () => { cancelled = true }
  }, [state.status === 'loading' ? state.id : null])
}
```

Add the loader server action to **`actions.ts`**:
```typescript
'use server'
export async function getXxxState(id: string) {
  // query DB and return data — this is a loader, not a mutation
  return db.query.xxx.findFirst({ where: (t, { eq }) => eq(t.id, id) })
}
```

### If mutates — also create or add to `actions.ts`

```typescript
'use server'
import { invalidate, Tag } from './tags'  // or from shared lib/domain/tags.ts

export async function deleteXxx(id: string) {
  await db.delete(xxx).where(eq(xxx.id, id))
  invalidate(Tag.item({ id }))
}
```

## Rules — never break these

- **Hooks rule**: `useState`, `useEffect`, `useReducer` live ONLY in `.ts` hook files — never in the `.tsx` component
- **Client boundary**: only add `'use client'` if the section needs interactivity; server by default
- **State**: always a discriminated union — no boolean flags, no nullable fields to represent state
- **Component**: only a `switch` on `state.status` — no `if/else`, no inline conditions outside the switch
- **Every state variant** must have a fixture
- **Sections never reference their Shell** — the Shell is the caller's concern

## Wiring in page.tsx

Always show the user how to wire this section into its page:

```tsx
// Server section:
<Shell.Card title="Items">
  <Suspense fallback={<ItemsSection deps={{ getState: async () => fixtures.loading }} />}>
    <ItemsSection deps={{ getState: () => getXxxState(params.id) }} />
  </Suspense>
</Shell.Card>

// Client section receiving initialState from server:
const state = await getXxxState(params.id)
<Shell.Card title="Items">
  <ItemsSection initialState={state} />
</Shell.Card>
```
