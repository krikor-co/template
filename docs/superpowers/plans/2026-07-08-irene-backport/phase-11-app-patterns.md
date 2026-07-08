# Phase 11: App Patterns + Docs Sweep — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Land the app-level patterns irene proved out — Suspense guard shells on the dashboard chokepoint, gate-topology + onboarding-checklist-gate documentation, a production session gate on `/docs`, the server-side pagination/URL-state primitives (`ListPager`, `ListSearchBox`, `useListSearch`) — and close with the schema-doc backfill and the final CLAUDE.md doc-index sweep.

**Depends on phases:** 3, 4, 6

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE source repo: `/Users/luca/dev/winter-park/irene` (read-only reference).
- Guard names (phase 6 landed these — this phase consumes, never redefines): `requireSession(): Promise<SessionPayload>` + `class SessionGuardError extends Error { reason: 'unauthenticated' | 'forbidden' }` from `@/lib/auth/session`; `requireWorkspaceRole(workspaceId: string, role: string | string[]): Promise<void>` + `WorkspaceGuardError` from `@/app/workspace/guards`; `requireAdmin(): Promise<void>` + `AdminGuardError` from `@/app/admin/guards`. Effect adapters `requireSessionE`, `requireWorkspaceRoleE`, `requireAdminE` in `lib/effect/auth.ts` (phase 3/6).
- Copy: English defaults only; all user-facing copy overridable via props or `lib/i18n` messages. No hardcoded pt-BR anywhere. The pagination primitives take all labels as props (no message keys needed).
- Navigation: never raw URL strings — typed entries/exits only. `/docs` gets its own minimal `entry.ts` so its gate redirect stays typed.
- Tenant concept is `workspace` everywhere irene says salon.
- Utility renames fixed by phase 2 (relevant here only as things to NOT carry over): `shadow-bento` → `shadow-card`. **This phase does NOT depend on phase 2**, so ported components use `border border-border` instead of any shadow token — safe under every phase ordering the index allows (`{9, 10, 11}` may run right after 6, before 2's parallel track is guaranteed merged into the worktree you execute in — and even though 2 practically precedes 11 on one branch, the dependency declaration is the contract).
- Ported components must not consume phase 8 outputs (CVA Button, `inputChrome`) — phase 8 is not a dependency. `ListPager` uses plain `<button>` elements; `ListSearchBox` uses the template's existing `components/ui/Input.tsx` (present since before this backport).
- Docs travel with code: this phase edits `docs/guards.md`, `docs/pages.md`, `docs/schema.md` (backfill only), and `CLAUDE.md`. Anchor every docs/CLAUDE.md edit on headings/exact row text, never line numbers (phases 1–8 shift offsets).
- Docs served at `/docs` use frontmatter `title` / `order` / `category`; this phase creates NO new doc files (sections append into existing ones), so no frontmatter work.
- Verification gate per task: at minimum `npx tsc --noEmit` clean, plus task-appropriate greps. Full build/migrate/browser verification defers to phase 13's gate when no scratch `DATABASE_URL` is configured.
- Every task ends with a git commit; message trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- No new unit tests in this phase: every code change is a straight port (`ListPager`/`ListSearchBox`/`useListSearch` — logic byte-equivalent to irene's, renames + styling only) or a layout/docs rewrite with no extractable pure function. Runtime behavior is exercised by phase 13's smoke/browser gate.

---

### Task 11.1: Rewrite `app/dashboard/layout.tsx` as a Suspense guard shell

**Files:**
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/dashboard/layout.tsx` (currently 11 lines: async layout, top-level `getSession()` await, `redirect(route.exits.login())`)

**Interfaces:**
- Consumes: `requireSession(): Promise<SessionPayload>` + `SessionGuardError` from `@/lib/auth/session` (phase 6 Task 6.3 gave `requireSession` its typed sentinel); `route.exits.login(): string` from `@/app/dashboard/contract` (unchanged by phase 6, which only ADDED `onboarding`/`workspace` exits); phase 6's `app/dashboard/page.tsx` fallback frame (`mx-auto w-full max-w-3xl px-4 py-12`) — this layout's fallback footprint-matches it.
- Produces: the template's canonical Suspense-guard-shell worked example, quoted verbatim in Task 11.2's `docs/guards.md` section. Exports only the default layout (no new public API).

**Why:** the old layout `await`s `getSession()` (cookie read + sessions-table lookup — uncached I/O) at the top level, which under Next 16 Cache Components blocks route navigation until the guard resolves. Irene's shape (`/Users/luca/dev/winter-park/irene/app/salon/[salonId]/owner/layout.tsx` lines 90–108, 237–247): sync layout → `<Suspense>` → async shell doing the guard + `redirect()` inside the boundary, with a footprint-matched skeleton fallback.

**Steps:**

- [ ] Step: replace the entire content of `/Users/luca/dev/winter-park/template/app/dashboard/layout.tsx` with exactly:

```tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requireSession, SessionGuardError } from '@/lib/auth/session'
import { route } from './contract'

/**
 * Dashboard chokepoint guard, in the Suspense guard shell shape
 * (docs/guards.md → "Suspense guard shells"):
 *
 *   sync layout → <Suspense fallback> → async shell (uncached I/O + redirect)
 *
 * The layout itself is SYNC so route navigation streams immediately; the
 * session check (cookie read + sessions-row lookup — uncached I/O under
 * Next 16 Cache Components) resolves inside the boundary, and redirect()
 * still works when thrown from within it.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardGuardFallback />}>
      <DashboardGuard>{children}</DashboardGuard>
    </Suspense>
  )
}

async function DashboardGuard({ children }: { children: React.ReactNode }) {
  try {
    await requireSession()
  } catch (err) {
    // Only the guard's own sentinel maps to a redirect — anything else is a
    // real bug and must surface, not silently bounce users to login.
    if (err instanceof SessionGuardError) redirect(route.exits.login())
    throw err
  }
  return <>{children}</>
}

/**
 * Footprint-matched fallback: mirrors the dashboard page's outer frame
 * (mx-auto max-w-3xl px-4 py-12 — see app/dashboard/page.tsx) so the
 * fallback → content swap doesn't shift layout.
 */
function DashboardGuardFallback() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12" aria-busy="true">
      <div className="space-y-8">
        <div className="h-24 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </main>
  )
}
```

- [ ] Step: sanity-check the consumed guard exists in its phase-6 shape — Run: `grep -n "class SessionGuardError" /Users/luca/dev/winter-park/template/lib/auth/session.ts` → expected: one match. If ZERO matches (phase 6 Task 6.3 not yet applied in this worktree), STOP and execute that task first — do not inline a duplicate error class here.
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add app/dashboard/layout.tsx
  git commit -m "refactor(dashboard): Suspense guard shell — sync layout, guard + redirect inside the boundary

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 11.2: `docs/guards.md` — "Suspense guard shells" section + CLAUDE.md invariant

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/docs/guards.md` (append one section at end; at this point the file ends with phase 6's `## Throw-based data guards` section, whose final line is `` `Forbidden` failures inside the pipe. ``)
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (Layout-guards invariant bullet, quick-decision-guide row, guards.md doc-table row)

**Interfaces:**
- Consumes: Task 11.1's layout (quoted verbatim as the worked example); phase 6's `## Throw-based data guards` section (referenced, not duplicated).
- Produces: `docs/guards.md` → "Suspense guard shells" section that Tasks 11.3/11.4 and phase 12's agents reference.

**Steps:**

- [ ] Step: append to `/Users/luca/dev/winter-park/template/docs/guards.md` (after the file's final line) this exact content:

````markdown

## Suspense guard shells

Guard checks are uncached I/O — `cookies()`, the sessions-table lookup,
membership queries. Under Next 16 Cache Components, a layout that `await`s
that I/O at its top level **blocks route navigation**: nothing paints until
the guard resolves. Gated layouts therefore use a three-part shape:

```
sync layout  →  <Suspense fallback={<Fallback/>}>  →  async shell
                                                       (uncached I/O +
                                                        redirect inside
                                                        the boundary)
```

1. The **layout is sync** and returns immediately — navigation streams at
   once.
2. An **async shell child** does every uncached read (guard, providers,
   chrome data) and calls `redirect()` on failure. `redirect()` works when
   thrown inside a Suspense boundary.
3. The **fallback is footprint-matched**: it mirrors the shell's outer frame
   (same max-width / padding / grid skeleton) so the fallback → content swap
   doesn't shift layout.

Worked example — the template's own `/dashboard` chokepoint
(`app/dashboard/layout.tsx`), pairing the shape with the throw-based
`requireSession` guard (see "Throw-based data guards" above):

```tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requireSession, SessionGuardError } from '@/lib/auth/session'
import { route } from './contract'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardGuardFallback />}>
      <DashboardGuard>{children}</DashboardGuard>
    </Suspense>
  )
}

async function DashboardGuard({ children }: { children: React.ReactNode }) {
  try {
    await requireSession()
  } catch (err) {
    // Only the guard's own sentinel maps to a redirect — anything else is a
    // real bug and must surface, not silently bounce users to login.
    if (err instanceof SessionGuardError) redirect(route.exits.login())
    throw err
  }
  return <>{children}</>
}

function DashboardGuardFallback() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12" aria-busy="true">
      <div className="space-y-8">
        <div className="h-24 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </main>
  )
}
```

Rules:

- Never `await` guard I/O in the layout body — always inside the Suspense'd
  child.
- Catch only your own guard error (`instanceof XxxGuardError`); **rethrow
  everything else** so real failures surface instead of masquerading as
  auth bounces.
- Keep the fallback in the same file, footprint-matched to the area's frame.
  A `min-h-screen` spinner that doesn't match the frame causes a visible
  jump on every navigation into the area.
- The same shape applies to gated **pages** that redirect — the `/dashboard`
  dispatcher (`app/dashboard/page.tsx`) and the workspace home
  (`app/workspace/[workspaceId]/page.tsx`) resolve their uncached I/O inside
  their own Suspense children for the same reason.
- As a gated layout grows chrome (sidebar, providers), the chrome moves into
  the async shell too — guard first, then chrome data, one boundary.
````

- [ ] Step: edit `/Users/luca/dev/winter-park/template/CLAUDE.md` — three anchored edits:
  1. In the `**Layout guards**` block under `## Critical invariants`, directly after the bullet
     `- Layouts are the middleware layer — all route-level access control lives in layouts`
     insert:
     `- Gated layouts are sync Suspense shells: the guard's uncached I/O (cookies, session, DB) runs in an async child inside `<Suspense>`; `redirect()` fires inside the boundary; the fallback is footprint-matched (see `docs/guards.md` → "Suspense guard shells")`
  2. In the `## Quick decision guide` table, replace the row
     `| Route needs access control | Layout guard — redirect in layout, guard fn in feature layer |`
     →
     `| Route needs access control | Layout guard — sync layout + Suspense'd async shell; guard fn in feature layer; redirect inside the boundary (docs/guards.md) |`
  3. In the docs table, replace the row
     ``| [`guards.md`](docs/guards.md) | Layout guards, transition guards, cookie returnTo |``
     →
     ``| [`guards.md`](docs/guards.md) | Layout guards, Suspense guard shells, throw-based guards, gate topology, transition guards, cookie returnTo |``
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && grep -c "Suspense guard shells" docs/guards.md CLAUDE.md` → expected: `docs/guards.md:1` (heading) or higher, `CLAUDE.md:≥1`. Run: `npx tsc --noEmit` → expected: exit 0 (docs-only; sanity gate).
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add docs/guards.md CLAUDE.md
  git commit -m "docs(guards): Suspense guard shell pattern + worked requireSession example, CLAUDE.md invariant

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 11.3: `docs/guards.md` — "Gate topology" + "Onboarding-checklist gates" sections

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/docs/guards.md` (append two sections at end; after Task 11.2 the file ends with the "Suspense guard shells" section, final line `guard first, then chrome data, one boundary.`)

**Interfaces:**
- Consumes: phase 6's real routes as examples (`app/workspace/[workspaceId]/layout.tsx` chokepoint, `/onboarding` sibling, `/dashboard` redirect target).
- Produces: docs-only. The onboarding-checklist section is the distilled lesson of irene's wizard→checklist arc (commits `8729794` replace-wizard-with-checklist, `d76c19e` delete dead wizard, `16c6172` profile-driven locked checklist, `a1c3aeb` dashboard→setup lock in owner layout, `5622368` reachable escape hatch + gate-to-checklist-not-wizard) and its gate predicate (`/Users/luca/dev/winter-park/irene/lib/onboarding/gate.ts`) + readiness module (`/Users/luca/dev/winter-park/irene/app/salon/[salonId]/setup/_lib/readiness.ts`). NO code ports — pattern only, per spec.

**Steps:**

- [ ] Step: append to `/Users/luca/dev/winter-park/template/docs/guards.md` (after the file's final line) this exact content:

````markdown

## Gate topology

Where gates LIVE matters as much as what they check. Three rules keep gated
areas loop-free:

**1. One chokepoint layout per protected area.** Every check for an area
chains in a single layout, ordered by severity — auth first, then
business gates (subscription, setup lock, …). Pages under it never
re-implement the gate. The template's chokepoints: `app/dashboard/layout.tsx`
(session) and `app/workspace/[workspaceId]/layout.tsx` (workspace role).

**2. Escape routes are ungated siblings.** Every redirect target of a gate
must live OUTSIDE the layout that issues the redirect, or the gate re-runs
on arrival and loops forever. In the template: the dashboard guard bounces
to `/auth/identify` (not under `/dashboard`); the workspace guard's
`forbidden` branch bounces to `/dashboard` (not under `/workspace`); the
dispatcher's zero-membership branch bounces to `/onboarding` (a sibling of
`/dashboard`, deliberately not under it). When you add a paywall gate,
its `/subscribe`-style target must be a sibling of the gated area for the
same reason.

**3. Route groups keep same-prefix public routes out of the gate.** When a
public page must share a URL prefix with a gated area, use a route group —
groups add no URL segment, which is exactly what makes this work:

```
app/workspace/[workspaceId]/(gated)/layout.tsx   ← the chokepoint guard
app/workspace/[workspaceId]/(gated)/settings/…   ← gated, URL /workspace/:id/settings
app/workspace/[workspaceId]/join/page.tsx        ← public, URL /workspace/:id/join
```

Without the group, the only alternatives are gating `join` (breaking the
public flow) or moving it to an unrelated prefix (breaking the URL design).

## Onboarding-checklist gates

The distilled lesson of a ~100-commit arc in a production app built on this
template: a multi-step onboarding WIZARD that must complete before the app
unlocks fights the user — blank re-entry (wizards rarely rehydrate persisted
answers), lost progress, no escape. The shape that survived:

1. **A checklist route, not a wizard.** One page (e.g. `/workspace/:id/setup`)
   listing setup items grouped by importance ("essential" vs "later"). Each
   row links to the REAL feature screen where the work happens — the
   checklist owns no forms of its own.
2. **Per-item readiness predicates derive ✓ from real data.** Never store
   "step 3 done" flags. Compute each item from the tables the item is about
   (e.g. `services` is done when the workspace has ≥ 1 active service row;
   `payment` when a payment option exists). Re-entry is always accurate and
   there is nothing to hydrate. Keep the predicates in one pure, unit-tested
   module returning `{ items: Record<ItemKey, boolean>, essentialsDone,
   visibleKeys, essentialKeys }` — visibility and essentials may vary by
   tenant profile (a solo workspace drops the "invite your team" item).
3. **The layout lock is a chokepoint gate with a release valve.** The area
   layout (topology rule 1) bounces to the checklist ONLY while onboarding
   has started AND is neither completed nor dismissed. Store
   `completedAt` / `dismissedAt` timestamps on a per-workspace setup row;
   the whole gate is one pure predicate:

   ```typescript
   // Bounce ONLY a workspace that started onboarding (row present with
   // signals) but hasn't finished and hasn't opted out. Pre-existing
   // workspaces (no row) are never trapped.
   export function shouldBounceToSetup(
     row: { signals: unknown; completedAt: Date | null; dismissedAt: Date | null } | null,
   ): boolean {
     if (!row) return false
     if (row.completedAt || row.dismissedAt) return false
     return row.signals != null
   }
   ```

4. **The checklist route is an escape sibling** (topology rule 2): it lives
   OUTSIDE the locked layout and always renders a reachable skip/dismiss
   action — the lock must never dead-end. Bounce to the CHECKLIST, never
   into a wizard step.

Ship the gate as three pieces: a cached readiness/gate-state query, the pure
gate predicate (unit-testable, like the snippet above), and the layout
chokepoint calling both inside its Suspense shell.
````

- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && grep -c "^## " docs/guards.md` → expected: ≥ 9 (the original 5 `##` sections + Throw-based data guards + Suspense guard shells + Gate topology + Onboarding-checklist gates). Run: `grep -n "salon\|Irene\|pt-BR" docs/guards.md` → expected: no output.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add docs/guards.md
  git commit -m "docs(guards): gate topology rules + onboarding-checklist gate pattern (wizard arc distilled)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 11.4: Gate `/docs` behind a session in production

**Files:**
- Create: `/Users/luca/dev/winter-park/template/app/docs/entry.ts`
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/docs/layout.tsx` (currently 25 lines: sync, ungated, grid chrome + Sidebar)

**Interfaces:**
- Consumes: `getSession(): Promise<SessionPayload | null>` from `@/lib/auth/session`; `entry.href(p?: { returnTo?: string }): string` from `@/app/auth/identify/entry`.
- Produces: `entry` with `href(): string` (`/docs`) from `@/app/docs/entry` — used by the gate's own `returnTo` and available to any app link to the handbook.

**Why session-only, production-only:** the `/docs` site is the internal architecture handbook — publicly serving it in production leaks the whole system design (irene gated it in commit `54a5373`). Irene additionally required `role === 'admin'`; the template gates on session only (any authenticated user is a team member on a fresh template project — apps tighten to `requireAdmin()` when they grow real end-users). In development it stays open: docs are read most while building, often before auth is even configured. Irene's raw `'/auth/identify'` string is replaced with the typed identify entry.

**Steps:**

- [ ] Step: create `/Users/luca/dev/winter-park/template/app/docs/entry.ts` with exactly (mirrors `app/dashboard/entry.ts`'s param-less shape):

```ts
import type { ParseContext } from '@/lib/route-registry'

export type Params = Record<string, never>

export const entry = {
  href:  (_p: Params = {} as Params) => '/docs',
  parse: (_ctx: ParseContext) => ({} as Params),
}
```

- [ ] Step: replace the entire content of `/Users/luca/dev/winter-park/template/app/docs/layout.tsx` with exactly (Suspense guard shell per Task 11.2's doc; the grid/aside/main chrome is the existing file's markup, unchanged):

```tsx
import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { entry as identifyEntry } from '@/app/auth/identify/entry'
import { entry } from './entry'
import { Sidebar } from './_components/Sidebar'

/**
 * /docs is the internal architecture handbook. In production it is gated
 * behind a session — serving it anonymously would leak the whole system
 * design. In development it stays open (docs are read most while building,
 * often before auth is even configured).
 *
 * Suspense guard shell (docs/guards.md → "Suspense guard shells"): the
 * layout stays sync, the session check (uncached cookie + DB I/O) resolves
 * inside the boundary, and the redirect fires from within it. Apps with
 * real end-users should tighten this to requireAdmin() (app/admin/guards.ts).
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DocsFallback />}>
      <DocsShell>{children}</DocsShell>
    </Suspense>
  )
}

async function DocsShell({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    const session = await getSession()
    if (!session) redirect(identifyEntry.href({ returnTo: entry.href() }))
  }

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="sticky top-0 h-screen overflow-y-auto border-r border-border px-4 py-6">
        <Link
          href={entry.href()}
          className="mb-6 flex items-center gap-2 px-3 text-sm font-semibold tracking-tight"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
            F
          </span>
          Flow Docs
        </Link>
        <Sidebar />
      </aside>
      <main className="overflow-y-auto px-8 py-10 lg:px-16">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  )
}

/** Footprint-matched to the docs grid so the swap doesn't shift layout. */
function DocsFallback() {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]" aria-busy="true">
      <aside className="border-r border-border px-4 py-6">
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
      </aside>
      <main className="px-8 py-10 lg:px-16">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-40 w-full animate-pulse rounded bg-muted" />
        </div>
      </main>
    </div>
  )
}
```

  Enumerated deltas vs the old file: (1) added `Suspense`/`redirect`/`getSession`/`identifyEntry`/`entry` imports; (2) sync `DocsLayout` now only mounts the boundary; (3) chrome moved verbatim into async `DocsShell` with the production session check ahead of it; (4) the sidebar `Link href="/docs"` raw string → `entry.href()`; (5) new `DocsFallback`. Nothing else in the chrome markup changed.
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -n "'/docs'\|\"/docs\"" app/docs/layout.tsx` → expected: no output (the only `/docs` literal lives in `app/docs/entry.ts`).
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add app/docs/entry.ts app/docs/layout.tsx
  git commit -m "feat(docs): gate /docs behind a session in production (typed-entry redirect, open in dev)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 11.5: Port `useListSearch` + `ListSearchBox` (URL-state keyword search)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/list/useListSearch.ts` (source: `/Users/luca/dev/winter-park/irene/app/salon/[salonId]/owner/_primitives/useListSearch.ts`, 32 lines)
