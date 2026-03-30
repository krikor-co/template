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

**Read [`docs/architecture.md`](docs/architecture.md) and [`docs/schema.md`](docs/schema.md) before writing any feature.**

---

## New feature checklist

```
□ New URL/page?               → entry.ts + contract.ts + page.tsx
□ Non-primitive UI component? → section folder (state.ts + fixtures.ts + Component.tsx minimum)
□ Component fetches?          → add deps.ts + query.ts + tags.ts
□ Component mutates?          → add actions.ts with 'use server'
□ Client interactivity?       → add transition.ts + scene.ts, mark 'use client'
□ Client section that fetches?→ add useXxxLoader.ts + server action loader in actions.ts
□ Navigates on success?       → route.exits.*() — never raw URL strings
```

---

## Critical invariants

**Navigation**
- Never write raw URL strings in `href`, `router.push`, or `redirect`
- Always use `route.exits.*()` or `route.entry.href()`
- `entry.ts` never imports a neighbor route's `contract.ts`
- Actions and queries **never** call `redirect()` — return data (including `redirectTo: route.exits.*()`) and let the section orchestrate navigation

**Section / component state**
- Every non-primitive component is a section — no exceptions
- `State` must be a discriminated union — every status is explicit and exhaustive
- Component body = `switch (state.status)` only — no business logic in JSX
- `useState`, `useEffect`, and all React hooks live only in custom hook files (`.ts`)
- Input field values (`email`, `code`, `name`, …) are **not** scene state — use `useState` in the component; call `send({ type: 'RETRY' })` alongside `setState` if typing should clear an error

**Client boundary**
- Server by default — only add `'use client'` at the smallest leaf that needs it
- Push the client boundary as far toward the leaves as possible

**CacheRegistry**
- Never call `cacheTag` or `revalidateTag` directly — always go through the registry
- `tagWith(Tag.x(...))` only inside `'use cache'` scope
- `invalidate(Tag.x(...))` in server actions after mutations — covers entity + parent list

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
| Navigate after async work in a client component | `router.push(route.exits.next(...))` in a `useEffect` watching state |
| Navigate from a server component | `redirect(route.exits.next(...))` |
| Action needs to trigger navigation | Return `{ redirectTo: route.exits.next(...) }` — section calls `router.push` |
| Navigate with no async work before | `<Link href={route.exits.next(...)}>` |
| Client section needs to fetch data | Server action as loader + `useXxxLoader.ts` |
| Modal/Drawer with server content | Client shell, server `children` passed from page |
| Need hook logic in a component | Extract to `useXxx.ts` — never inline in component |

---

## Available skills

```
/scaffold-route    — creates entry.ts + contract.ts + page.tsx
/scaffold-section  — creates a complete section folder
/scaffold-feature  — builds a complete feature from a plain-English description
```
