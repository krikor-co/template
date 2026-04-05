---
title: Overview
order: 0
category: Guide
---

# Flow Framework

A Next.js project template with one opinion: **every component is either a primitive or a section, and every section has an exhaustive state type.**

This template gives you a hierarchy, four registries, and a set of conventions that remove ambiguity from frontend architecture. You don't decide where state lives, how navigation works, or how to invalidate cache — the framework answers those questions once.

These docs ship with the template and are served at `/docs` in your running application. They're yours — as you build on the template, update them to reflect your domain-specific patterns, conventions, and decisions. The docs grow with your application, serving both as onboarding material and as a living reference for your team.

---

## The hierarchy

```
Page           →  composes Shells + Sections, parses URL, no logic
Shell          →  presentation context (FullPage · Card · Modal · Drawer)
Section        →  the feature: state machine, data fetching, actions
Primitives     →  raw UI atoms: Button · Input · Badge · …
```

Each layer has one job:

- **Pages** parse the URL and compose. They never fetch, never contain logic, never hold state.
- **Shells** provide presentation context — a card border, a modal overlay, a full-page layout. Sections don't know which shell they're in.
- **Sections** are the features. Each one has an exhaustive `State` type, renders via `switch (state.status)`, and owns its own data, errors, and actions.
- **Primitives** are raw UI atoms. If it fetches, it's a section. If it has loading states, it's a section.

## The registries

```
RouteRegistry  →  typed URLs, typed exits, no raw strings
CacheRegistry  →  typed cache tags, hierarchical invalidation
```

- **RouteRegistry**: every URL has an `entry.ts` (how to build and parse it) and a `contract.ts` (what exits it has). Navigation is always `route.exits.xxx()` — never a raw string.
- **CacheRegistry**: every cached query applies typed tags via `tagWith()`. Mutations invalidate via `invalidate()` (immediate) or `softInvalidate()` (eventual). Tags are hierarchical — invalidating `bookings` also invalidates `booking:123`.

---

## What a feature looks like

A typical feature has a route and one or more sections:

```
app/bookings/new/
  ├── entry.ts                          ← URL params: Zod schema + href + parse
  ├── contract.ts                       ← exits: where can the user go from here
  ├── page.tsx                          ← composes Shell + Section
  ├── layout.tsx                        ← guards (access control)
  └── _components/
      └── CreateBookingForm/
          ├── state.ts                  ← State + Event discriminated unions
          ├── transition.ts             ← pure (state, event) → state
          ├── scene.ts                  ← createScene(transition)
          ├── fixtures.ts               ← one example per state variant
          ├── actions.ts                ← 'use server' mutations
          ├── CreateBookingForm.tsx      ← switch(state.status), three-hook form pattern
          └── CreateBookingForm.stories.tsx
```

Not every section needs every file. A server component that just renders props needs only `state.ts`, `fixtures.ts`, and the component. The [Sections](sections) doc covers all six types.

---

## The state machine pattern

Every section's state is a discriminated union:

```typescript
export type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error';   message: string }
  | { status: 'success'; redirectTo: string }
```

The component renders a `switch` on `state.status`. No boolean combinations, no `if (isLoading && hasData)`. Every possible UI is an explicit state variant with a fixture to match.

Transitions are pure functions:

```typescript
export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'SUBMIT') return { status: 'submitting' }
      break
    case 'submitting':
      if (event.type === 'ERROR')   return { status: 'error', message: event.message }
      if (event.type === 'SUCCESS') return { status: 'success', redirectTo: event.redirectTo }
      break
    case 'error':
      if (event.type === 'RETRY')  return { status: 'idle' }
      if (event.type === 'SUBMIT') return { status: 'submitting' }
      break
  }
  return state
}
```

## The form pattern

React 19's `<form action={fn}>` calls `form.reset()` when the action resolves — clearing all inputs on both success AND error. The framework solves this with `useFormValues`:

```tsx
const [state, send, reset] = scene.useScene(initialState)   // status lifecycle
const form = useFormValues()                                  // input values + errors
useRedirectOnSuccess(state, [reset, form.reset])              // navigation after success
```

Three hooks, three concerns, zero overlap. Scene owns status. The form hook owns input values and field errors. The redirect hook handles navigation. See [Forms](forms) for the full pattern.

---

## Getting started

### Build a feature with commands

The fastest way to add a feature:

**CLI** (deterministic scaffolding):
```bash
# Generate a route
npx tsx tools/cli/index.ts g route app/bookings/new

# Generate a section
npx tsx tools/cli/index.ts g section app/bookings/new/_components/CreateBookingForm --client --mutates
```

**Claude Code** (AI-assisted, fills in domain logic):
```
/scaffold-feature An appointment booking flow with a list page and a create form
```

The Claude commands call the CLI internally, then fill in the TODOs with real code. See [Commands](commands) for full usage.

### Build a feature manually

1. **Define the route**: create `entry.ts` + `contract.ts` + `page.tsx` (see [Routing](routing))
2. **Create the section folder**: `state.ts` + `transition.ts` + `scene.ts` + `fixtures.ts` + component (see [Sections](sections))
3. **Add the action**: `actions.ts` with `'use server'` — validates, mutates, invalidates cache (see [Data Flow](data-flow))
4. **Wire the page**: compose Shell + Section in `page.tsx` (see [Pages](pages))
5. **Add stories**: one per fixture (see [Storybook](storybook))

### New feature checklist

```
□ New URL/page?               → entry.ts + contract.ts + page.tsx
□ Non-primitive UI component? → section folder (state.ts + fixtures.ts + Component.tsx minimum)
□ Component fetches?          → add query.ts + tags.ts
□ Component mutates?          → add actions.ts with 'use server'
□ Client interactivity?       → add transition.ts + scene.ts, mark 'use client'
□ Section has a <form>?       → useFormValues() + useRedirectOnSuccess()
□ Navigates on success?       → route.exits.*() — never raw URL strings
```

---

## Reading order

If you're new to the framework, read in this order:

1. **[Pages](pages)** — the hierarchy and how the system composes
2. **[Routing](routing)** — how navigation works (entry, contract, exits)
3. **[Sections](sections)** — the six section types and their file maps
4. **[Shells](shells)** — presentation contexts (FullPage, Card, Modal, Drawer)
5. **[Forms](forms)** — the three-hook pattern, value persistence, validation
6. **[Data Flow](data-flow)** — load, mutation, and client-fetch end-to-end
7. **[Caching](caching)** — cache tags and invalidation
8. **[Guards](guards)** — layout guards and transition guards
9. **[Declarative Flows](declarative-flows)** — the design principle behind everything
10. **[Commands](commands)** — CLI and Claude Code scaffolding commands

---

## Key invariants

These rules are enforced everywhere. Breaking them creates bugs.

**Navigation**: never write raw URL strings. Always `route.exits.xxx()` or `entry.href()`. Actions never call `redirect()` — they return domain data, and the section maps results to routes.

**State**: every non-primitive component is a section with an exhaustive `State` discriminated union. The component body is `switch (state.status)` — nothing else. Input field values are never in state — they belong in `useFormValues`.

**Client boundary**: server by default. Only add `'use client'` at the smallest leaf that needs interactivity. `useState`, `useEffect`, and all hooks live in custom hook files, not in components.

**Cache**: never call `cacheTag`, `updateTag`, or `revalidateTag` directly. Always go through the registry: `tagWith()` inside `'use cache'`, `invalidate()` for immediate freshness, `softInvalidate()` for eventual.
