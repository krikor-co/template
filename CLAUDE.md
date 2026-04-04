# Flow Framework — Quick Reference

This project uses the **Flow Framework**: one hierarchy, four layers.

```
Page           →  composes Shells + Sections, parses URL, no logic
Shell          →  presentation context (FullPage · Card · Modal · Drawer)
Section        →  the feature: state machine, data fetching, actions
Primitives     →  raw UI atoms: Button · Input · Badge · …
```

```
RouteRegistry  →  navigation (typed URLs, typed exits)
CacheRegistry  →  data invalidation (typed, hierarchical cache tags)
```

**For depth on any concept, read the relevant doc file in `docs/`:**

| Doc | What it covers |
|-----|---------------|
| [`pages.md`](docs/pages.md) | Page layer, hierarchy, system overview |
| [`routing.md`](docs/routing.md) | RouteRegistry, entry.ts, contract.ts, exits |
| [`shells.md`](docs/shells.md) | Shell types + full implementation |
| [`sections.md`](docs/sections.md) | 6 section types, state machines, file map |
| [`caching.md`](docs/caching.md) | CacheRegistry, tags, invalidation patterns |
| [`guards.md`](docs/guards.md) | Layout guards, transition guards, cookie returnTo |
| [`rate-limiting.md`](docs/rate-limiting.md) | createRateLimit, key strategy, storage |
| [`storybook.md`](docs/storybook.md) | Story patterns, co-location, running |
| [`data-flow.md`](docs/data-flow.md) | Load/mutation/client-fetch + worked example |
| [`declarative-flows.md`](docs/declarative-flows.md) | Action-first design, state machines |
| [`forms.md`](docs/forms.md) | useFormValues, value persistence, validation, controlled vs uncontrolled |
| [`schema.md`](docs/schema.md) | Entity-first database modeling |
| [`commands.md`](docs/commands.md) | Scaffold commands for routes, sections, features |

---

## New feature checklist

```
□ New URL/page?               → entry.ts + contract.ts + page.tsx
□ Non-primitive UI component? → section folder (state.ts + fixtures.ts + Component.tsx minimum)
□ Component fetches?          → add deps.ts + query.ts + tags.ts
□ Component mutates?          → add actions.ts with 'use server'
□ Client interactivity?       → add transition.ts + scene.ts, mark 'use client'
□ Client section that fetches?→ add useXxxLoader.ts + server action loader in actions.ts
□ Section has a `<form>`?     → add useFormValues(), capture in handleSubmit, defaultValue on inputs
□ Navigates on success?       → route.exits.*() — never raw URL strings
```

---

## Critical invariants

**Navigation**
- Never write raw URL strings in `href`, `router.push`, or `redirect`
- Always use `route.exits.*()` or `route.entry.href()`
- `entry.ts` never imports a neighbor route's `contract.ts`
- Actions and queries **never** call `redirect()` — return domain data and let the section orchestrate navigation
- Actions **never** import route contracts or entry points — return domain results (e.g., `{ success: true, isNew: boolean }`), not URLs; the section maps results to routes via its own contract's exits
- Route-specific context (like `returnTo`) flows from page → section as props, not through actions

**Section / component state**
- Every non-primitive component is a section — no exceptions
- `State` must be a discriminated union — every status is explicit and exhaustive
- Component body = `switch (state.status)` only — no business logic in JSX
- `useScene` returns `[state, send, reset]` — always call `reset()` after `router.push` to prevent stale Router Cache loops (or use `useRedirectOnSuccess(state, reset)`)
- `useState`, `useEffect`, and all React hooks live only in custom hook files (`.ts`) — applies to page, shell, section, and primitive layers (not `lib/` framework utilities)
- Input field values (`email`, `code`, `name`, …) are **not** scene state — they belong in `useFormValues`
- `<form action={fn}>` triggers `form.reset()` on resolve (success AND error) — use `useFormValues` to capture values and provide `defaultValue` that survives the reset
- Form sections use three hooks: `useScene` (status) + `useFormValues` (input values + field errors + validation) + `useRedirectOnSuccess` (navigation)
- Prefer uncontrolled inputs with `defaultValue={form.values.x}` — only use controlled (`useState` + `value`) when inputs depend on each other's values (cross-field validation)
- Call `send({ type: 'RETRY' })` in `onChange` to clear scene-level errors; `form.field()` handles clearing field-level errors automatically

**Client boundary**
- Server by default — only add `'use client'` at the smallest leaf that needs it
- Push the client boundary as far toward the leaves as possible

**CacheRegistry**
- Never call `cacheTag`, `updateTag`, or `revalidateTag` directly — always go through the registry
- `tagWith(Tag.x(...))` only inside `'use cache'` scope
- `invalidate(Tag.x(...))` — immediate freshness via `updateTag` (read-your-own-writes, server actions only)
- `softInvalidate(Tag.x(...))` — eventual freshness via `revalidateTag` (serve stale while revalidating)

**Layout guards**
- Layouts are the middleware layer — all route-level access control lives in layouts
- Guard functions live in the feature layer (e.g. `app/auth/guards.ts`), never in `lib/`
- Layouts never use `searchParams` — flow metadata (like `returnTo`) travels via cookies
- Use `createTransitionGuard` from `lib/transition.ts` when exit animations must play before a layout redirect

---

## Quick decision guide

| Situation | What to do |
|-----------|------------|
| New page/URL | RouteRegistry: entry.ts + contract.ts + page.tsx |
| Component has data, loading, or errors | Section — always |
| Simple `<Button>`, `<Input>`, `<Badge>` | No section — primitive |
| Component fetches AND data can be mutated | Add tags.ts |
| After mutation, want immediate freshness | `invalidate(Tag.x(...))` |
| After mutation, eventual consistency is fine | `softInvalidate(Tag.x(...))` |
| Navigate after async work in a client component | `router.push(route.exits.next(...))` then `reset()` — or use `useRedirectOnSuccess(state, reset)` |
| Navigate from a server component | `redirect(route.exits.next(...))` |
| Action needs to trigger navigation | Action returns domain data — section maps to `route.exits.*()` and calls `router.push` |
| Navigate with no async work before | `<Link href={route.exits.next(...)}>` |
| Client section needs to fetch data | Server action as loader + `useXxxLoader.ts` |
| Section inside a client shell (Modal/Drawer) needs data | Server action as loader + `useXxxLoader.ts` (Type 6) |
| Section has a `<form>` | `useFormValues()` — capture on submit, `defaultValue` on inputs, `form.field()` for validation |
| Form needs per-field validation | `form.field('email', { validate: fn })` — validates on blur, clears on change, blocks submit |
| Form needs cross-field validation | `useFormValues({ validate: fn })` + controlled inputs with `useState` |
| Action returns field-level errors | `form.setErrors(result.fieldErrors)` — display via `form.errors.fieldName` |
| Need hook logic in a component | Extract to `useXxx.ts` — never inline in component |
| Route needs access control | Layout guard — redirect in layout, guard fn in feature layer |
| Action triggers animation before redirect | Transition guard — `grant()` in action, `isActive()` in layout |

---

## Available skills

```
/scaffold-route    — creates entry.ts + contract.ts + page.tsx
/scaffold-section  — creates a complete section folder
/scaffold-feature  — builds a complete feature from a plain-English description
```
