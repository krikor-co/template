# Pitfalls (read before building)

Concrete traps hit while building on this framework, each with the fix. Most cost a debug cycle the first time — don't relearn them. Framework-generic entries live here; app-specific traps go in `.claude/agents/app-navigation.md` or agent memory.

## Server actions / Effect / Next

- **`export type { X }` in a `'use server'` file** → the bundler re-emits it as a *value* re-export → `ReferenceError: X is not defined` at runtime (500 + a cryptic client error). **Fix:** never re-export a type from a `'use server'` module; import the type directly where it's needed.
- **Soft `router.push` after a server action that set a cookie** (e.g. minted a new session) **does not pick up the new session** — the navigation no-ops or lands on the wrong guard. **Fix:** for auth-changing redirects, hard-navigate: `window.location.assign(route.exits.x(...))` (still a typed exit, just a full load).
- **Boundary result shapes:** `runAction` returns an `ActionResult` whose failure is `{ success: false, error: <message string>, kind: <error _tag>, fieldErrors? }` — match on `r.error` / `r.kind`, **not** `r.message`; Zod field errors arrive as `r.fieldErrors` (`lib/effect/run-action.ts`; the same shape is the `BoundaryFailure` passed to `mapResult`'s `custom` hook). `mapResult` then flattens it to the `{ success: false, error }` shape sections consume — no `kind`/`fieldErrors` on its output (`lib/effect/boundary.ts`).
- **Next 16 Cache Components:** a `'use cache'` body **cannot** read cookies / session / `searchParams`. Resolve locale + session at the component layer and thread them in as params. Layouts use **cookies**, never `searchParams`, for flow metadata (e.g. `returnTo`).
- **Effect:** no `Effect.gen` — pure `pipe` + `Effect.Do`. `filterOrFail` does NOT narrow `T | undefined`; use `Effect.flatMap` with an explicit null check. Wrap server-action bodies in `runAction(pipe(...), {actionName, attributes})`, cached queries in `runQuery` after `tagWith` + `withCacheProfile`.

## Migrations (drizzle)

- **The template's migration story is a single regenerated baseline** — do NOT hand-append migration files. Schema change → edit `db/schema/*`, then `rm -rf drizzle && npx drizzle-kit generate --name baseline`. `scripts/migrate.mjs` applies `./drizzle` forward-only at build; `db:deploy` keeps drizzle-kit. Once an app is live with real data, switch to additive migrations and stop regenerating.

## i18n (`lib/i18n/messages.ts`)

- TS-enforced: a new key MUST be added to **every seeded locale (en / pt-BR)** AND the `Messages` **type** block, or the build fails. Anchor each Edit on a unique sibling line per locale. For a visual/redesign sweep, **don't add i18n at all** (keeps agents conflict-free).

## UI / primitives

- **Button is full-width (`block`) by default.** Inline buttons need `block={false}` or they blow out the layout. `className` still wins via tailwind-merge (`w-auto` overrides `w-full`).
- **Design tokens only** — no raw hex / `bg-white` / `bg-gray-*` / `text-slate-*`. Use `bg-background` / `bg-card` / `text-muted-foreground`, the accent triads (`brand`/`accent`/`info`/`success`/`warning`/`destructive` with `-soft`/`-deep`/`-foreground` roles) and the `tone-*` scale. (See `docs/design-tokens.md`.)

## Tooling / loop

- **Stale `.next`** after deleting files or changing tokens/tailwind → `rm -rf .next`. Tailwind's incremental cache chokes on deleted files (500s).
- **Edit "file not read" / "modified since read"** — Read the file with the **Read tool** (not a Bash `cat`/`grep`) immediately before editing. Bulk greps don't register the file for Edit.
- **HMR lag** — a verification that fails seconds after an edit is often serving stale code. Retest before assuming a regression.
- **Don't trust agent self-reports.** "eslintClean: true" / "it renders" — re-verify with full `tsc` + `visit.mjs` + a DB query. Distinguish NEW lint from pre-existing (`git show HEAD:file | eslint --stdin`).
- **Workflow `args`** reaches the script unreliably — inline the work-list as a literal.
