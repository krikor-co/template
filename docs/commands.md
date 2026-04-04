---
title: Commands
order: 11
category: Infrastructure
---

# Commands

Three slash commands scaffold framework-compliant code. They work in Claude Code (CLI, desktop, web, IDE extensions) — type the command and provide arguments.

These commands are designed for both humans and AI agents. A human types `/scaffold-route app/bookings/new` and reviews the output. An AI agent invoked with "build a booking feature" uses `/scaffold-feature` internally to produce the same consistent structure.

---

## `/scaffold-route`

Creates the three files every route needs: `entry.ts`, `contract.ts`, and `page.tsx`.

### Usage

```
/scaffold-route app/bookings/new
```

### What it creates

| File | Purpose |
|------|---------|
| `entry.ts` | Zod schema for URL params, `href()` builder, `parse()` function |
| `contract.ts` | `createRoute({ entry, exits })` — wires this route to its neighbors |
| `page.tsx` | Async server component that parses URL and composes shells + sections |

### When to use

- Adding a new page to an existing flow
- Creating the first page of a new feature (follow with `/scaffold-section` for each section)

### What it does NOT create

- Sections, actions, or queries — use `/scaffold-section` for those
- Layout guards — add manually if the route needs access control
- Layout files — add manually for shared UI or guard logic

---

## `/scaffold-section`

Creates a complete section folder with all files for the given section type.

### Usage

```
/scaffold-section a form section for creating a booking, with service and date fields, at app/bookings/new/_components/CreateBookingForm
```

### What it creates

The command determines the section type from the description and creates only the files needed:

| Type | Description | Files |
|------|-------------|-------|
| 1 | Server, no fetch | state.ts, fixtures.ts, Component.tsx |
| 2 | Server, with fetch | + deps.ts, query.ts, tags.ts |
| 3 | Server, with action | + actions.ts |
| 4 | Client, no action | + transition.ts, scene.ts |
| 5 | Client, with action | + transition.ts, scene.ts, actions.ts, stories |
| 6 | Client, with loader | + transition.ts, scene.ts, useXxxLoader.ts, actions.ts |

For form sections, the component automatically uses the three-hook pattern:

```tsx
const [state, send, reset] = scene.useScene(initialState)   // status lifecycle
const form = useFormValues()                                  // input values + errors
useRedirectOnSuccess(state, reset)                            // navigation after success
```

### When to use

- Adding a new component that has state, data, errors, or loading
- Any component beyond a simple primitive (`Button`, `Input`, `Badge`)

### What it does NOT create

- Route files — use `/scaffold-route` first if the page doesn't exist
- Database schema — add tables to `db/schema/` manually
- Shared cache tags — create `lib/<domain>/tags.ts` manually if multiple sections share tags

---

## `/scaffold-feature`

Orchestrates a complete feature from a plain-English description. Combines `/scaffold-route` and `/scaffold-section` patterns with data modeling, cache tags, layout guards, and stories.

### Usage

```
/scaffold-feature An appointment booking flow: a list page showing upcoming appointments, and a "new appointment" form page with service and date fields. After booking, redirect to the appointment detail page.
```

### What it creates

Everything needed for the feature:

1. **Data model** — new tables in `db/schema/` if needed
2. **Cache tags** — shared `lib/<domain>/tags.ts` for the feature's entities
3. **Routes** — `entry.ts` + `contract.ts` + `page.tsx` for each page, with exits wired between them
4. **Sections** — complete section folders for each component, typed to the correct section type
5. **Layout guards** — if any route needs access control
6. **Stories** — `.stories.tsx` for every client section

### When to use

- Starting a new feature from scratch
- When you can describe the feature in plain English and want all the plumbing generated

### Verification checklist

After the command runs, it verifies:

```
[ ] Every new URL has entry.ts + contract.ts + page.tsx
[ ] Every non-primitive component has a section folder
[ ] Every client section has transition.ts + scene.ts
[ ] Every form section uses useFormValues + useRedirectOnSuccess
[ ] Every action returns domain data (never calls redirect)
[ ] Every navigation uses route.exits (no raw URL strings)
[ ] Every fetchable section has query.ts + tags.ts
[ ] Stories exist for every client section
[ ] Cache tags are invalidated after mutations
```

---

## For AI agents

When building features programmatically (e.g., an orchestrating agent delegates to Claude Code), use these commands as building blocks:

```
1. /scaffold-feature "description"     — full feature from scratch
2. /scaffold-route path                — add a page to an existing feature
3. /scaffold-section "description"     — add a component to an existing page
```

The commands encode all framework invariants: state machine shapes, form patterns, navigation rules, cache invalidation, action return types. An agent using these commands produces code that is structurally identical to hand-written code.

### Key invariants the commands enforce

- State is always a discriminated union on `status` — no ad-hoc shape
- Input values live in `useFormValues`, never in scene state
- Actions return domain data, never call `redirect()` or import routes
- Navigation always uses `route.exits.*()` — no raw URL strings
- Forms use `<form action={fn}>` with `defaultValue` — never `onSubmit`, never controlled inputs (unless cross-field validation)
- Client boundary pushed to the smallest leaf that needs interactivity
