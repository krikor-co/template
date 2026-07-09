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

**The `docs/` directory is a living documentation site served at `/docs`.** It ships with the template and is meant to be updated as the application evolves — add domain-specific patterns, conventions, and decisions. When adding new framework-level patterns or changing existing ones, update the relevant doc file.

**For depth on any concept, read the relevant doc file in `docs/`:**

| Doc | What it covers |
|-----|---------------|
| [`overview.md`](docs/overview.md) | What the template is, how to get started, reading order |
| [`pages.md`](docs/pages.md) | Page layer, hierarchy, system overview |
| [`routing.md`](docs/routing.md) | RouteRegistry, entry.ts, contract.ts, exits |
| [`shells.md`](docs/shells.md) | Shell types + full implementation |
| [`sections.md`](docs/sections.md) | 6 section types, state machines, file map |
| [`caching.md`](docs/caching.md) | CacheRegistry, tags, invalidation patterns |
| [`guards.md`](docs/guards.md) | Layout guards, Suspense guard shells, throw-based guards, gate topology, transition guards, cookie returnTo |
| [`rate-limiting.md`](docs/rate-limiting.md) | createRateLimit, key strategy, storage |
| [`tenancy.md`](docs/tenancy.md) | Workspaces, memberships, invites, host→workspace middleware, workspace guards |
| [`feature-flags.md`](docs/feature-flags.md) | Feature registry, 3-scope overrides (global/workspace/user), fail-open nav gating |
| [`i18n.md`](docs/i18n.md) | Locale resolution chain, `t(locale)` messages, Intl formatters, timezone + theme providers |
| [`storybook.md`](docs/storybook.md) | Story patterns, co-location, running |
| [`design-tokens.md`](docs/design-tokens.md) | Accent triads, tone scale, typography/radius/shadow tokens, palette swap procedure |
| [`data-flow.md`](docs/data-flow.md) | Load/mutation/client-fetch, Effect boundary (runAction/runQuery), worked examples |
| [`declarative-flows.md`](docs/declarative-flows.md) | Action-first design, state machines |
| [`links.md`](docs/links.md) | Link-primitive decision tree — OriginLink / ContextualBackLink / PreserveSearchLink / BackLink |
| [`flow-params.md`](docs/flow-params.md) | `?from=` lifecycle — withFrom, useReturnTo, useDropFlowParam, useKeepQs |
| [`forms.md`](docs/forms.md) | useFormValues, value persistence, validation, controlled vs uncontrolled |
| [`schema.md`](docs/schema.md) | Entity-first database modeling |
| [`commands.md`](docs/commands.md) | Scaffold commands for routes, sections, features |
| [`planning.md`](docs/planning.md) | Design flow specs, planning process, implementation handoff |
| [`billing.md`](docs/billing.md) | Workspace billing: Stripe gates, escape-route topology, cancel/resume, webhook |
| [`capabilities.md`](docs/capabilities.md) | Capability Registry — one operation, one definition; AI tools are GENERATED |
| [`blob.md`](docs/blob.md) | Vercel Blob uploads: `uploadImage` action, authed `/api/blob-image` proxy, ImageUpload/AvatarField |
| [`realtime.md`](docs/realtime.md) | Workspace pulse: best-effort liveness bump + SSE nudge, `<WorkspaceLive>` |
| [`cron.md`](docs/cron.md) | Cron convention: fail-closed `CRON_SECRET` gate, job catalog, per-tenant local-hour fan-out |

---

## New feature checklist

