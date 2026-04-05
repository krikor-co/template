---
title: Commands
order: 1
category: Guide
---

# Commands

Two sets of scaffolding commands: a **CLI** for deterministic file generation, and **Claude Code slash commands** that call the CLI and then fill in the domain logic.

---

## CLI — `flow generate`

The CLI lives at `tools/cli/index.ts`. It generates skeleton files with TODOs — no AI, no dependencies beyond the project itself.

```bash
# Shorthand: flow g
npx tsx tools/cli/index.ts generate <type> <path> [flags]
```

### `flow g route <path>`

Creates the three files every route needs plus a layout:

```bash
npx tsx tools/cli/index.ts g route app/bookings/new
```

| File | What it generates |
|------|-------------------|
| `entry.ts` | Empty Zod schema, `href()` and `parse()` stubs |
| `contract.ts` | `createRoute({ entry, exits: {} })` — no exits wired |
| `page.tsx` | Async server component with commented-out entry parsing, `<Shell.FullPage>` wrapper |
| `layout.tsx` | Pass-through layout ready for guards |

After running, fill in:
1. Define entry params in `entry.ts`
2. Wire exits in `contract.ts`
3. Compose Shell + Section in `page.tsx`
4. Add guard logic in `layout.tsx` if needed

### `flow g section <path> [flags]`

Creates a section folder with the files matching the section type.

```bash
# Interactive — prompts for each flag
npx tsx tools/cli/index.ts g section app/bookings/new/_components/CreateBookingForm

# Explicit flags
npx tsx tools/cli/index.ts g section app/bookings/new/_components/CreateBookingForm --client --mutates
```

**Flags:**

| Flag | What it adds |
|------|-------------|
| `--client` | `transition.ts`, `scene.ts`, `'use client'` on component |
| `--fetches` | Server: `deps.ts`, `query.ts`, `tags.ts`. Client: `useXxxLoader.ts` + loader in `actions.ts` |
| `--mutates` | `actions.ts` with mutation template |

**What gets generated for `--client --mutates`:**

| File | Contents |
|------|----------|
| `state.ts` | Four-state union: `idle`, `submitting`, `error`, `success` with `redirectTo` |
| `transition.ts` | `switch (state.status)` with standard transitions |
| `scene.ts` | `createScene(transition)` |
| `fixtures.ts` | One fixture per state variant |
| `actions.ts` | `'use server'` mutation accepting `FormData`, returning `{ success } \| { error }` |
| `Component.tsx` | Three-hook pattern: `useScene` + `useFormValues` + `useRedirectOnSuccess`, `<form action={fn}>`, `defaultValue` on inputs |
| `Component.stories.tsx` | Four stories with `shell: true` parameter |

After running, fill in:
1. Define actual state variants and domain data in `state.ts`
2. Add domain-specific transitions in `transition.ts`
3. Replace TODO redirects in `fixtures.ts`
4. Implement validation and mutation in `actions.ts`
5. Add form fields with `defaultValue={form.values.xxx}` in the component
6. Wire `route.exits.*()` into the SUCCESS dispatch

### Path conventions

Routes live at the page level:
```bash
flow g route app/bookings/new          # ✓
flow g route app/bookings/_components  # ✗ error
```

Sections live inside `_components/`:
```bash
flow g section app/bookings/new/_components/CreateBookingForm  # ✓
flow g section app/bookings/new/CreateBookingForm              # ✗ error
```

---

## Claude Code — slash commands

Three slash commands available in Claude Code (CLI, desktop, web, IDE extensions). They call the CLI for boilerplate, then fill in the TODOs with real domain code.

### `/scaffold-route <path>`

Runs `flow g route`, then edits the generated files based on context:
- Fills in the Zod schema from the URL structure
- Wires exits by finding sibling routes
- Composes the page with the right Shell and Section

```
/scaffold-route app/bookings/new
```

### `/scaffold-section <description>`

Determines flags from the description, runs `flow g section`, then fills in all TODOs:
- Writes real state variants with domain data
- Implements the server action with validation and cache invalidation
- Builds the form with actual fields, labels, and error handling

```
/scaffold-section a form section for creating a booking, with service and date fields, at app/bookings/new/_components/CreateBookingForm
```

### `/scaffold-feature <description>`

Orchestrates multiple route and section scaffolds for an entire feature:
- Creates data model if needed
- Sets up cache tags
- Generates all routes with exits wired between them
- Generates all sections with real domain logic
- Adds layout guards if needed

```
/scaffold-feature An appointment booking flow: a list page showing upcoming appointments, and a create form with service and date fields. After booking, redirect to the detail page.
```

---

## When to use which

| Situation | Command |
|-----------|---------|
| Want skeleton files to fill in manually | `flow g route` / `flow g section` |
| Want AI to fill in domain logic | `/scaffold-route` / `/scaffold-section` |
| Starting a feature from scratch with AI | `/scaffold-feature` |
| Adding a page to an existing feature | `flow g route` or `/scaffold-route` |
| Adding a component to an existing page | `flow g section` or `/scaffold-section` |
| Non-interactive environment (CI, scripts) | `flow g` with explicit flags |

Both paths produce the same file structure and follow the same conventions. The CLI gives you control; the Claude commands give you speed.