- Create: `/Users/luca/dev/winter-park/template/components/ui/ListSearchBox.tsx` (source: `/Users/luca/dev/winter-park/irene/app/salon/[salonId]/owner/_primitives/ListSearchBox.tsx`, 41 lines)

**Interfaces:**
- Consumes: `Input` from `@/components/ui/Input` (pre-existing template primitive, passthrough `React.InputHTMLAttributes`); `cn` from `@/lib/utils`; `Search` icon from `lucide-react` (`^0.462.0`, already a template dep).
- Produces: `useListSearch(initialValue?: string): { value: string; setValue: (v: string) => void }` from `@/lib/list/useListSearch`; `ListSearchBox({ initialValue?: string; placeholder: string; className?: string }): JSX.Element` from `@/components/ui/ListSearchBox`. Both `'use client'`. Task 11.7's doc and any app list page consume these. (Note: `lib/list/` is shared with phase 7's `normalize.ts` — whichever phase runs first creates the directory; no file overlap.)

**Steps:**

- [ ] Step: copy sources —
  ```
  mkdir -p /Users/luca/dev/winter-park/template/lib/list
  cp "/Users/luca/dev/winter-park/irene/app/salon/[salonId]/owner/_primitives/useListSearch.ts" /Users/luca/dev/winter-park/template/lib/list/useListSearch.ts
  cp "/Users/luca/dev/winter-park/irene/app/salon/[salonId]/owner/_primitives/ListSearchBox.tsx" /Users/luca/dev/winter-park/template/components/ui/ListSearchBox.tsx
  ```