```
□ Planning a feature?         → /design-flow → .claude/specs/<name>.md
□ New URL/page?               → entry.ts + contract.ts + page.tsx
□ Non-primitive UI component? → section folder (state.ts + fixtures.ts + Component.tsx minimum)
□ Component fetches?          → add deps.ts + query.ts + tags.ts (cached query body wraps in `runQuery(pipe(...))`)
□ Component mutates?          → add actions.ts with 'use server' (action body wraps in `runAction(pipe(...))`)
□ Client interactivity?       → add transition.ts + scene.ts, mark 'use client'
□ Client section that fetches?→ add useXxxLoader.ts + server action loader in actions.ts
□ Section has a `<form>`?     → add useFormValues(), capture in handleSubmit, defaultValue on inputs
□ Navigates on success?       → route.exits.*() — never raw URL strings
□ A new app OPERATION?        → define it ONCE as a Capability (lib/capabilities) — form/page call cap.run; AI tools are GENERATED from cap.ai (never hand-listed). See docs/capabilities.md
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
- `useScene` returns `[state, send, reset]` — always call `reset()` after `router.push` to prevent stale Router Cache loops (or use `useRedirectOnSuccess(state, reset)` — for form sections pass `[reset, form.reset]`)
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
- Gated layouts are sync Suspense shells: the guard's uncached I/O (cookies, session, DB) runs in an async child inside `<Suspense>`; `redirect()` fires inside the boundary; the fallback is footprint-matched (see `docs/guards.md` → "Suspense guard shells")
- Guard functions live in the feature layer (e.g. `app/auth/guards.ts`), never in `lib/`
- Layouts never use `searchParams` — flow metadata (like `returnTo`) travels via cookies
- Use `createTransitionGuard` from `lib/transition.ts` when exit animations must play before a layout redirect

**Effect (server actions + cached queries)**
- Every server action body is `runAction(pipe(...), { actionName, attributes: { workspaceId, ... } })` — `lib/effect/run-action.ts`
- Every `'use cache'` body is `runQuery(pipe(...), { queryName, attributes })` after `tagWith` + `withCacheProfile` — `lib/effect/run-query.ts`
- **No `Effect.gen`** — pure pipe + `Effect.Do` only. The whole codebase is one paradigm
- `T | undefined` narrowing → `Effect.flatMap` with explicit null check. **`filterOrFail` does NOT narrow**
- Auth inside the pipe → `requireSessionE()` / `requireAdminE()` / `requireWorkspaceRoleE(workspaceId, role)` (typed) — `lib/effect/auth.ts`
- DB calls → `dbE.try` / `dbE.findFirst` / `dbE.run` / `dbE.transaction` — `lib/effect/db.ts`. Transaction callback STAYS plain async; throw inside to roll back
- Cache invalidation → `cacheE.invalidate(Tag.X(...))` — `lib/effect/cache.ts`
- Validation → `validate(zodSchema, raw)` returns `Effect<T, ValidationFailed>` — `lib/effect/validate.ts`
- ID parsing → `parseIdE(raw, 'workspaceId')` from `lib/effect/parse.ts`. Never throw inside a pipe
- Boundary error mapping → `mapResult(result, { fallback, conflict, custom, ... })` from `lib/effect/boundary.ts` — replaces the per-action `switch (result.kind)` boilerplate
- Sentinel markers (for `ConflictError.message` routing) → add to and import from `lib/effect/markers.ts::Markers`. Never invent local marker constants
- Failures are tagged errors (`Forbidden | Unauthenticated | NotFound | ValidationFailed | RateLimited | Conflict | ExternalServiceError | DbError | Timeout | SubscriptionInactive` from `lib/effect/errors.ts`) — never untyped catches
- Default boundary timeout is 30s; tighten via `timeout: '5 seconds'` in opts. Always `Effect.timeoutFail` (typed), never plain `Effect.timeout`
- See [`docs/data-flow.md`](docs/data-flow.md) "Server actions and cached queries with Effect" for the full pattern + worked example

**Capabilities (the registry)**
- A new app operation = ONE `Capability` (`lib/capabilities`): `{ id, kind, schema, run, ai? }`. `run` is the EXISTING action/query — never a new mutation path or new math
- The form/page calls `cap.run(input)` (canonical `schema` input); never re-import the raw action where a capability exists
- AI tools are GENERATED from `cap.ai` (`lib/capabilities/tools.ts`) — never hand-list a tool that duplicates an operation
- Action caps register into an agent loop with NO `execute` — the model can only PROPOSE. Your confirm action is the SOLE mutation path: re-auth → re-validate → resolve → `cap.run` → audit
- The loop's generated write tool AND your confirm step share ONE spine — `capWriteExecute(cap)` (`resolve → run → summarize`) — so they can never diverge
- `workspaceId` always comes from `ctx` (`ai.resolve` injects it), NEVER an LLM arg; `resolve` is read-only (names→ids). Capabilities never navigate or import route contracts; auth stays inside `run`
- Log every model call fail-open via `recordAiCall` (`lib/ai/instrument.ts`); classify final turn outcomes with `lib/ai/outcome.ts` — infra failures are NEVER refusals

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
| Navigate after async work in a client component | `router.push(route.exits.next(...))` then `reset()` — or use `useRedirectOnSuccess(state, reset)` (form sections: `[reset, form.reset]`) |
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
| Route needs access control | Layout guard — sync layout + Suspense'd async shell; guard fn in feature layer; redirect inside the boundary (docs/guards.md) |
| New app operation (create/update/list/…) | Define ONE Capability (`lib/capabilities`); form/page call `cap.run` — `docs/capabilities.md` |
| Want an AI assistant to read/propose an operation | Add an `ai` block to its Capability — never hand-write a tool |
| Action triggers animation before redirect | Transition guard — `grant()` in action, `isActive()` in layout |
| Writing a new server action | `runAction(pipe(Effect.Do, ...), { actionName, attributes: { workspaceId } })` |
| Writing a new cached query | `'use cache'` + `tagWith` + `withCacheProfile` + `return runQuery(pipe(...), { queryName, attributes })` |
| Action needs to fail with a domain error | `Effect.fail(new NotFound({ entity: 'person', id }))` from `lib/effect/errors.ts` |
| DB transaction with multiple writes | `dbE.transaction(async (tx) => { ... throw to rollback })` — keep callback plain async |

---

## Available skills

```
/design-flow       — collaborative spec-writing session for planning features as visual flow diagrams
/scaffold-route    — creates entry.ts + contract.ts + page.tsx
/scaffold-section  — creates a complete section folder
/scaffold-feature  — builds a complete feature from a plain-English description
```