- [ ] Step: apply generalization edits to `/Users/luca/dev/winter-park/template/lib/list/useListSearch.ts` — exactly two edits, both in the doc comment (lines 6–13; the hook body ports byte-identical):
  1. Line 7: `Debounced `?q=` search hook for owner LIST pages. Owns the input value plus` → `Debounced `?q=` search hook for server-paginated LIST pages. Owns the input value plus`
  2. Lines 10–12: `REPLACES the whole query string (dropping any `?page=`). Generic twin of the` / `customers list's `useCustomerSearch`; keeps `ListSearchBox.tsx` a pure` / `consumer per the section convention (hooks live in `.ts` files).` → `REPLACES the whole query string (dropping any `?page=`, so a new search` / `resets to page 1). Keeps `components/ui/ListSearchBox.tsx` a pure consumer` / `per the section convention (hooks live in `.ts` files).`
- [ ] Step: apply generalization edits to `/Users/luca/dev/winter-park/template/components/ui/ListSearchBox.tsx` — exactly three edits:
  1. Line 5 import: `import { useListSearch } from './useListSearch'` → `import { useListSearch } from '@/lib/list/useListSearch'`; and add `import { cn } from '@/lib/utils'` below the `Input` import.
  2. Doc comment lines 8–12: `ListSearchBox — debounced `?q=` search input for owner LIST pages. Pushes the` → `ListSearchBox — debounced `?q=` search input for server-paginated LIST pages. Pushes the`; and DELETE the line `* Generic sibling of the customers list's `CustomerSearchBox`.`
  3. Line 25 string concat → `cn`: `<div className={'relative max-w-xs ' + (className ?? '')}>` → `<div className={cn('relative max-w-xs', className)}>`
  Everything else (Search icon positioning, `type="search"`, `value`/`onChange`, `aria-label={placeholder}`, `className="pl-10"`) ports byte-identical. `placeholder` stays a REQUIRED prop — no hardcoded copy.
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -rn "owner\|salon\|Customer" lib/list/useListSearch.ts components/ui/ListSearchBox.tsx` → expected: no output.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add lib/list/useListSearch.ts components/ui/ListSearchBox.tsx
  git commit -m "feat(list): useListSearch hook + ListSearchBox — debounced ?q= URL-state search

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 11.6: Port `ListPager` (server-pagination footer with transition-dimmed rows)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/useListPager.ts` (source: `/Users/luca/dev/winter-park/irene/app/salon/[salonId]/owner/_primitives/useOwnerListPager.ts`, 24 lines)
- Create: `/Users/luca/dev/winter-park/template/components/ui/ListPager.tsx` (source: `/Users/luca/dev/winter-park/irene/app/salon/[salonId]/owner/_primitives/OwnerListPager.tsx`, 86 lines)

**Interfaces:**
- Consumes: `ChevronLeft`, `ChevronRight` from `lucide-react`; `cn` from `@/lib/utils`. Deliberately does NOT consume `components/ui/Button` (the CVA `variant`/`size`/`block` API lands in phase 8, which is not a dependency of this phase — a plain `<button>` with an equivalent class string keeps this task order-independent).
- Produces: `useListPager(): { isPending: boolean; go: (href: string | null) => void }` from `@/components/ui/useListPager`; `ListPager({ prevHref: string | null; nextHref: string | null; rangeLabel: string; pageLabel: string; prevLabel: string; nextLabel: string; navLabel?: string; children: React.ReactNode }): JSX.Element` from `@/components/ui/ListPager`. Both `'use client'`. Task 11.7's doc consumes these names. No Storybook story: the irene source had none (verified — `_primitives/` contains no `*.stories.tsx`).

**Steps:**

- [ ] Step: copy sources —
  ```
  cp "/Users/luca/dev/winter-park/irene/app/salon/[salonId]/owner/_primitives/useOwnerListPager.ts" /Users/luca/dev/winter-park/template/components/ui/useListPager.ts
  cp "/Users/luca/dev/winter-park/irene/app/salon/[salonId]/owner/_primitives/OwnerListPager.tsx" /Users/luca/dev/winter-park/template/components/ui/ListPager.tsx
  ```
- [ ] Step: apply generalization edits to `/Users/luca/dev/winter-park/template/components/ui/useListPager.ts` — exactly two edits (the hook body incl. the `scroll: false` comment ports byte-identical):
  1. Doc comment line 7: `Drives the OwnerListPager footer: wraps `router.push` in a transition so the` → `Drives the ListPager footer: wraps `router.push` in a transition so the`
  2. Line 11: `export function useOwnerListPager() {` → `export function useListPager() {`
- [ ] Step: rewrite `/Users/luca/dev/winter-park/template/components/ui/ListPager.tsx` — because the Button→plain-`<button>` swap touches most JSX lines, replace the copied file's entire content with exactly (enumerated deltas vs irene follow the block):

```tsx
'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useListPager } from './useListPager'

/**
 * ListPager — shared server-pagination footer for LIST pages.
 *
 * Server-paginated lists (LIMIT/OFFSET) re-suspend their section when the
 * page changes, so navigating via a plain `<Link>` would flash the section's
 * skeleton. This wraps `router.push` in a `startTransition` so the existing
 * rows stay on screen (dimmed) while the next page streams in. The parent
 * server component computes the prev/next hrefs from its OWN route
 * `entry.href` (preserving every active filter) and passes them in as plain
 * strings, so nothing route-specific leaks into this client island — and the
 * no-raw-URL-strings invariant holds, because the hrefs come from the entry.
 *
 * `prevHref` / `nextHref` are `null` at the ends (button disabled). The
 * `children` are the server-rendered row list, dimmed during the transition.
 * All labels are required props — no baked-in copy (docs/pages.md →
 * "Server-paginated lists").
 */
const pagerButtonClass = cn(
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background',
  'text-foreground transition-colors hover:bg-muted',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  'disabled:pointer-events-none disabled:opacity-50',
)

export function ListPager({
  prevHref,
  nextHref,
  rangeLabel,
  pageLabel,
  prevLabel,
  nextLabel,
  navLabel = 'pagination',
  children,
}: {
  prevHref:  string | null
  nextHref:  string | null
  rangeLabel: string
  pageLabel:  string
  prevLabel:  string
  nextLabel:  string
  navLabel?:  string
  children:   React.ReactNode
}) {
  const { isPending, go } = useListPager()

  return (
    <div className="space-y-2">
      <div className={cn('transition-opacity', isPending && 'opacity-60')}>
        {children}
      </div>

      <nav
        aria-label={navLabel}
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-xs"
      >
        <span className="tabular-nums text-muted-foreground">
          {rangeLabel}
          {isPending && (
            <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/60" />
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={pagerButtonClass}
            aria-label={prevLabel}
            disabled={!prevHref || isPending}
            onClick={() => go(prevHref)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-1 tabular-nums text-muted-foreground">{pageLabel}</span>
          <button
            type="button"
            className={pagerButtonClass}
            aria-label={nextLabel}
            disabled={!nextHref || isPending}
            onClick={() => go(nextHref)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </nav>
    </div>
  )
}
```

  Enumerated deltas vs `OwnerListPager.tsx`: (1) `OwnerListPager` → `ListPager`, `useOwnerListPager` → `useListPager` (import path `./useListPager`); (2) irene's `<Button variant="outline" size="icon" block={false}>` → plain `<button className={pagerButtonClass}>` (Button-CVA is phase 8; class string reproduces the outline-icon look with template tokens) with explicit `className="size-4"` on the chevrons (irene's Button sized its icon children via CVA); (3) `shadow-bento` dropped, replaced by `border border-border` (phase 2's `shadow-card` is not a dependency of this phase); (4) `rounded-2xl` → `rounded-lg` (template's stock radius vocabulary); (5) string-concat dimming class → `cn('transition-opacity', isPending && 'opacity-60')`; (6) hardcoded `aria-label="pagination"` → `navLabel` prop defaulting to `'pagination'` (English default, prop-overridable per the copy rule); (7) doc comment de-owner'd — "owner LIST pages" → "LIST pages", the "mirroring the customers list's `PaginationFooter`" clause dropped, docs/pages.md pointer added. Logic (disabled conditions, pending dot, `go()` wiring) is byte-equivalent.
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -rn "Owner\|salon\|shadow-bento\|components/ui/Button" components/ui/ListPager.tsx components/ui/useListPager.ts` → expected: no output.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add components/ui/ListPager.tsx components/ui/useListPager.ts
  git commit -m "feat(list): ListPager + useListPager — transition-dimmed server-pagination footer

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 11.7: `docs/pages.md` — the `?page=`/`?q=` server-paginated list contract

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/docs/pages.md` (append one section at the END of the file — collision-free with phase 7, which inserts its `## Cross-cutting primitives` section BEFORE the `### How they compose` heading; the file's final line is the closing ``` ``` ``` of the "How they compose" diagram)
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (pages.md doc-table row)

**Interfaces:**
- Consumes: `ListPager`/`useListPager` (Task 11.6), `ListSearchBox`/`useListSearch` (Task 11.5) — documented by their produced signatures.
- Produces: the `page`-param contract section that app list features follow.

**Steps:**

- [ ] Step: append to `/Users/luca/dev/winter-park/template/docs/pages.md` (after the file's final line) this exact content:

````markdown

## Server-paginated lists — the `page` param contract

Lists that can grow unbounded paginate **server-side** (SQL `LIMIT`/`OFFSET`)
with the URL as the single source of list state — a list URL is shareable and
refresh-safe by construction. The contract:

- `?page=` — 1-based page number. The route's `entry.ts` owns parsing:
  coerce to a positive integer, default `1`, never trust the raw string.
- `?q=` — optional keyword filter. Trimmed; omitted when empty.
- Every other active filter travels in the URL the same way, and
  `entry.href` is the ONLY place list URLs are built.

```typescript
// entry.ts — page/q are part of the route's typed contract
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

const schema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  q:    z.string().trim().min(1).optional().catch(undefined),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href: (p: Partial<Params> = {}) => {
    const qs = new URLSearchParams()
    if (p.q) qs.set('q', p.q)
    if (p.page && p.page > 1) qs.set('page', String(p.page))
    const s = qs.toString()
    return s ? `/things?${s}` : '/things'
  },
  parse: (ctx: ParseContext) => schema.parse(ctx.searchParams),
}
```

The section's `query.ts` selects `LIMIT pageSize OFFSET (page - 1) * pageSize`
— fetch `pageSize + 1` rows to learn whether a next page exists without a
second COUNT round-trip. The **page** computes the prev/next hrefs from its
OWN `entry.href` (preserving every active filter) and passes them to the
`ListPager` client island as plain strings:

```tsx
// page.tsx
const entryParams = route.entry.parse(ctx)
const { rows, hasMore, total } = await listThings(entryParams)

const prevHref = entryParams.page > 1
  ? route.entry.href({ ...entryParams, page: entryParams.page - 1 })
  : null
const nextHref = hasMore
  ? route.entry.href({ ...entryParams, page: entryParams.page + 1 })
  : null

return (
  <ListPager
    prevHref={prevHref}
    nextHref={nextHref}
    rangeLabel={`${start}–${end} of ${total}`}
    pageLabel={`Page ${entryParams.page}`}
    prevLabel="Previous page"
    nextLabel="Next page"
  >
    {/* server-rendered rows */}
  </ListPager>
)
```

`ListPager` (`components/ui/ListPager.tsx` + `useListPager.ts`) wraps
`router.push` in a `startTransition` so the current rows stay on screen
(dimmed) while the next page streams in — a plain `<Link>` would re-suspend
the section and flash its skeleton. It never builds URLs: the server passes
finished hrefs in, so nothing route-specific leaks into the island and the
no-raw-URL-strings invariant holds (the hrefs come from `entry.href`).

Keyword search rides the same contract: `ListSearchBox`
(`components/ui/ListSearchBox.tsx`) + `useListSearch`
(`lib/list/useListSearch.ts`) debounce the input 300ms, then push
`?q=<term>` — REPLACING the whole query string, which deliberately drops
`?page=` so a new search resets to page 1.

Client-side instant filtering is for lists that are already fully loaded on
the client; the moment a list paginates on the server, every filter must
travel through the URL so the SQL query sees it.
````

- [ ] Step: edit `/Users/luca/dev/winter-park/template/CLAUDE.md` — in the docs table, replace the row
  ``| [`pages.md`](docs/pages.md) | Page layer, hierarchy, system overview |``
  →
  ``| [`pages.md`](docs/pages.md) | Page layer, hierarchy, system overview, server-paginated lists (`?page=`/`?q=`) |``
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && grep -c "ListPager\|useListSearch" docs/pages.md` → expected: ≥ 4. Run: `grep -n "salon\|Owner" docs/pages.md` → expected: no output. Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add docs/pages.md CLAUDE.md
  git commit -m "docs(pages): server-paginated list contract — ?page=/?q= via entry.ts, ListPager, useListSearch

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 11.8: `docs/schema.md` — verify/backfill timestamptz rule, partial-unique pattern, audit_log shape

**Files:**
- Modify (conditional backfill): `/Users/luca/dev/winter-park/template/docs/schema.md`

**Context:** phase 1 Task 1.10 owns the timestamptz rule, audit_log shape, and `## Migrations` section; phase 5 is expected to append the partial-unique-index pattern when it makes `persons.email` nullable. This task is the sweep the spec assigns to the app-patterns phase: verify all three landed, and backfill any that are missing with the exact content below. If a check passes, SKIP its backfill step — never duplicate a section.

**Interfaces:**
- Consumes: phase 1's `docs/schema.md` sections; phase 5's (if drafted/executed) partial-unique addition.
- Produces: `docs/schema.md` guaranteed to contain all three patterns.

**Steps:**

- [ ] Step: check timestamptz — Run: `grep -c "withTimezone" /Users/luca/dev/winter-park/template/docs/schema.md` → if ≥ 1, phase 1 landed it; skip the next step.
- [ ] Step (only if the check above returned 0): in `/Users/luca/dev/winter-park/template/docs/schema.md`, under `## Conventions`, replace the paragraph beginning `**Timestamps**:` with:
  `**Timestamps**: always \`timestamp(..., { withTimezone: true })\` (Postgres \`timestamptz\`) — a naive \`timestamp\` silently drops the timezone and breaks when the server TZ changes. Every table has \`createdAt\`. Add \`updatedAt\` when the table's rows are mutable (edited after creation).`
  and in the three convention code examples apply replace_all: `timestamp('created_at')` → `timestamp('created_at', { withTimezone: true })`, `timestamp('updated_at')` → `timestamp('updated_at', { withTimezone: true })`, `timestamp('deleted_at')` → `timestamp('deleted_at', { withTimezone: true })`.
- [ ] Step: check audit_log — Run: `grep -c "audit_log" /Users/luca/dev/winter-park/template/docs/schema.md` → if ≥ 1, skip the next step.
- [ ] Step (only if the check above returned 0): in `/Users/luca/dev/winter-park/template/docs/schema.md`, in the `## In the template` section, after the line `` Other roles (`customers`, `professionals`, etc.) are created per-project via `/scaffold-feature`. `` insert:

  ```markdown

  The template also ships `audit_log` — a generic audit trail (`workspaceId`,
  `userId`, `action`, `entityType`/`entityId`, jsonb `details`, `ipAddress`/
  `userAgent`, `createdAt`). Write a row from any action whose effect you may
  need to explain later (role changes, destructive mutations, AI-confirmed
  operations). `workspaceId` is nullable: platform-level actions have no
  workspace scope.
  ```
- [ ] Step: check partial-unique — Run: `grep -c "IS NOT NULL" /Users/luca/dev/winter-park/template/docs/schema.md` → if ≥ 1, phase 5 landed it; skip the next step.
- [ ] Step (only if the check above returned 0): in `/Users/luca/dev/winter-park/template/docs/schema.md`, at the end of the `## Conventions` section (directly before the `---` separator that precedes `## In the template`), insert this exact content:

  ````markdown

  **Partial unique indexes — optional natural keys**: when a natural key
  becomes nullable (e.g. `persons.email` once phone-only persons exist),
  express uniqueness explicitly over the non-null values with a partial
  unique index instead of a bare `.unique()`. The `WHERE ... IS NOT NULL`
  clause documents the intent in the schema itself, survives multi-column
  variants, and keeps the constraint aligned with the lookup queries (which
  always filter nulls out anyway):

  ```typescript
  import { sql } from 'drizzle-orm'
  import { uniqueIndex } from 'drizzle-orm/pg-core'

  export const persons = pgTable('persons', {
    // ...
    email:       text('email'),          // nullable — phone-only persons
    phoneNumber: text('phone_number'),   // nullable — email-only persons
  }, (t) => [
    uniqueIndex('persons_email_unique').on(t.email).where(sql`email IS NOT NULL`),
    uniqueIndex('persons_phone_number_unique').on(t.phoneNumber).where(sql`phone_number IS NOT NULL`),
  ])
  ```
  ````
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && grep -c "withTimezone" docs/schema.md && grep -c "audit_log" docs/schema.md && grep -c "IS NOT NULL" docs/schema.md` → expected: three counts, each ≥ 1. Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit (only if any backfill step ran; if all three checks passed, `git commit --allow-empty` is NOT wanted — skip the commit entirely and note "11.8: all present, no-op" in the executor log) —
  ```
  cd /Users/luca/dev/winter-park/template
  git add docs/schema.md
  git commit -m "docs(schema): backfill missing pattern sections (timestamptz / partial-unique / audit_log sweep)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 11.9: Final CLAUDE.md doc-index sweep + phase gate

**Files:**
- Modify (conditional backfill): `/Users/luca/dev/winter-park/template/CLAUDE.md` (docs table)

**Context:** every drafted phase adds its own doc-table rows (2 → design-tokens, 4 → i18n, 6 → tenancy + feature-flags, 7 → links + flow-params), and phases 9/10 are expected to do the same for cron/blob/realtime/capabilities. This sweep is the spec-mandated safety net: after all doc-producing phases have run, ensure every `docs/*.md` file has exactly one row. It is idempotent — when everything landed, it is a no-op.

**Interfaces:**
- Consumes: the docs table in `CLAUDE.md`; the `docs/*.md` files present at execution time.
- Produces: a complete doc index — phase 13's dead-reference sweep relies on it.

**Steps:**

- [ ] Step: list the ground truth — Run: `ls /Users/luca/dev/winter-park/template/docs/*.md | xargs -n1 basename` and `grep -o "docs/[a-z-]*\.md" /Users/luca/dev/winter-park/template/CLAUDE.md | sort -u`. Compare the two lists (ignore the `docs/superpowers/` directory — it is plan/spec storage, never indexed).
- [ ] Step: for each expected file below that EXISTS on disk but has NO row in CLAUDE.md's docs table, insert the exact row at the stated anchor. For each file that does NOT exist on disk, skip its row — do not invent a doc (its owning phase didn't run or chose another name; the catch-all step below handles renames).

  | If `docs/<file>` exists & row missing | Insert exact row | Directly after this existing row |
  |---|---|---|
  | `design-tokens.md` | ``| [`design-tokens.md`](docs/design-tokens.md) | Accent triads, tone scale, typography/radius/shadow tokens, palette swap procedure |`` | the `storybook.md` row |
  | `i18n.md` | ``| [`i18n.md`](docs/i18n.md) | Locale resolution (`app.locale` cookie → `persons.locale` → `en`), messages/`useT`, Intl formatters, timezone (`app.tz`), never-inside-`use cache` rule |`` | the `forms.md` row |
  | `tenancy.md` | ``| [`tenancy.md`](docs/tenancy.md) | Workspaces, memberships, invites, host→workspace middleware, workspace guards |`` | the `rate-limiting.md` row |
  | `feature-flags.md` | ``| [`feature-flags.md`](docs/feature-flags.md) | Feature registry, 3-scope overrides (global/workspace/user), fail-open nav gating |`` | the `tenancy.md` row |
  | `cron.md` | ``| [`cron.md`](docs/cron.md) | Cron-job convention: POST-only `/api/cron/<name>`, `CRON_SECRET` fail-closed, idempotent + bounded, scheduling |`` | the `feature-flags.md` row (or `rate-limiting.md` if flags row absent) |
  | `blob.md` | ``| [`blob.md`](docs/blob.md) | Vercel Blob uploads: validated upload action, authed streaming proxy, image-src helpers |`` | the `cron.md` row |
  | `realtime.md` | ``| [`realtime.md`](docs/realtime.md) | Realtime pulse: per-workspace version row, best-effort bump, SSE nudge |`` | the `blob.md` row |
  | `capabilities.md` | ``| [`capabilities.md`](docs/capabilities.md) | Capability registry — one operation, one definition; AI tools generated from `cap.ai` |`` | the `data-flow.md` row |
  | `links.md` | ``| [`links.md`](docs/links.md) | Link-primitive decision tree — OriginLink / ContextualBackLink / PreserveSearchLink / BackLink |`` | the `declarative-flows.md` row |
  | `flow-params.md` | ``| [`flow-params.md`](docs/flow-params.md) | `?from=` lifecycle — withFrom, useReturnTo, useDropFlowParam, useKeepQs |`` | the `links.md` row |

- [ ] Step: catch-all for any remaining `docs/*.md` file with no row (a phase 9/10 doc under a name not listed above): add a row at the END of the docs table (before the table's closing blank line) shaped `| [\`<basename>\`](docs/<basename>) | <frontmatter title> — <first sentence of the doc body> |`, reading title and first sentence from the file itself. Do NOT add rows for `planning.md`/`overview.md`/etc. — they are already present.
- [ ] Step: verification — Run:
  ```
  cd /Users/luca/dev/winter-park/template
  for f in docs/*.md; do b=$(basename "$f"); grep -q "docs/$b" CLAUDE.md || echo "MISSING ROW: $b"; done
  ```
  → expected: no output. Then Run: `grep -o "docs/[a-z-]*\.md" CLAUDE.md | sort | uniq -d` → expected: no output (no duplicate rows either).
- [ ] Step: phase gate — Run: `npx tsc --noEmit` → expected: exit 0. Run: `npx vitest run` → expected: all tests pass. Run: `grep -rn "salonId\|salon\b\|Irene\|irene\." app/dashboard/layout.tsx app/docs components/ui/ListPager.tsx components/ui/ListSearchBox.tsx components/ui/useListPager.ts lib/list/useListSearch.ts docs/guards.md docs/pages.md` → expected: no output.
- [ ] Step: commit (skip if the sweep changed nothing) —
  ```
  cd /Users/luca/dev/winter-park/template
  git add CLAUDE.md
  git commit -m "docs: final CLAUDE.md doc-index sweep — every docs/*.md file has its row

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

## Phase exit criteria

- `npx tsc --noEmit` → exit 0; `npx vitest run` → green.
- `/dashboard` layout is a sync Suspense guard shell; `/docs` redirects anonymous production visitors to `/auth/identify` via typed entries and stays open in dev.
- `docs/guards.md` carries Suspense-shell, gate-topology, and onboarding-checklist sections; `docs/pages.md` carries the `?page=`/`?q=` contract; `docs/schema.md` carries timestamptz + partial-unique + audit_log.
- `ListPager`/`useListPager`/`ListSearchBox`/`useListSearch` exist with zero irene identifiers and zero phase-2/phase-8 token or component dependencies.
- Every `docs/*.md` file has exactly one row in CLAUDE.md's doc table.
