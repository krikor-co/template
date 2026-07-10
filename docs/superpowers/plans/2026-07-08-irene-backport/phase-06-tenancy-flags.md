# Phase 6: Tenancy Substrate + Feature Flags — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Land the multi-tenant substrate (workspaces, memberships, guards, post-login dispatcher, invites, host→tenant middleware, Vercel Domains client) and the feature-flag system (registry + 3-scope resolution + fail-open nav gate) in the template, generalized from irene's salon domain.

**Depends on phases:** 1, 3, 5 (and transitively 4 via 5 — `lib/i18n` is available).

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE source: `/Users/luca/dev/winter-park/irene` (read-only reference).
- New tables this phase: `workspaces`, `workspace_members` (workspace_id, user_id, `role` **text** — seeded vocabulary `'owner' | 'member'`, documented as app-extensible), `invites`, `feature_flag` (scopes `global | workspace | user`, check constraint). `audit_log.workspace_id` and `trace_span.workspace_id` (created FK-less in phases 1/3) get real FKs to `workspaces.id` now.
- Tenant concept: "workspace" everywhere irene says salon. Guard names: `requireSession` (exists in `lib/auth/session.ts`), `requireAdmin`, `requireWorkspaceRole(workspaceId, role)`. Effect adapters: `requireSessionE`, `requireAdminE`, `requireWorkspaceRoleE`. GuardError classes: `SessionGuardError`, `AdminGuardError`, `WorkspaceGuardError`, each with `reason: 'unauthenticated' | 'forbidden'`.
- Effect stays Effect: invite accept action uses `runAction`, `mapResult`, `dbE`, `validate`, tagged errors (`NotFound`, `ValidationFailed`) from phase 3's `lib/effect/*`.
- Copy: English defaults; all user-facing copy for dispatcher + invite flows goes through `lib/i18n` messages (`en` + `pt-BR` both seeded). No hardcoded pt-BR anywhere.
- Identifiers: auth session cookie via `AUTH_SESSION_COOKIE` constant from `lib/auth/identifier.ts` (phase 5); dev port 3000; base domain env `APP_BASE_DOMAIN` (defaults `localhost`).
- Migrations: template has only baseline `0000` — schema tasks regenerate the baseline with the pinned named-baseline convention (same as phases 5/9/10 and the phase-13 gate): `cd /Users/luca/dev/winter-park/template && rm -rf drizzle && npx drizzle-kit generate --name baseline` → expected output exactly `drizzle/0000_baseline.sql` (+ `drizzle/meta/`); runner `scripts/migrate.mjs` reads `./drizzle`.
- Every timestamp column: `timestamp(..., { withTimezone: true })` (phase 1 rule).
- Verification gate for every task: at minimum `npx tsc --noEmit` clean; `npx vitest run` for tested code; `npx next build` for middleware/schema-affecting tasks. Every task ends with a git commit whose message ends with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- All commands run from `/Users/luca/dev/winter-park/template`.

### Interfaces assumed from earlier phases (verify at task start; these are pinned by 00-INDEX)

- Phase 1: `users` has `role` (pgEnum `platform_role`, values `'user' | 'admin'`) and `deletedAt` columns; `db/schema/audit-log.ts` exports `auditLog` with an FK-less `workspaceId: integer('workspace_id')` column; vitest configured (`npx vitest run`, `@/` alias, `.test.ts` files); baseline-regen procedure pinned (see Global Constraints above — repeat it verbatim).
- Phase 3: `lib/effect/run-action.ts` exports `runAction<A, E>(effect, { actionName, timeout?, attributes }): Promise<ActionResult<A>>` where `ActionResult<A> = ({ success: true } & A) | { success: false; error: string; kind: TaggedAppError['_tag']; fieldErrors?: Record<string, string[]> }`; `lib/effect/boundary.ts` exports `mapResult(result, { fallback, notFound?, ... })`; `lib/effect/db.ts` exports `dbE.try/findFirst/run/transaction`; `lib/effect/validate.ts` exports `validate(schema, raw)`; `lib/effect/errors.ts` exports `Forbidden({ message })`, `Unauthenticated({ message })`, `NotFound({ entity, id? })`, `ValidationFailed({ message, fieldErrors? })`; `db/schema/trace-span.ts` exports `traceSpan` with FK-less `workspaceId: integer('workspace_id')`. **`lib/effect/auth.ts` landed with FROZEN signatures this phase must preserve:** `requireSessionE(): Effect.Effect<SessionPayload, Unauthenticated>` (WORKING — keep its body unchanged), `requireAdminE(): Effect.Effect<void, Forbidden | Unauthenticated>` (fail-closed stub), `requireWorkspaceRoleE(workspaceId: string, role: string | string[]): Effect.Effect<void, Forbidden | Unauthenticated>` (fail-closed stub). Phase 3 exports NOTHING else from this file (no `WorkspaceRole` type — the seeded role vocabulary type ships in `lib/invite/roles.ts`, Task 6.10). Task 6.4 replaces only the two stub declarations (docblock + body) and adds guard imports; it must not rename exports or change the signatures — phases 9/10 pin `requireWorkspaceRoleE(workspaceId: string, role: string | string[])` and pass `workspaceId` straight from zod `z.string()` params.
- Phase 4 (via 5): `lib/i18n/types.ts` exports `Locale` (`'en' | 'pt-BR'`); `lib/i18n/messages.ts` exports `t(locale: Locale): Messages` with a `Messages` type and per-locale objects `en` and pt-BR; `lib/i18n/getLocale.ts` exports `getCurrentLocale(): Promise<Locale>` and `getPublicLocale(): Promise<Locale>`; `lib/i18n/LocaleProvider.tsx` exports `LocaleProvider` and `useT()`.
- Phase 5: `lib/auth/identifier.ts` exports `AUTH_SESSION_COOKIE` (value `'session_token'`); `lib/auth/jwt.ts` exports `createSessionToken(payload)` with slim payload `{ userId: number }` and `SessionPayload`; `lib/auth/session.ts` exports `getSession(): Promise<SessionPayload | null>` and `requireSession(): Promise<SessionPayload>`; `sessions` schema keeps `token` column with `unique()` + `userId ... onDelete: 'cascade'`; `persons.email` nullable w/ partial unique + `persons.emailVerified: boolean` (phase 5's dual-identifier schema work — NOT phase 1).
- If a name above differs in the landed code (e.g. `users.role` property name, `SessionPayload.userId` string vs number), adapt the call site to the landed name — the landed phase wins; do not rename the earlier phase's export. `Number(session.userId)` is used at membership call sites so both string and number payloads type-check.

---

### Task 6.1: `workspaces` + `workspace_members` tables, real FKs on `audit_log`/`trace_span`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/db/schema/workspaces.ts`
- Create: `/Users/luca/dev/winter-park/template/db/schema/workspace-members.ts`
- Modify: `/Users/luca/dev/winter-park/template/db/schema/index.ts` (add 2 export lines)
- Modify: `/Users/luca/dev/winter-park/template/db/schema/audit-log.ts` (workspaceId column: add FK)
- Modify: `/Users/luca/dev/winter-park/template/db/schema/trace-span.ts` (workspaceId column: add FK)
- Regenerate: `/Users/luca/dev/winter-park/template/drizzle/` (baseline)

**Interfaces:**
- Consumes: `users` from `db/schema/users.ts`; `auditLog`/`traceSpan` FK-less `workspaceId` columns from phases 1/3.
- Produces: `workspaces` table (`id: integer identity PK`, `name: text notNull`, `slug: text` nullable w/ partial unique, `createdAt/updatedAt: timestamptz notNull`, `deletedAt: timestamptz`), types `Workspace`, `NewWorkspace`; `workspaceMembers` table (`id`, `workspaceId FK`, `userId FK`, `role: text notNull`, timestamps, `deletedAt`, `unique(workspaceId, userId)`), types `WorkspaceMember`, `NewWorkspaceMember`.

**Steps:**

- [ ] Write `/Users/luca/dev/winter-park/template/db/schema/workspaces.ts` with exactly:

```ts
import { sql } from 'drizzle-orm'
import { integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * The tenant. Everything tenant-scoped hangs off `workspaces.id`
 * (memberships, invites, feature-flag overrides, audit/trace rows).
 * Deliberately minimal — apps add their own business columns.
 */
export const workspaces = pgTable(
  'workspaces',
  {
    id:   integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    /**
     * Subdomain slug (e.g. "acme" → acme.<APP_BASE_DOMAIN>). Nullable until
     * claimed; unique among non-null values (partial index below). Powers the
     * host-resolution middleware (lib/tenant/resolve-host.ts).
     */
    slug:      text('slug'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    slugUnique: uniqueIndex('workspaces_slug_unique').on(t.slug).where(sql`${t.slug} IS NOT NULL`),
  }),
)

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
```

- [ ] Write `/Users/luca/dev/winter-park/template/db/schema/workspace-members.ts` with exactly:

```ts
import { integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'

/**
 * Workspace membership. `role` is TEXT (not a pg enum) so apps can extend the
 * role vocabulary without a migration. The template seeds 'owner' | 'member'
 * (see WORKSPACE_ROLES in lib/invite/roles.ts); guards take the required
 * role(s) as parameters, so new roles need no schema change.
 */
export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id:          integer('id').primaryKey().generatedAlwaysAsIdentity(),
    workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
    userId:      integer('user_id').notNull().references(() => users.id),
    role:        text('role').notNull(),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt:   timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    workspaceUserUnique: unique().on(t.workspaceId, t.userId),
  }),
)

export type WorkspaceMember = typeof workspaceMembers.$inferSelect
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert
```

- [ ] Edit `/Users/luca/dev/winter-park/template/db/schema/index.ts`: after the line `export * from './users'` add:

```ts
export * from './workspaces'
export * from './workspace-members'
```

- [ ] Edit `/Users/luca/dev/winter-park/template/db/schema/audit-log.ts` (file landed by phase 1):
  - Add import: `import { workspaces } from './workspaces'`
  - Change `workspaceId: integer('workspace_id'),` → `workspaceId: integer('workspace_id').references(() => workspaces.id),`
  - (Anchor on the `integer('workspace_id')` column expression; if phase 1 formatted it differently, the required end state is the same column with `.references(() => workspaces.id)` appended.)
- [ ] Edit `/Users/luca/dev/winter-park/template/db/schema/trace-span.ts` (file landed by phase 3): same two edits — add `import { workspaces } from './workspaces'`, change `workspaceId: integer('workspace_id'),` → `workspaceId: integer('workspace_id').references(() => workspaces.id),`. The `userId` column on `trace_span` stays FK-less (denormalized, spans outlive users).
- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Regenerate the baseline (pinned named-baseline convention): `cd /Users/luca/dev/winter-park/template && rm -rf drizzle && npx drizzle-kit generate --name baseline` → expected: exit 0, exactly one fresh SQL file named exactly `drizzle/0000_baseline.sql` (+ `drizzle/meta/`)
- [ ] Verify tables in the baseline: `grep -c 'CREATE TABLE "workspaces"\|CREATE TABLE "workspace_members"' drizzle/0000_baseline.sql` → expected: `2`; `grep -c 'workspaces_slug_unique' drizzle/0000_baseline.sql` → expected: ≥ 1
- [ ] Commit:
  ```
  git add db/schema/workspaces.ts db/schema/workspace-members.ts db/schema/index.ts db/schema/audit-log.ts db/schema/trace-span.ts drizzle
  git commit -m "feat(db): workspaces + workspace_members tables; real workspace FKs on audit_log/trace_span

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.2: `invites` + `feature_flag` tables

**Files:**
- Create: `/Users/luca/dev/winter-park/template/db/schema/invites.ts`
- Create: `/Users/luca/dev/winter-park/template/db/schema/feature-flags.ts`
- Modify: `/Users/luca/dev/winter-park/template/db/schema/index.ts` (add 2 export lines)
- Regenerate: `/Users/luca/dev/winter-park/template/drizzle/` (baseline)

**Interfaces:**
- Consumes: `workspaces` (Task 6.1), `users`.
- Produces: `invites` table (`id`, `workspaceId FK notNull`, `email text notNull`, `role text notNull`, `token text notNull unique`, `status text notNull default 'pending'`, `invitedByUserId FK notNull`, `expiresAt timestamptz notNull`, `acceptedAt timestamptz`, `createdAt timestamptz notNull`), types `Invite`, `NewInvite`; `featureFlag` table (`id`, `scope text notNull` + check `IN ('global','workspace','user')`, `scopeId integer` nullable, `featureKey text notNull`, `enabled boolean notNull`, `updatedAt timestamptz notNull`, partial unique indexes `feature_flag_global_key_unique` / `feature_flag_scoped_unique`, index `feature_flag_scope_lookup`), types `FeatureFlag`, `NewFeatureFlag`.

**Steps:**

- [ ] Write `/Users/luca/dev/winter-park/template/db/schema/invites.ts` with exactly (source: `/Users/luca/dev/winter-park/irene/db/schema/invite.ts`, generalized — table `invite`→`invites`, `salonId`→`workspaceId`, pgEnum role→text, salon prose→workspace):

```ts
import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'

/**
 * Team invite. A workspace owner invites someone (by email) to join a
 * workspace in a given role. The invitee opens `/invite/<token>` and accepts —
 * which provisions their `workspace_members` row and signs them in
 * (magic-link accept: the token IS the credential).
 *
 * `token` is a `crypto.randomUUID()` and is the only credential needed to
 * view/accept the invite, so it is unique. `status` walks
 * pending → accepted | revoked | expired. An invite is also treated as
 * expired once `expiresAt < now()` regardless of the stored status.
 * SINGLE-USE: the accept transaction flips status to 'accepted' guarded by
 * `status = 'pending'`, so a second accept finds no pending row.
 *
 * `role` is TEXT mirroring `workspace_members.role` (app-extensible union;
 * template seeds 'owner' | 'member' — see lib/invite/roles.ts).
 */
export const invites = pgTable('invites', {
  id:              integer('id').primaryKey().generatedAlwaysAsIdentity(),
  workspaceId:     integer('workspace_id').notNull().references(() => workspaces.id),
  email:           text('email').notNull(),
  role:            text('role').notNull(),
  token:           text('token').notNull().unique(),
  status:          text('status').notNull().default('pending'), // pending | accepted | revoked | expired
  invitedByUserId: integer('invited_by_user_id').notNull().references(() => users.id),
  expiresAt:       timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt:      timestamp('accepted_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Invite = typeof invites.$inferSelect
export type NewInvite = typeof invites.$inferInsert
```

- [ ] Write `/Users/luca/dev/winter-park/template/db/schema/feature-flags.ts` with exactly (source: `/Users/luca/dev/winter-park/irene/db/schema/feature-flag.ts`, `salon`→`workspace` in scope value + prose; everything else 1:1):

```ts
import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Feature-flag overrides — the only persisted state behind the feature system.
 * The catalog of features (keys, labels, roles, defaults) lives in the PURE
 * registry at `lib/features/registry.ts`; this table only stores OVERRIDES of
 * the registry default at one of three scopes:
 *
 *   scope='global'    → platform-wide override   (scope_id NULL)
 *   scope='workspace' → per-workspace override   (scope_id = workspaces.id)
 *   scope='user'      → per-user override        (scope_id = users.id)
 *
 * Resolution is most-specific-wins: user ▸ workspace ▸ global ▸ registry
 * default (see `lib/features/resolve.ts`). A missing row simply means "no
 * override at this scope" — never delete-vs-disable ambiguity.
 *
 * Uniqueness is enforced by two PARTIAL unique indexes (Postgres can't express
 * "unique per feature_key when global, else unique per (scope,scope_id,key)"
 * with a single constraint because scope_id is NULL for global rows):
 *   - one global override per feature_key   (WHERE scope = 'global')
 *   - one scoped override per (scope, scope_id, feature_key) otherwise
 *
 * `scope_id` is intentionally FK-less: it points at workspaces.id OR users.id
 * depending on `scope`, which a single FK cannot express.
 */
export const featureFlag = pgTable(
  'feature_flag',
  {
    id:         integer('id').primaryKey().generatedAlwaysAsIdentity(),
    scope:      text('scope').notNull(),
    /** NULL for global; workspaces.id or users.id otherwise. */
    scopeId:    integer('scope_id'),
    featureKey: text('feature_key').notNull(),
    enabled:    boolean('enabled').notNull(),
    updatedAt:  timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    scopeCheck: check('feature_flag_scope_check', sql`${table.scope} IN ('global', 'workspace', 'user')`),
    globalKeyUnique: uniqueIndex('feature_flag_global_key_unique')
      .on(table.featureKey)
      .where(sql`${table.scope} = 'global'`),
    scopedUnique: uniqueIndex('feature_flag_scoped_unique')
      .on(table.scope, table.scopeId, table.featureKey)
      .where(sql`${table.scope} <> 'global'`),
    scopeLookup: index('feature_flag_scope_lookup').on(table.scope, table.scopeId),
  }),
)

export type FeatureFlag = typeof featureFlag.$inferSelect
export type NewFeatureFlag = typeof featureFlag.$inferInsert
```

- [ ] Edit `/Users/luca/dev/winter-park/template/db/schema/index.ts`: after `export * from './workspace-members'` add:

```ts
export * from './invites'
export * from './feature-flags'
```

- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Regenerate the baseline (pinned named-baseline convention): `cd /Users/luca/dev/winter-park/template && rm -rf drizzle && npx drizzle-kit generate --name baseline` → expected: exit 0, exactly one fresh SQL file named exactly `drizzle/0000_baseline.sql` (+ `drizzle/meta/`)
- [ ] Verify: `grep -c 'CREATE TABLE "invites"\|CREATE TABLE "feature_flag"' drizzle/0000_baseline.sql` → expected: `2`; `grep -c "feature_flag_scope_check" drizzle/0000_baseline.sql` → expected: ≥ 1
- [ ] Commit:
  ```
  git add db/schema/invites.ts db/schema/feature-flags.ts db/schema/index.ts drizzle
  git commit -m "feat(db): invites + feature_flag tables (3-scope overrides, partial uniques, scope check)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.3: Throw-based guards — `SessionGuardError`, `requireWorkspaceRole`, `requireAdmin`

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/lib/auth/session.ts` (requireSession error class — currently lines 44-53 in pre-phase-5 file)
- Create: `/Users/luca/dev/winter-park/template/app/workspace/guards.ts`
- Create: `/Users/luca/dev/winter-park/template/app/admin/guards.ts`

**Interfaces:**
- Consumes: `getSession(): Promise<SessionPayload | null>` from `@/lib/auth/session`; `workspaces`, `workspaceMembers`, `users` from `@/db/schema`; `users.role` (`'user' | 'admin'`) + `users.deletedAt` from phase 1.
- Produces: `SessionGuardError` (class, `reason: 'unauthenticated' | 'forbidden'`) from `@/lib/auth/session`; `WorkspaceGuardError` (same shape) + `requireWorkspaceRole(workspaceId: string, role: string | string[]): Promise<void>` from `@/app/workspace/guards`; `AdminGuardError` + `requireAdmin(): Promise<void>` from `@/app/admin/guards`.

**Steps:**

- [ ] In `/Users/luca/dev/winter-park/template/lib/auth/session.ts`, replace the current `requireSession` implementation (which throws `new Error('Unauthenticated — missing layout guard?')`) with a typed guard error. If phase 3 or 5 already introduced `SessionGuardError` here, verify it matches and skip this step. Target end state — replace:

```ts
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) throw new Error('Unauthenticated — missing layout guard?')
  return session
}
```

with:

```ts
/**
 * Sentinel error thrown by `requireSession` when no valid session exists.
 * Layouts catch this (or check `getSession()` directly) and redirect to
 * `/auth/identify`; Effect code uses `requireSessionE` (lib/effect/auth.ts)
 * which maps it to the typed `Unauthenticated` error.
 */
export class SessionGuardError extends Error {
  constructor(public readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason)
    this.name = 'SessionGuardError'
  }
}

/**
 * Asserts that a valid session exists. Use in server actions and queries
 * that run behind an authenticated layout guard.
 *
 * This should never be the first line of defense — layouts handle the
 * redirect. If this throws, it means a layout guard is missing.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) throw new SessionGuardError('unauthenticated')
  return session
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/workspace/guards.ts` with exactly (source pattern: `/Users/luca/dev/winter-park/irene/app/salon/[salonId]/owner/guards.ts` — `OwnerGuardError`→`WorkspaceGuardError`, `requireOwner(salonId)`→`requireWorkspaceRole(workspaceId, role)` with the role(s) parameterized via `inArray`, `salon`/`salonMember`→`workspaces`/`workspaceMembers`; the `getOwnerProfile` helper does NOT port — salon-specific):

```ts
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { workspaces, workspaceMembers } from '@/db/schema'
import { getSession } from '@/lib/auth/session'

/**
 * Sentinel error thrown by `requireWorkspaceRole` when the caller is not
 * authenticated or does not hold one of the required roles on the requested
 * workspace. Layouts catch this and redirect; server actions go through the
 * Effect adapter `requireWorkspaceRoleE` (lib/effect/auth.ts) instead.
 */
export class WorkspaceGuardError extends Error {
  constructor(public readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason)
    this.name = 'WorkspaceGuardError'
  }
}

function parseWorkspaceId(workspaceId: string): number {
  const id = Number.parseInt(workspaceId, 10)
  if (!Number.isFinite(id) || id <= 0) {
    throw new WorkspaceGuardError('forbidden')
  }
  return id
}

/**
 * Guard for all `/workspace/:workspaceId/...` routes and workspace-scoped
 * server actions.
 *
 * Verifies that:
 *   1. A valid session exists (delegates to `getSession()`).
 *   2. The session user has an ACTIVE membership on the workspace whose role
 *      is one of `role` (string or array — pass `['owner', 'member']` for
 *      "any member", `'owner'` for owner-only surfaces). Soft-deleted
 *      memberships AND soft-deleted workspaces fail the guard.
 *
 * On failure, throws a `WorkspaceGuardError`. The workspace layout wraps this
 * in try/catch and redirects (unauthenticated → login, forbidden → dashboard).
 */
export async function requireWorkspaceRole(workspaceId: string, role: string | string[]): Promise<void> {
  const session = await getSession()
  if (!session) throw new WorkspaceGuardError('unauthenticated')

  const workspaceIdNum = parseWorkspaceId(workspaceId)
  const roles = Array.isArray(role) ? role : [role]

  const [membership] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    // Join the workspace so a soft-deleted workspace fails the guard: an
    // active workspace still passes; a deleted one is rejected (→ redirect).
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceIdNum),
        eq(workspaceMembers.userId, Number(session.userId)),
        inArray(workspaceMembers.role, roles),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    )
    .limit(1)

  if (!membership) throw new WorkspaceGuardError('forbidden')
}
```

- [ ] Ownership note: phase 3's stub comment in `lib/effect/auth.ts` says "Phase 5 wires requireAdmin" — ownership actually lands HERE (this task + 6.4). Before writing, run `ls app/admin/guards.ts 2>/dev/null && grep -n 'AdminGuardError' app/admin/guards.ts` — if phase 5 already created a matching `requireAdmin`/`AdminGuardError` (same class name, same `reason` union), verify it matches the content below and skip the write; the landed phase wins.
- [ ] Write `/Users/luca/dev/winter-park/template/app/admin/guards.ts` with exactly (source: `/Users/luca/dev/winter-park/irene/app/admin/guards.ts` — `user`→`users`, prose de-salon'd; logic 1:1):

```ts
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { users } from '@/db/schema'
import { getSession } from '@/lib/auth/session'

/**
 * Sentinel error thrown by `requireAdmin` when the caller is not authenticated
 * or does not have the platform `admin` role. Layouts catch this and redirect;
 * server actions go through the Effect adapter `requireAdminE`.
 */
export class AdminGuardError extends Error {
  constructor(public readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason)
    this.name = 'AdminGuardError'
  }
}

/**
 * Guard for `/admin/...` routes and admin server actions.
 *
 * Verifies that a valid session exists AND the session user has the platform
 * `admin` role (`users.role`, NOT workspace-scoped). Throws `AdminGuardError`
 * on failure — there is intentionally NO environment bypass; an admin surface
 * mutates platform state, so it must never be reachable unauthenticated.
 */
export async function requireAdmin(): Promise<void> {
  const session = await getSession()
  if (!session) throw new AdminGuardError('unauthenticated')

  const [found] = await db
    .select({ role: users.role })
    .from(users)
    .where(and(eq(users.id, Number(session.userId)), isNull(users.deletedAt)))
    .limit(1)

  if (found?.role !== 'admin') throw new AdminGuardError('forbidden')
}
```

- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
  ```
  git add lib/auth/session.ts app/workspace/guards.ts app/admin/guards.ts
  git commit -m "feat(guards): SessionGuardError + requireWorkspaceRole + requireAdmin throw-based guards

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.4: Effect guard adapters — complete the phase 3 stubs in `lib/effect/auth.ts`

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/lib/effect/auth.ts` (replace the two stub declarations; keep `requireSessionE` and the module docblock exactly as phase 3 landed them)

**Interfaces:**
- Consumes: `getSession` from `@/lib/auth/session` + `SessionPayload` from `@/lib/auth/jwt` (already imported by phase 3's file); `AdminGuardError`, `requireAdmin` from `@/app/admin/guards` (6.3); `WorkspaceGuardError`, `requireWorkspaceRole` from `@/app/workspace/guards` (6.3); `Forbidden`, `Unauthenticated` from `@/lib/effect/errors`.
- Produces (phase 3's frozen names AND signatures, now all working): `requireSessionE(): Effect.Effect<SessionPayload, Unauthenticated>` (unchanged); `requireAdminE(): Effect.Effect<void, Forbidden | Unauthenticated>`; `requireWorkspaceRoleE(workspaceId: string, role: string | string[]): Effect.Effect<void, Forbidden | Unauthenticated>` — signatures byte-identical to phase 3's stubs, so every existing call site keeps compiling, and phases 9 (`uploadImageE`) and 10 (subscribe/checkout-success/billing actions) pin exactly this string-typed signature, passing `workspaceId` straight from zod `z.string()` params. NO other export from this file — the seeded role vocabulary type (`WorkspaceRole`) ships in `lib/invite/roles.ts` (Task 6.10), not here.

**Steps:**

- [ ] Phase 3 landed `/Users/luca/dev/winter-park/template/lib/effect/auth.ts` with a WORKING `requireSessionE` (built on `Effect.promise(() => getSession())` + `Effect.flatMap` null-check) and two fail-closed stubs (`requireAdminE()` and `requireWorkspaceRoleE(workspaceId: string, role: string | string[])`) that `Effect.fail(new Forbidden(...))` unconditionally; it exports nothing else (no `WorkspaceRole` type). DO NOT touch `requireSessionE` or the module docblock. Apply exactly these edits:
  1. Add two imports after the existing `import { Forbidden, Unauthenticated } from './errors'` line:
     ```ts
     import { AdminGuardError, requireAdmin as requireAdminRaw } from '@/app/admin/guards'
     import { WorkspaceGuardError, requireWorkspaceRole as requireWorkspaceRoleRaw } from '@/app/workspace/guards'
     ```
  2. Replace the entire `requireAdminE` declaration (its STUB docblock starting `/**\n * STUB — the admin guard` through the `Effect.fail(new Forbidden({ message: 'Admin guard not wired yet' }))` body) with:
     ```ts
     /**
      * Effect-flavored platform-admin guard. Wraps the throw-based
      * `requireAdmin` (app/admin/guards.ts — checks `users.role === 'admin'`,
      * NOT workspace-scoped) with `Effect.tryPromise` and maps:
      *   AdminGuardError.reason === 'unauthenticated' → Unauthenticated
      *   anything else                                → Forbidden (safe default)
      * Used by every admin-only server action.
      */
     export const requireAdminE = (): Effect.Effect<void, Forbidden | Unauthenticated> =>
       Effect.tryPromise({
         try:   () => requireAdminRaw(),
         catch: (e) => {
           if (e instanceof AdminGuardError && e.reason === 'unauthenticated') {
             return new Unauthenticated({ message: 'Not signed in' })
           }
           return new Forbidden({ message: 'Admin role required' })
         },
       })
     ```
  3. Replace the entire `requireWorkspaceRoleE` declaration (its STUB docblock starting `/**\n * STUB — the workspace-role guard` through the body `Effect.fail(new Forbidden({\n      message: \`Workspace guard not wired yet — workspace ${workspaceId}, role ${Array.isArray(role) ? role.join(', ') : role}\`,\n    }))`) with (note: the `(workspaceId: string, role: string | string[])` signature is FROZEN by phase 3 and pinned by phases 9/10 — keep it byte-identical; only the docblock and body change):
     ```ts
     /**
      * Effect-flavored workspace-role guard. Pass a single role for exact-role
      * surfaces (`'owner'`) or an array for any-of (`['owner', 'member']`).
      * Wraps the throw-based `requireWorkspaceRole` (app/workspace/guards.ts)
      * with `Effect.tryPromise` and maps:
      *   WorkspaceGuardError.reason === 'unauthenticated' → Unauthenticated
      *   anything else                                    → Forbidden (safe default)
      * Used by every workspace-scoped server action.
      */
     export const requireWorkspaceRoleE = (
       workspaceId: string,
       role: string | string[],
     ): Effect.Effect<void, Forbidden | Unauthenticated> =>
       Effect.tryPromise({
         try:   () => requireWorkspaceRoleRaw(workspaceId, role),
         catch: (e) => {
           if (e instanceof WorkspaceGuardError && e.reason === 'unauthenticated') {
             return new Unauthenticated({ message: 'Not signed in' })
           }
           return new Forbidden({ message: 'Workspace role required' })
         },
       })
     ```
- [ ] Sanity-check no other export changed: `grep -n 'export' lib/effect/auth.ts` → expected: exactly `requireSessionE`, `requireAdminE`, `requireWorkspaceRoleE` (no `WorkspaceRole` here — that type ships in `lib/invite/roles.ts`, Task 6.10). Then `grep -rn "from '@/lib/effect/auth'" --include='*.ts' --include='*.tsx' app lib` → expected: every import site still resolves (no import of a removed name).
- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
  ```
  git add lib/effect/auth.ts
  git commit -m "feat(effect): requireSessionE/requireAdminE/requireWorkspaceRoleE guard adapters (completes phase 3 stubs)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.5: `getUserWorkspaces` membership queries

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/package.json` (add `server-only` dep)
- Create: `/Users/luca/dev/winter-park/template/lib/workspace/memberships.ts`

**Interfaces:**
- Consumes: `workspaces`, `workspaceMembers`, `users` from `@/db/schema`.
- Produces: `UserWorkspace` (`{ id: number; name: string; role: string }`); `getUserWorkspaces(userId: number): Promise<UserWorkspace[]>`; `isPlatformAdmin(userId: number): Promise<boolean>` — all from `@/lib/workspace/memberships`.

**Steps:**

- [ ] Run: `npm install server-only` → expected: exit 0, `server-only` in `package.json` dependencies (skip if already present from an earlier phase).
- [ ] Write `/Users/luca/dev/winter-park/template/lib/workspace/memberships.ts` with exactly (source: `/Users/luca/dev/winter-park/irene/app/dashboard/_lib/memberships.ts` — moved to `lib/` because guards, dispatcher, and future features all consume it; `loadUserSalons`→`getUserWorkspaces`, `DashboardSalon`→`UserWorkspace`, `salon`/`salonMember`/`user`→plural template tables, `MemberRole` enum→`string` (text column), `roleCountsOf` does NOT port — it fed irene's role-chip hero UI only):

```ts
import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { workspaces, workspaceMembers, users } from '@/db/schema'

export interface UserWorkspace {
  id:   number
  name: string
  /** The membership's role — template seeds 'owner' | 'member' (app-extensible). */
  role: string
}

/**
 * Every ACTIVE membership the user holds, joined to its workspace. Powers the
 * post-login dispatcher (0 → onboarding, 1 → workspace home, N → picker).
 * Soft-deleted memberships and soft-deleted workspaces are excluded.
 */
export async function getUserWorkspaces(userId: number): Promise<UserWorkspace[]> {
  return db
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    )
    .orderBy(workspaces.id)
}

/** Platform admins keep the dashboard even with no workspace of their own. */
export async function isPlatformAdmin(userId: number): Promise<boolean> {
  const [account] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return account?.role === 'admin'
}
```

- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
  ```
  git add package.json package-lock.json lib/workspace/memberships.ts
  git commit -m "feat(workspace): getUserWorkspaces + isPlatformAdmin membership queries

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.6: i18n message namespaces `workspaces` + `invite` (en + pt-BR)

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/lib/i18n/messages.ts` (phase-4 file — anchor by object names, not line numbers)

**Interfaces:**
- Consumes: `Messages` type + `en` / pt-BR locale objects + `t(locale)` from phase 4's `lib/i18n/messages.ts`.
- Produces: `Messages['workspaces']` (`kicker`, `heading`, `pick`, `none`: all `string`); `Messages['invite']` (`title: string`, `nameRequired: string`, `nameLabel: string`, `acceptingAs: (name: string) => string`, `confirmHeading: (workspace: string, role: string) => string`, `confirmBody: string`, `accept: string`, `accepting: string`, `roles: Record<string, string>`, `error: { notFound; expired; used; revoked; generic; goHome: string }`, `email: { subject: (workspace: string) => string; greeting: string; body: (workspace: string, role: string) => string; cta: string; ignore: string }`, `errors: { accept: string; notFound: string }`).

**Steps:**

- [ ] In the `Messages` type declaration in `/Users/luca/dev/winter-park/template/lib/i18n/messages.ts`, add these two members (append after the last existing member, preserving the file's formatting style):

```ts
workspaces: {
  kicker:  string
  heading: string
  pick:    string
  none:    string
}
invite: {
  title:          string
  nameRequired:   string
  nameLabel:      string
  acceptingAs:    (name: string) => string
  confirmHeading: (workspace: string, role: string) => string
  confirmBody:    string
  accept:         string
  accepting:      string
  /** Role label lookup keyed by workspace role; unknown roles fall back to the raw role string at call sites. */
  roles: Record<string, string>
  error: {
    notFound: string
    expired:  string
    used:     string
    revoked:  string
    generic:  string
    goHome:   string
  }
  email: {
    subject:  (workspace: string) => string
    greeting: string
    body:     (workspace: string, role: string) => string
    cta:      string
    ignore:   string
  }
  errors: {
    accept:   string
    notFound: string
  }
}
```

- [ ] In the `en` messages object, add (append after the last existing namespace):

```ts
workspaces: {
  kicker:  'Welcome',
  heading: 'Your workspaces',
  pick:    'Choose a workspace to continue.',
  none:    'You are not part of any workspace yet.',
},
invite: {
  title:          'Invitation',
  nameRequired:   'Please enter your name to accept.',
  nameLabel:      'Your name',
  acceptingAs:    (name: string) => `You'll join as ${name}.`,
  confirmHeading: (workspace: string, role: string) => `Accept invite to ${workspace} as ${role}`,
  confirmBody:    'Accepting will add you to this workspace with the role above.',
  accept:         'Accept invite',
  accepting:      'Accepting…',
  roles: {
    owner:  'owner',
    member: 'member',
  },
  error: {
    notFound: 'This invitation could not be found.',
    expired:  'This invitation has expired.',
    used:     'This invitation has already been accepted.',
    revoked:  'This invitation has been revoked.',
    generic:  'This invitation is no longer valid.',
    goHome:   'Go to dashboard',
  },
  email: {
    subject:  (workspace: string) => `You're invited to join ${workspace}`,
    greeting: 'Hello,',
    body:     (workspace: string, role: string) => `You have been invited to join ${workspace} as ${role}.`,
    cta:      'Accept invitation',
    ignore:   'If you did not expect this, you can ignore this email.',
  },
  errors: {
    accept:   'Failed to accept invite.',
    notFound: 'Invite not found.',
  },
},
```

- [ ] In the pt-BR messages object, add:

```ts
workspaces: {
  kicker:  'Bem-vindo',
  heading: 'Seus workspaces',
  pick:    'Escolha um workspace para continuar.',
  none:    'Você ainda não faz parte de nenhum workspace.',
},
invite: {
  title:          'Convite',
  nameRequired:   'Informe seu nome para aceitar.',
  nameLabel:      'Seu nome',
  acceptingAs:    (name: string) => `Você entrará como ${name}.`,
  confirmHeading: (workspace: string, role: string) => `Aceitar convite para ${workspace} como ${role}`,
  confirmBody:    'Ao aceitar, você entrará neste workspace com a função acima.',
  accept:         'Aceitar convite',
  accepting:      'Aceitando…',
  roles: {
    owner:  'proprietário',
    member: 'membro',
  },
  error: {
    notFound: 'Este convite não foi encontrado.',
    expired:  'Este convite expirou.',
    used:     'Este convite já foi aceito.',
    revoked:  'Este convite foi revogado.',
    generic:  'Este convite não é mais válido.',
    goHome:   'Ir para o painel',
  },
  email: {
    subject:  (workspace: string) => `Você foi convidado para ${workspace}`,
    greeting: 'Olá,',
    body:     (workspace: string, role: string) => `Você foi convidado para entrar em ${workspace} como ${role}.`,
    cta:      'Aceitar convite',
    ignore:   'Se você não esperava este e-mail, pode ignorá-lo.',
  },
  errors: {
    accept:   'Não foi possível aceitar o convite.',
    notFound: 'Convite não encontrado.',
  },
},
```

- [ ] Run: `npx tsc --noEmit` → expected: exit 0 (both locale objects satisfy the extended `Messages` type)
- [ ] Commit:
  ```
  git add lib/i18n/messages.ts
  git commit -m "feat(i18n): workspaces + invite message namespaces (en, pt-BR)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.7: Workspace home stub route `/workspace/[workspaceId]`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/entry.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/contract.ts`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/layout.tsx`
- Create: `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/page.tsx`

**Interfaces:**
- Consumes: `requireWorkspaceRole`, `WorkspaceGuardError` from `@/app/workspace/guards` (6.3); `createRoute`, `ParseContext` from `@/lib/route-registry`; identify + dashboard entries.
- Produces: `entry` with `href({ workspaceId }: { workspaceId: string }): string` (`/workspace/<id>`) and `parse`; `route` with exits `login({ workspaceId })`, `dashboard()`. This entry is the redirect target of the dispatcher (6.9), the invite accept flow (6.11), and the middleware rewrite (6.13).

**Steps:**

- [ ] Write `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/entry.ts`:

```ts
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

/**
 * Workspace home. The canonical tenant-scoped tree lives under
 * `/workspace/[workspaceId]/…` — the multi-tenant middleware rewrites
 * `<slug>.<base-domain>/…` onto it (see middleware.ts + docs/tenancy.md).
 */
const schema = z.object({
  workspaceId: z.string().regex(/^\d+$/),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params) => `/workspace/${p.workspaceId}`,
  parse: (ctx: ParseContext) => schema.parse(ctx.params),
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/contract.ts`:

```ts
import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as identifyEntry } from '@/app/auth/identify/entry'
import { entry as dashboardEntry } from '@/app/dashboard/entry'

export const route = createRoute({
  entry,
  exits: {
    /** Unauthenticated visitor → login, carrying this workspace as returnTo. */
    login: (p: { workspaceId: string }) =>
      identifyEntry.href({ returnTo: entry.href({ workspaceId: p.workspaceId }) }),
    /** Authenticated but not a member → back to the dispatcher. */
    dashboard: () => dashboardEntry.href(),
  },
})
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/layout.tsx` (the chokepoint guard for the whole tenant tree — one layout gates every `/workspace/[workspaceId]/*` page):

```tsx
import { redirect } from 'next/navigation'
import { requireWorkspaceRole, WorkspaceGuardError } from '@/app/workspace/guards'
import { route } from './contract'

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  try {
    await requireWorkspaceRole(workspaceId, ['owner', 'member'])
  } catch (e) {
    if (e instanceof WorkspaceGuardError && e.reason === 'unauthenticated') {
      redirect(route.exits.login({ workspaceId }))
    }
    redirect(route.exits.dashboard())
  }
  return <>{children}</>
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/workspace/[workspaceId]/page.tsx` (stub home; uncached I/O resolves inside the Suspense child per Next 16 Cache Components):

```tsx
import { Suspense } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { workspaces } from '@/db/schema'

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center" aria-busy="true">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        </main>
      }
    >
      <WorkspaceHome workspaceId={workspaceId} />
    </Suspense>
  )
}

async function WorkspaceHome({ workspaceId }: { workspaceId: string }) {
  const [workspace] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, Number(workspaceId)))
    .limit(1)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Workspace</p>
      <h1 className="text-2xl font-semibold">{workspace?.name ?? 'Workspace'}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This is the workspace home stub. Build your tenant-scoped app under{' '}
        <code>app/workspace/[workspaceId]/</code> — see <code>docs/tenancy.md</code>.
      </p>
    </main>
  )
}
```

- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
  ```
  git add "app/workspace/[workspaceId]"
  git commit -m "feat(tenancy): /workspace/[workspaceId] home stub with requireWorkspaceRole layout guard

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.8: Onboarding stub route `/onboarding`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/app/onboarding/entry.ts`
- Create: `/Users/luca/dev/winter-park/template/app/onboarding/contract.ts`
- Create: `/Users/luca/dev/winter-park/template/app/onboarding/layout.tsx`
- Create: `/Users/luca/dev/winter-park/template/app/onboarding/page.tsx`

**Interfaces:**
- Consumes: `getSession` from `@/lib/auth/session`; identify + dashboard entries.
- Produces: `entry` with `href(): string` (`/onboarding`); `route` with exits `login()`, `dashboard()`. Redirect target of the dispatcher's 0-membership branch (6.9).

**Steps:**

- [ ] Write `/Users/luca/dev/winter-park/template/app/onboarding/entry.ts`:

```ts
import type { ParseContext } from '@/lib/route-registry'

/**
 * Post-login onboarding stub. The dispatcher sends users with ZERO workspace
 * memberships here. Replace this route's page with your app's real
 * create-first-workspace flow — see docs/tenancy.md.
 */
export type Params = Record<string, never>

export const entry = {
  href:  (_p: Params = {} as Params) => '/onboarding',
  parse: (_ctx: ParseContext) => ({} as Params),
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/onboarding/contract.ts`:

```ts
import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as identifyEntry } from '@/app/auth/identify/entry'
import { entry as dashboardEntry } from '@/app/dashboard/entry'

export const route = createRoute({
  entry,
  exits: {
    login:     () => identifyEntry.href({ returnTo: entry.href() }),
    dashboard: () => dashboardEntry.href(),
  },
})
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/onboarding/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { route } from './contract'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect(route.exits.login())
  return <>{children}</>
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/onboarding/page.tsx`:

```tsx
export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Onboarding</p>
      <h1 className="text-2xl font-semibold">Create your first workspace</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This is a stub route: the post-login dispatcher sends users with zero
        workspace memberships here. Replace it with your app&apos;s onboarding flow
        (create a <code>workspaces</code> row + an <code>owner</code> membership) —
        see <code>docs/tenancy.md</code>.
      </p>
    </main>
  )
}
```

- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
  ```
  git add app/onboarding
  git commit -m "feat(tenancy): /onboarding stub route (dispatcher zero-membership target)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.9: Post-login dispatcher — rebuild `/dashboard`

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/app/dashboard/contract.ts` (add 2 exits; currently 10 lines)
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/dashboard/page.tsx` (currently 11 lines)

**Interfaces:**
- Consumes: `getUserWorkspaces`, `isPlatformAdmin` (6.5); `getSession`; `getCurrentLocale`, `t` (phase 4 + 6.6); workspace entry (6.7); onboarding entry (6.8); existing `LogoutButton` + `fixtures` at `app/dashboard/_components/LogoutButton/`.
- Produces: dispatcher behavior — 0 memberships (non-admin) → `/onboarding`; exactly 1 → `/workspace/<id>`; N (or admin with 0) → picker list. `route.exits.onboarding()`, `route.exits.workspace({ workspaceId })`.

**Steps:**

- [ ] Replace the content of `/Users/luca/dev/winter-park/template/app/dashboard/contract.ts` with:

```ts
import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as identifyEntry } from '@/app/auth/identify/entry'
import { entry as onboardingEntry } from '@/app/onboarding/entry'
import { entry as workspaceEntry } from '@/app/workspace/[workspaceId]/entry'

export const route = createRoute({
  entry,
  exits: {
    login:      identifyEntry.href,
    onboarding: () => onboardingEntry.href(),
    workspace:  (p: { workspaceId: string }) => workspaceEntry.href({ workspaceId: p.workspaceId }),
  },
})
```

- [ ] Replace the content of `/Users/luca/dev/winter-park/template/app/dashboard/page.tsx` with exactly (source pattern: `/Users/luca/dev/winter-park/irene/app/dashboard/page.tsx` — Suspense-wrapped async child with redirects inside the boundary; irene-isms removed: `Tile/Badge/IconChip/SectionLabel/buttonVariants` + terracotta/sage/honey/charcoal tones → plain template UI, `homeFor(role)` role-routing → single workspace home, `ROLE_META` → plain role text, `COPY` map w/ pt-BR fallback → `t(locale).workspaces`, admin-entry shortcut dropped — template has no `/admin` routes, `es` locale dropped):

```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getCurrentLocale } from '@/lib/i18n/getLocale'
import { t } from '@/lib/i18n/messages'
import { getUserWorkspaces, isPlatformAdmin } from '@/lib/workspace/memberships'
import { route } from './contract'
import { LogoutButton } from './_components/LogoutButton/LogoutButton'
import { fixtures } from './_components/LogoutButton/fixtures'

/**
 * Post-login dispatcher. Resolves the user's workspace memberships:
 *   - exactly one   → redirect straight into it (no need to pick)
 *   - more than one → render a picker (plain example UI — restyle per app)
 *   - none          → redirect to /onboarding to create the first workspace
 *                     (platform admins are exempt — they keep the dashboard
 *                     even with no workspace of their own)
 *
 * Uncached I/O (session cookie + DB) resolves inside the <Suspense> child so
 * Next 16 Cache Components doesn't flag the route as blocking navigation, and
 * so the redirect-when-single still fires from within the boundary.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardHome />
    </Suspense>
  )
}

async function DashboardHome() {
  const session = await getSession()
  if (!session) redirect(route.exits.login())

  const memberships = await getUserWorkspaces(Number(session.userId))

  // Exactly one membership → skip the picker, go straight to the workspace.
  if (memberships.length === 1) {
    redirect(route.exits.workspace({ workspaceId: String(memberships[0].id) }))
  }

  const admin = await isPlatformAdmin(Number(session.userId))

  // Zero memberships → first-run: send to onboarding to create the first
  // workspace (instead of dead-ending on an empty list). Platform admins are
  // exempt — they keep the dashboard even with no workspace of their own.
  if (memberships.length === 0 && !admin) redirect(route.exits.onboarding())

  const locale = await getCurrentLocale()
  const m = t(locale).workspaces

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <div className="space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{m.kicker}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{m.heading}</h1>
          <p className="text-sm text-muted-foreground">{memberships.length ? m.pick : m.none}</p>
        </header>

        {memberships.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {memberships.map((w) => (
              <li key={w.id}>
                <Link
                  href={route.exits.workspace({ workspaceId: String(w.id) })}
                  className="block rounded-lg border bg-card p-5 transition-colors hover:bg-muted"
                >
                  <p className="font-medium text-foreground">{w.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{w.role}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <footer className="flex items-center justify-between border-t pt-6">
          <LogoutButton initialState={fixtures.idle} />
        </footer>
      </div>
    </main>
  )
}

function DashboardFallback() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12" aria-busy="true">
      <div className="space-y-8">
        <div className="h-24 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </main>
  )
}
```

- [ ] Leave `/Users/luca/dev/winter-park/template/app/dashboard/layout.tsx` and `entry.ts` unchanged (the layout session guard stays the chokepoint; the in-boundary `getSession` check above mirrors irene's belt-and-suspenders).
- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
  ```
  git add app/dashboard/contract.ts app/dashboard/page.tsx
  git commit -m "feat(tenancy): post-login dispatcher — 0→onboarding, 1→workspace home, N→picker

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.10: `lib/invite/` — roles, pure validity check (TDD: single-use), Resend email

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/invite/validate.test.ts` (FIRST — TDD)
- Create: `/Users/luca/dev/winter-park/template/lib/invite/validate.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/invite/roles.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/invite/send-email.ts`

**Interfaces:**
- Consumes: `t`, `Locale` from `lib/i18n` (6.6); `resend` package (already a template dep).
- Produces: `WORKSPACE_ROLES` (`['owner','member'] as const`), `WorkspaceRole`, `INVITABLE_ROLES` (`['member'] as const`), `InvitableRole`, `isInvitableRole(v: string): v is InvitableRole` from `@/lib/invite/roles`; `validateInvite(row: { status: string; expiresAt: Date } | null | undefined, now?: Date): { ok: true } | { ok: false; reason: 'notFound' | 'expired' | 'used' | 'revoked' }` from `@/lib/invite/validate`; `getBaseUrl(): Promise<string>` + `sendInviteEmail(input: { to: string; token: string; workspaceName: string; role: string; locale: Locale }): Promise<{ ok: boolean }>` from `@/lib/invite/send-email`.

**Steps:**

- [ ] Write the failing test `/Users/luca/dev/winter-park/template/lib/invite/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateInvite } from './validate'

const NOW = new Date('2026-07-08T12:00:00Z')
const FUTURE = new Date('2026-07-15T12:00:00Z')
const PAST = new Date('2026-07-01T12:00:00Z')

describe('validateInvite', () => {
  it('accepts a pending, unexpired invite', () => {
    expect(validateInvite({ status: 'pending', expiresAt: FUTURE }, NOW)).toEqual({ ok: true })
  })

  it('is single-use: an accepted invite reports "used"', () => {
    // The accept transaction flips status pending → accepted; a second visit
    // with the same token must be rejected.
    expect(validateInvite({ status: 'accepted', expiresAt: FUTURE }, NOW)).toEqual({
      ok: false,
      reason: 'used',
    })
  })

  it('rejects a revoked invite', () => {
    expect(validateInvite({ status: 'revoked', expiresAt: FUTURE }, NOW)).toEqual({
      ok: false,
      reason: 'revoked',
    })
  })

  it('rejects an explicitly expired status', () => {
    expect(validateInvite({ status: 'expired', expiresAt: FUTURE }, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('treats a pending invite past expiresAt as expired regardless of status', () => {
    expect(validateInvite({ status: 'pending', expiresAt: PAST }, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('reports notFound for a missing row', () => {
    expect(validateInvite(null, NOW)).toEqual({ ok: false, reason: 'notFound' })
    expect(validateInvite(undefined, NOW)).toEqual({ ok: false, reason: 'notFound' })
  })

  it('rejects unknown statuses as notFound (never trusts weird rows)', () => {
    expect(validateInvite({ status: 'draft', expiresAt: FUTURE }, NOW)).toEqual({
      ok: false,
      reason: 'notFound',
    })
  })
})
```

- [ ] Run: `npx vitest run lib/invite/validate.test.ts` → expected: FAIL (`Cannot find module './validate'`)
- [ ] Write `/Users/luca/dev/winter-park/template/lib/invite/validate.ts` (pure — extracted from the status/expiry checks duplicated in irene's `loadInvite.ts` lines 46-51 and `AcceptForm/actions.ts` lines 66-71, so page-load and accept-action can never diverge):

```ts
/**
 * Pure invite-validity check, shared by the invite page loader
 * (app/invite/[token]/_lib/loadInvite.ts) and the accept action. The token is
 * the only credential, so ALL status/expiry checks happen server-side against
 * the loaded row — never trust the client.
 *
 * Single-use invariant: the accept transaction flips status
 * pending → accepted guarded by `status = 'pending'`; any subsequent load of
 * the same token lands in the 'used' branch here.
 */
export type InviteStatusRow = {
  /** 'pending' | 'accepted' | 'revoked' | 'expired' (text column). */
  status:    string
  expiresAt: Date
}

export type InviteValidation =
  | { ok: true }
  | { ok: false; reason: 'notFound' | 'expired' | 'used' | 'revoked' }

export function validateInvite(
  row: InviteStatusRow | null | undefined,
  now: Date = new Date(),
): InviteValidation {
  if (!row) return { ok: false, reason: 'notFound' }
  if (row.status === 'revoked') return { ok: false, reason: 'revoked' }
  if (row.status === 'accepted') return { ok: false, reason: 'used' }
  if (row.status === 'expired' || row.expiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: 'expired' }
  }
  if (row.status !== 'pending') return { ok: false, reason: 'notFound' }
  return { ok: true }
}
```

- [ ] Run: `npx vitest run lib/invite/validate.test.ts` → expected: PASS (7 tests)
- [ ] Write `/Users/luca/dev/winter-park/template/lib/invite/roles.ts` (source: `/Users/luca/dev/winter-park/irene/lib/invite/roles.ts` — `SALON_ROLES ['owner','professional','attendant']`→`WORKSPACE_ROLES ['owner','member']`, `INVITABLE_ROLES ['professional','attendant']`→`['member']`, prose de-salon'd):

```ts
/**
 * The workspace roles an invite may grant. Mirrors the seeded vocabulary of
 * the `workspace_members.role` TEXT column — extend BOTH together when your
 * app adds roles. Owner is intentionally excluded from the invite UI's
 * selectable roles — workspace ownership is not handed out via the team
 * invite form — but the type still includes it so a label can be rendered
 * for any existing member/invite row.
 */
export const WORKSPACE_ROLES = ['owner', 'member'] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

/** Roles selectable in an invite form. */
export const INVITABLE_ROLES = ['member'] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

export function isInvitableRole(v: string): v is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(v)
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/lib/invite/send-email.ts` (source: `/Users/luca/dev/winter-park/irene/lib/invite/send-email.ts` — edits enumerated: `salonName`→`workspaceName` param; `role: SalonRole`→`role: string` w/ `m.roles[input.role] ?? input.role` fallback; drop `import type { SalonRole } from './roles'`; docblock line "pt-BR is the primary locale for the body" → "English is the default locale"; the `from` fallback matches the template's existing OTP-email fallback):

```ts
import { headers } from 'next/headers'
import { Resend } from 'resend'
import { t } from '@/lib/i18n/messages'
import type { Locale } from '@/lib/i18n/types'

/**
 * Resolve the absolute base URL for invite links.
 *
 * Mirrors what the rest of the codebase uses for absolute URLs: the
 * `NEXT_PUBLIC_APP_URL` env (set in `.env` to `http://localhost:3000`).
 * When it's absent we derive it from the incoming request's `host` header
 * (and `x-forwarded-proto`) so the link still points back at the caller.
 */
export async function getBaseUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')

  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Sends the invite email via Resend (same construction as the auth OTP flow:
 * `new Resend(RESEND_API_KEY)` + `resend.emails.send`, `from` =
 * `RESEND_FROM_EMAIL`). Email copy is localized via lib/i18n; English is the
 * default locale.
 *
 * Returns `{ ok }` — the caller decides whether a send failure should fail
 * the whole action.
 */
export async function sendInviteEmail(input: {
  to:            string
  token:         string
  workspaceName: string
  role:          string
  locale:        Locale
}): Promise<{ ok: boolean }> {
  const baseUrl = await getBaseUrl()
  const acceptUrl = `${baseUrl}/invite/${input.token}`
  const m = t(input.locale).invite
  const roleLabel = m.roles[input.role] ?? input.role

  const { error } = await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@verify.prolizz.com',
    to:      input.to,
    subject: m.email.subject(input.workspaceName),
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5;">
        <p>${m.email.greeting}</p>
        <p>${m.email.body(input.workspaceName, roleLabel)}</p>
        <p>
          <a href="${acceptUrl}"
             style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:6px;text-decoration:none;">
            ${m.email.cta}
          </a>
        </p>
        <p style="color:#888;font-size:13px;">${acceptUrl}</p>
        <p style="color:#888;font-size:13px;">${m.email.ignore}</p>
      </div>
    `,
  })

  return { ok: !error }
}
```

- [ ] Run: `npx tsc --noEmit` → expected: exit 0; `npx vitest run lib/invite` → expected: PASS
- [ ] Commit:
  ```
  git add lib/invite
  git commit -m "feat(invite): roles vocabulary, pure single-use validity check (tested), Resend invite email

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.11: `/invite/[token]` route — loader, AcceptForm section, page

**Files:**
- Create: `/Users/luca/dev/winter-park/template/app/invite/[token]/entry.ts`
- Create: `/Users/luca/dev/winter-park/template/app/invite/[token]/contract.ts`
- Create: `/Users/luca/dev/winter-park/template/app/invite/[token]/_lib/loadInvite.ts`
- Create: `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/state.ts`
- Create: `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/transition.ts`
- Create: `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/scene.ts`
- Create: `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/fixtures.ts`
- Create: `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/actions.ts`
- Create: `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/useAcceptForm.ts`
- Create: `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/Component.tsx`
- Create: `/Users/luca/dev/winter-park/template/app/invite/[token]/page.tsx`

**Interfaces:**
- Consumes: `validateInvite` (6.10); `invites`, `workspaces`, `workspaceMembers`, `persons`, `users`, `sessions` from `@/db/schema`; `runAction`/`mapResult`/`dbE`/`validate`/`NotFound`/`ValidationFailed` from `lib/effect` (phase 3); `createSessionToken` from `@/lib/auth/jwt` + `AUTH_SESSION_COOKIE` from `@/lib/auth/identifier` (phase 5); `getPublicLocale`, `getCurrentLocale`, `t`, `LocaleProvider`, `useT` (phase 4 + 6.6); workspace entry (6.7); `createScene` from `@/lib/scene`; `Button`, `Input`, `Label` from `components/ui`.
- Produces: `acceptInvite(input: { token: string; name?: string }): Promise<AcceptInviteResult>` where `AcceptInviteResult = { success: true; workspaceId: string; role: string } | { success: false; error: string; needsName?: boolean }`; `loadInvite(token: string): Promise<InviteLoad>`; invite entry `href({ token })` → `/invite/<token>`.

**Steps:**

- [ ] Write `/Users/luca/dev/winter-park/template/app/invite/[token]/entry.ts` (source: irene same path; prose unchanged):

```ts
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

/**
 * Public invite-accept page.
 *
 * URL: /invite/:token  — `token` is the invite's `crypto.randomUUID()`.
 */
const schema = z.object({
  token: z.string(),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params) => `/invite/${p.token}`,
  parse: (ctx: ParseContext) => schema.parse(ctx.params),
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/invite/[token]/contract.ts` (source: irene contract — edits: role-specific `owner/attendant/professional` exits collapse to one `workspace` exit; `login` exit dropped — magic-link accept needs no prior sign-in; `home: () => '/'` raw string → typed `dashboard` exit):

```ts
import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as workspaceEntry } from '@/app/workspace/[workspaceId]/entry'
import { entry as dashboardEntry } from '@/app/dashboard/entry'

/**
 * Invite-accept page contract.
 *
 * Exits:
 *   - `workspace` — the accepted workspace's home (post-accept landing).
 *   - `dashboard` — neutral landing for the error states.
 */
export const route = createRoute({
  entry,
  exits: {
    workspace: (p: { workspaceId: string }) => workspaceEntry.href({ workspaceId: p.workspaceId }),
    dashboard: () => dashboardEntry.href(),
  },
})
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/invite/[token]/_lib/loadInvite.ts` (source: irene `_lib/loadInvite.ts` — edits enumerated: `invite/salon/person`→`invites/workspaces/persons`; `salonId/salonName`→`workspaceId/workspaceName`; `role: SalonRole`→`role: string`; inline status checks → shared `validateInvite`; `person.lastName` concat → single `persons.name`):

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { invites, workspaces, persons } from '@/db/schema'
import { validateInvite } from '@/lib/invite/validate'

export type InviteLoad =
  | {
      ok: true
      invite: {
        id:            number
        workspaceId:   number
        workspaceName: string
        email:         string
        role:          string
        token:         string
        /** Existing name on record for the invite's email, or null if brand-new. */
        existingName: string | null
      }
    }
  | { ok: false; reason: 'notFound' | 'expired' | 'used' | 'revoked' }

/**
 * Loads an invite by token and validates it server-side. The token is the only
 * credential, so the lookup is by token alone; all status/expiry checks happen
 * in `validateInvite` (never trust the client). Joins the workspace for its
 * display name, and looks up whether the invited email already has a `persons`
 * record (so the accept screen can pre-fill the name).
 */
export async function loadInvite(token: string): Promise<InviteLoad> {
  const [row] = await db
    .select({
      id:            invites.id,
      workspaceId:   invites.workspaceId,
      email:         invites.email,
      role:          invites.role,
      token:         invites.token,
      status:        invites.status,
      expiresAt:     invites.expiresAt,
      workspaceName: workspaces.name,
    })
    .from(invites)
    .innerJoin(workspaces, eq(workspaces.id, invites.workspaceId))
    .where(eq(invites.token, token))
    .limit(1)

  const validity = validateInvite(row)
  if (!validity.ok) return validity

  const [pers] = await db
    .select({ name: persons.name })
    .from(persons)
    .where(eq(persons.email, row.email))
    .limit(1)
  const existingName = pers?.name?.trim() || null

  return {
    ok: true,
    invite: {
      id:            row.id,
      workspaceId:   row.workspaceId,
      workspaceName: row.workspaceName,
      email:         row.email,
      role:          row.role,
      token:         row.token,
      existingName,
    },
  }
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/state.ts` (source: irene, verbatim):

```ts
/**
 * AcceptForm state — Type 5 (client + action). `idle` shows the confirm
 * button; `submitting` disables it; `success` fires the redirect; `error`
 * re-shows the button with a message.
 */
export type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; redirectTo: string }
  | { status: 'error'; message: string }

export type Event =
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; redirectTo: string }
  | { type: 'ERROR'; message: string }
  | { type: 'RETRY' }
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/transition.ts` (source: irene, verbatim):

```ts
import type { State, Event } from './state'

export function transition(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      if (event.type === 'SUBMIT') return { status: 'submitting' }
      break
    case 'submitting':
      if (event.type === 'SUCCESS') return { status: 'success', redirectTo: event.redirectTo }
      if (event.type === 'ERROR')   return { status: 'error', message: event.message }
      break
    case 'error':
      if (event.type === 'RETRY')  return { status: 'idle' }
      if (event.type === 'SUBMIT') return { status: 'submitting' }
      break
  }
  return state
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/scene.ts` (source: irene, verbatim):

```ts
import { createScene } from '@/lib/scene'
import { transition } from './transition'

export const scene = createScene(transition, { minStay: 1000 })
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/fixtures.ts` (source: irene, verbatim):

```ts
import type { State } from './state'

export const fixtures = {
  idle:       { status: 'idle' } satisfies State,
  submitting: { status: 'submitting' } satisfies State,
  success:    { status: 'success', redirectTo: '/dashboard' } satisfies State,
  error:      { status: 'error', message: 'Failed to accept invite.' } satisfies State,
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/actions.ts` (source: irene `AcceptForm/actions.ts` — edits enumerated: `invite/salonMember/person/user/session`→`invites/workspaceMembers/persons/users/sessions`; `salonId`→`workspaceId`; `firstName`/`lastName` fields→single `name` (template `persons` has one `name` column); `professional`-row provisioning block (irene lines 121-137) DELETED — salon-specific; `Tag.team`/`Tag.professionals` cache invalidation tap (irene lines 175-180) DELETED — template has no cached team views yet; cookie literal `'session_token'`→`AUTH_SESSION_COOKIE` import; `jwtToken:` insert field→`token:` (template `sessions` column); result `role` narrowed union→`string`; error copy via `m.invite.errors.*`):

```ts
'use server'

import { Effect, pipe } from 'effect'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { db } from '@/db/drizzle'
import { invites, workspaceMembers, persons, users, sessions } from '@/db/schema'
import { createSessionToken } from '@/lib/auth/jwt'
import { AUTH_SESSION_COOKIE } from '@/lib/auth/identifier'
import { getCurrentLocale } from '@/lib/i18n/getLocale'
import { t } from '@/lib/i18n/messages'
import { validateInvite } from '@/lib/invite/validate'
import { runAction } from '@/lib/effect/run-action'
import { mapResult } from '@/lib/effect/boundary'
import { dbE } from '@/lib/effect/db'
import { validate } from '@/lib/effect/validate'
import { NotFound, ValidationFailed } from '@/lib/effect/errors'

const acceptSchema = z.object({
  token: z.string().min(1),
  name:  z.string().trim().max(120).optional(),
})

export type AcceptInviteInput = z.infer<typeof acceptSchema>

export type AcceptInviteResult =
  | { success: true; workspaceId: string; role: string }
  | { success: false; error: string; needsName?: boolean }

/**
 * Magic-link accept. The invite TOKEN (delivered only to the invitee's email)
 * is the credential — NO prior sign-in is required. We:
 *   1. re-validate the token + 'pending' status + expiry server-side,
 *   2. find-or-create the `persons` row for the invite's email (creating one
 *      needs a name — the form collects/confirms it),
 *   3. find-or-create the `users` row and the `workspace_members` row (role
 *      from the invite),
 *   4. mark the invite accepted (guarded by status='pending' → SINGLE-USE),
 *   5. MINT A SESSION + set the session cookie (logs them in),
 * then return the workspaceId + role so the section routes into the workspace.
 */
const acceptInviteE = (raw: unknown) => pipe(
  Effect.Do,
  Effect.bind('input', () => validate(acceptSchema, raw)),

  // Server-side token + status + expiry validation (client supplies only token).
  Effect.bind('inviteRow', ({ input }) =>
    pipe(
      dbE.findFirst(
        db
          .select({
            id:          invites.id,
            workspaceId: invites.workspaceId,
            email:       invites.email,
            role:        invites.role,
            status:      invites.status,
            expiresAt:   invites.expiresAt,
          })
          .from(invites)
          .where(eq(invites.token, input.token))
          .limit(1),
      ),
      Effect.flatMap((row) => {
        if (!row) return Effect.fail(new NotFound({ entity: 'invite' }))
        const validity = validateInvite(row)
        if (!validity.ok) return Effect.fail(new NotFound({ entity: 'invite' }))
        return Effect.succeed(row)
      }),
    ),
  ),

  // A brand-new invitee (no persons row for this email yet) must supply a
  // name. Surface a typed validation error so the form can show the field.
  Effect.bind('existingPerson', ({ inviteRow }) =>
    dbE.findFirst(
      db.select({ id: persons.id }).from(persons).where(eq(persons.email, inviteRow.email)).limit(1),
    ),
  ),
  Effect.tap(({ existingPerson, input }) =>
    existingPerson || (input.name ?? '').trim().length > 0
      ? Effect.void
      : Effect.fail(new ValidationFailed({ message: 'NAME_REQUIRED' })),
  ),

  // Provision identity + membership in one transaction → returns the userId.
  Effect.bind('provision', ({ input, inviteRow }) =>
    dbE.transaction(async (tx) => {
      const name = (input.name ?? '').trim()

      let [p] = await tx
        .select({ id: persons.id })
        .from(persons)
        .where(eq(persons.email, inviteRow.email))
        .limit(1)
      if (!p) {
        const [created] = await tx
          .insert(persons)
          .values({ name, email: inviteRow.email, emailVerified: true })
          .returning({ id: persons.id })
        p = created
      } else if (name) {
        // Existing record — the invitee VALIDATED/corrected their name on the
        // accept screen; persist any change. emailVerified flips true since
        // they just proved control of the email via the invite link.
        await tx
          .update(persons)
          .set({ name, emailVerified: true })
          .where(eq(persons.id, p.id))
      }

      let [u] = await tx.select({ id: users.id }).from(users).where(eq(users.personId, p.id)).limit(1)
      if (!u) {
        const [created] = await tx.insert(users).values({ personId: p.id }).returning({ id: users.id })
        u = created
      }

      await tx
        .insert(workspaceMembers)
        .values({ workspaceId: inviteRow.workspaceId, userId: u.id, role: inviteRow.role })
        .onConflictDoNothing({ target: [workspaceMembers.workspaceId, workspaceMembers.userId] })

      // SINGLE-USE: only a still-pending invite flips to accepted.
      await tx
        .update(invites)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(and(eq(invites.id, inviteRow.id), eq(invites.status, 'pending')))

      return { userId: u.id }
    }),
  ),

  // Log the invitee in — mint a session row + set the session cookie.
  Effect.tap(({ provision }) =>
    dbE.run((async () => {
      const token = await createSessionToken({ userId: provision.userId })
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)
      const h = await headers()
      await db.insert(sessions).values({
        userId:    provision.userId,
        token,
        expiresAt,
        userAgent: h.get('user-agent') ?? undefined,
        ipAddress: h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? undefined,
      })
      const c = await cookies()
      c.set(AUTH_SESSION_COOKIE, token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   60 * 60 * 24 * 30,
        path:     '/',
      })
      return undefined
    })()),
  ),

  Effect.map(({ inviteRow }) => ({
    workspaceId: String(inviteRow.workspaceId),
    role:        inviteRow.role,
  })),
)

export async function acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
  const locale = await getCurrentLocale()
  const m = t(locale).invite

  const result = await runAction(acceptInviteE(input), {
    actionName: 'acceptInvite',
    timeout:    '10 seconds',
    attributes: {},
  })

  // Surface the "needs a name" validation specially so the form can react.
  if (!result.success && result.kind === 'ValidationFailed' && result.error === 'NAME_REQUIRED') {
    return { success: false, error: m.nameRequired, needsName: true }
  }

  return mapResult(result, {
    fallback: m.errors.accept,
    notFound: m.errors.notFound,
  })
}
```

  Note: if phase 5's `createSessionToken` payload still requires `email`, pass `{ userId: provision.userId, email: inviteRow.email }` (adapt to the landed `SessionPayload`; the landed phase wins). If phase 5 renamed the `sessions.token` column, use the landed column name.

- [ ] Write `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/useAcceptForm.ts` (source: irene — edits: `SalonRole` role-routing `redirectFor()` DELETED (single workspace exit); `firstName`/`lastName` states→one `name`; `showName` always-true flag dropped — the name field always renders):

```ts
import { useState } from 'react'
import { route } from '../../contract'
import { scene } from './scene'
import { acceptInvite } from './actions'

type Args = {
  token:        string
  existingName: string | null
}

/**
 * Accept-invite form logic. Holds the name input (pre-filled from any name
 * already on file so the invitee validates/corrects it) and orchestrates the
 * magic-link accept: one click provisions identity + a session and lands the
 * invitee in the workspace.
 */
export function useAcceptForm({ token, existingName }: Args) {
  const [state, send] = scene.useScene({ status: 'idle' } as const)
  const [name, setName] = useState(() => existingName ?? '')

  const accept = async () => {
    if (state.status === 'submitting') return
    send({ type: 'SUBMIT' })
    const result = await acceptInvite({ token, name: name.trim() || undefined })
    if (result.success) {
      // Accept LOGS THE INVITEE IN (new session cookie). A soft router.push
      // wouldn't reliably pick up the fresh session, so hard-navigate — this
      // guarantees they land in their workspace authenticated. Stays in
      // 'submitting' (button shows "Accepting…") until the page unloads.
      window.location.assign(route.exits.workspace({ workspaceId: result.workspaceId }))
      return
    }
    send({ type: 'ERROR', message: result.error })
  }

  return { state, accept, name, setName }
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/invite/[token]/_sections/AcceptForm/Component.tsx` (source: irene — edits: `Field/Badge/Avatar/IconChip/SectionLabel` + `shadow-bento`/`sage`/`honey` tones → plain template primitives (`Input`, `Label`, `Button`) and semantic classes; facts-panel bento → single confirm block; `roles[role]` lookup gains `?? role` fallback for app-extended roles):

```tsx
'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useT } from '@/lib/i18n/LocaleProvider'
import { useAcceptForm } from './useAcceptForm'

type Props = {
  token:         string
  workspaceId:   string
  workspaceName: string
  role:          string
  /** Existing name for the invited email, or null when brand-new. */
  existingName: string | null
}

/**
 * AcceptForm — magic-link accept. The invite token (from the invitee's email)
 * is the credential, so there's no separate sign-in: one click provisions
 * identity + a session and routes into the workspace. The name field is always
 * shown — enter it (new invitee) or confirm it (existing record).
 */
export function AcceptForm({ token, workspaceName, role, existingName }: Props) {
  const m = useT()
  const { state, accept, name, setName } = useAcceptForm({ token, existingName })

  const roleLabel = m.invite.roles[role] ?? role
  const isBusy = state.status === 'submitting' || state.status === 'success'
  const blocked = isBusy || name.trim().length === 0

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{m.invite.title}</p>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
          {m.invite.confirmHeading(workspaceName, roleLabel)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {existingName ? m.invite.acceptingAs(existingName) : m.invite.confirmBody}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invite-name">{m.invite.nameLabel}</Label>
        <Input
          id="invite-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>

      {state.status === 'error' && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p>
      )}

      <Button type="button" onClick={accept} disabled={blocked}>
        {isBusy ? m.invite.accepting : m.invite.accept}
      </Button>
    </div>
  )
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/app/invite/[token]/page.tsx` (source: irene — edits: `Card/IconChip/SectionLabel/buttonVariants` + charcoal/terracotta shell → plain bordered card; `salonId/salonName`→`workspaceId/workspaceName`; error exit `home`→`dashboard`; "IRENE" wordmark dropped):

```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { getPublicLocale } from '@/lib/i18n/getLocale'
import { t } from '@/lib/i18n/messages'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'
import { route } from './contract'
import { loadInvite, type InviteLoad } from './_lib/loadInvite'
import { AcceptForm } from './_sections/AcceptForm/Component'

type Props = {
  params:       Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Public invite-accept page. Magic-link accept: the token (from the invitee's
 * email) is the credential — no separate sign-in needed. The accept action
 * provisions identity + a session on accept.
 *
 * No top-level uncached awaits — everything resolves inside the Suspense'd
 * child per Next 16 Cache Components.
 */
export default async function InvitePage({ params, searchParams }: Props) {
  const p  = await params
  const sp = await searchParams
  const parsed = route.entry.parse({ params: p, searchParams: sp, cookies: {} })

  return (
    <Suspense
      fallback={
        <InviteShell>
          <div className="space-y-6" aria-busy="true">
            <div className="space-y-3">
              <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
              <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          </div>
        </InviteShell>
      }
    >
      <InviteContent token={parsed.token} />
    </Suspense>
  )
}

async function InviteContent({ token }: { token: string }) {
  const [locale, loaded] = await Promise.all([
    getPublicLocale(),
    loadInvite(token),
  ])
  const m = t(locale)

  if (!loaded.ok) {
    return (
      <LocaleProvider locale={locale}>
        <InviteShell>
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{m.invite.title}</p>
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
                {m.invite.title}
              </h1>
              <p className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {errorCopy(loaded, m)}
              </p>
            </div>
            <Link
              href={route.exits.dashboard()}
              className="block w-full rounded-md border px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted"
            >
              {m.invite.error.goHome}
            </Link>
          </div>
        </InviteShell>
      </LocaleProvider>
    )
  }

  return (
    <LocaleProvider locale={locale}>
      <InviteShell>
        <AcceptForm
          token={token}
          workspaceId={String(loaded.invite.workspaceId)}
          workspaceName={loaded.invite.workspaceName}
          role={loaded.invite.role}
          existingName={loaded.invite.existingName}
        />
      </InviteShell>
    </LocaleProvider>
  )
}

function errorCopy(loaded: Extract<InviteLoad, { ok: false }>, m: ReturnType<typeof t>): string {
  switch (loaded.reason) {
    case 'notFound': return m.invite.error.notFound
    case 'expired':  return m.invite.error.expired
    case 'used':     return m.invite.error.used
    case 'revoked':  return m.invite.error.revoked
    default:         return m.invite.error.generic
  }
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  )
}
```

- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
  ```
  git add "app/invite/[token]"
  git commit -m "feat(invite): /invite/[token] magic-link accept — loader, Effect accept action, AcceptForm section

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.12: Pluggable host resolver — `createHostResolver` (TDD)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/tenant/resolve-host.test.ts` (FIRST — TDD)
- Create: `/Users/luca/dev/winter-park/template/lib/tenant/resolve-host.ts`

**Interfaces:**
- Consumes: nothing (deliberately db-free — lookups are injected).
- Produces: `DEFAULT_RESERVED_SUBDOMAINS` (readonly tuple); `HostResolver = (rawHost: string | null | undefined) => Promise<number | null>`; `HostResolverConfig = { baseDomain?: string; reserved?: Iterable<string>; lookupSlug: (slug: string) => Promise<number | null>; lookupDomain: (host: string) => Promise<number | null>; cacheTtlMs?: number; now?: () => number }`; `createHostResolver(cfg: HostResolverConfig): HostResolver`.

**Steps:**

- [ ] Write the failing test `/Users/luca/dev/winter-park/template/lib/tenant/resolve-host.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createHostResolver } from './resolve-host'

function makeResolver(overrides: Partial<Parameters<typeof createHostResolver>[0]> = {}) {
  const lookupSlug = vi.fn(async (slug: string) => (slug === 'acme' ? 42 : null))
  const lookupDomain = vi.fn(async (host: string) => (host === 'www.acme.com' ? 42 : null))
  const resolve = createHostResolver({
    baseDomain: 'example.com',
    lookupSlug,
    lookupDomain,
    ...overrides,
  })
  return { resolve, lookupSlug, lookupDomain }
}

describe('createHostResolver — lookup chain', () => {
  it('returns null for empty / localhost / base / www / *.vercel.app hosts without any lookup', async () => {
    const { resolve, lookupSlug, lookupDomain } = makeResolver()
    expect(await resolve(null)).toBeNull()
    expect(await resolve('')).toBeNull()
    expect(await resolve('localhost')).toBeNull()
    expect(await resolve('localhost:3000')).toBeNull()
    expect(await resolve('example.com')).toBeNull()
    expect(await resolve('www.example.com')).toBeNull()
    expect(await resolve('my-app.vercel.app')).toBeNull()
    expect(lookupSlug).not.toHaveBeenCalled()
    expect(lookupDomain).not.toHaveBeenCalled()
  })

  it('resolves <slug>.<baseDomain> via lookupSlug (case-insensitive, port stripped)', async () => {
    const { resolve, lookupSlug, lookupDomain } = makeResolver()
    expect(await resolve('ACME.example.com:3000')).toBe(42)
    expect(lookupSlug).toHaveBeenCalledWith('acme')
    expect(lookupDomain).not.toHaveBeenCalled()
  })

  it('uses the label immediately left of the base domain for nested subdomains', async () => {
    const { resolve, lookupSlug } = makeResolver()
    await resolve('deep.acme.example.com')
    expect(lookupSlug).toHaveBeenCalledWith('acme')
  })

  it('never treats reserved labels as slugs', async () => {
    const { resolve, lookupSlug } = makeResolver()
    expect(await resolve('www.example.com')).toBeNull()
    expect(await resolve('app.example.com')).toBeNull()
    expect(await resolve('api.example.com')).toBeNull()
    expect(lookupSlug).not.toHaveBeenCalled()
  })

  it('falls through to lookupDomain for hosts outside the base domain', async () => {
    const { resolve, lookupSlug, lookupDomain } = makeResolver()
    expect(await resolve('www.acme.com')).toBe(42)
    expect(await resolve('unknown.io')).toBeNull()
    expect(lookupDomain).toHaveBeenCalledWith('www.acme.com')
    expect(lookupSlug).not.toHaveBeenCalled()
  })

  it('honors a custom reserved set', async () => {
    const { resolve, lookupSlug } = makeResolver({ reserved: ['acme'] })
    expect(await resolve('acme.example.com')).toBeNull()
    expect(lookupSlug).not.toHaveBeenCalled()
  })
})

describe('createHostResolver — 60s cache', () => {
  it('caches positive AND negative results per host for the TTL', async () => {
    let clock = 1_000_000
    const { resolve, lookupSlug } = makeResolver({ now: () => clock })
    expect(await resolve('acme.example.com')).toBe(42)
    expect(await resolve('acme.example.com')).toBe(42)
    expect(await resolve('nope.example.com')).toBeNull()
    expect(await resolve('nope.example.com')).toBeNull()
    expect(lookupSlug).toHaveBeenCalledTimes(2) // one per distinct host

    clock += 60_001 // past the default 60s TTL
    expect(await resolve('acme.example.com')).toBe(42)
    expect(lookupSlug).toHaveBeenCalledTimes(3) // re-fetched after expiry
  })
})
```

- [ ] Run: `npx vitest run lib/tenant/resolve-host.test.ts` → expected: FAIL (`Cannot find module './resolve-host'`)
- [ ] Write `/Users/luca/dev/winter-park/template/lib/tenant/resolve-host.ts` (source: `/Users/luca/dev/winter-park/irene/lib/tenant/resolve-host.ts` — edits enumerated: module-level `db`/`salon`/`salonDomain` imports + `lookupBySlug`/`lookupByCustomDomain` DB queries removed — lookups become injected config (`lookupSlug`/`lookupDomain`); module-level `BASE_DOMAIN`/`RESERVED`/`cache` constants move inside the factory; `resolveSalonByHost`→the returned closure; salon prose→workspace; `now` override added for testability; guard-name prose `requireOwner/Attendant/...`→`requireWorkspaceRole`):

```ts
/**
 * Maps an incoming HTTP host to a workspace id, for the multi-tenant
 * middleware.
 *
 *   <slug>.<baseDomain>       → workspace by `workspaces.slug` (via lookupSlug)
 *   a verified custom domain  → workspace via lookupDomain
 *   the base domain / www / *.vercel.app / localhost root → null (the main app)
 *
 * This is NOT a security boundary — it only decides WHICH workspace's pages a
 * host shows. The workspace layout guards (`requireWorkspaceRole`) remain the
 * wall, so a spoofed Host only ever reaches what its session may access.
 *
 * The DB lookups are INJECTED (`lookupSlug` / `lookupDomain`) so this module
 * stays db-agnostic and unit-testable; middleware.ts wires the real queries
 * from lib/tenant/lookups.ts.
 *
 * `baseDomain` is the domain workspaces are hosted under (e.g. "example.com");
 * it defaults to env `APP_BASE_DOMAIN`, then "localhost" so
 * `<slug>.localhost:3000` works in dev.
 *
 * Results (including nulls) are cached in-process per host for `cacheTtlMs`
 * (default 60s) so the middleware doesn't hit the DB on every request.
 */

/** Subdomains that are NEVER a workspace slug (marketing/app/infra hosts). */
export const DEFAULT_RESERVED_SUBDOMAINS = [
  'www', 'app', 'api', 'admin', 'auth', 'dashboard', 'staging', 'preview', 'staff', 'cdn',
] as const

export type HostResolver = (rawHost: string | null | undefined) => Promise<number | null>

export type HostResolverConfig = {
  /** Defaults to `process.env.APP_BASE_DOMAIN`, then 'localhost'. */
  baseDomain?: string
  /** Defaults to DEFAULT_RESERVED_SUBDOMAINS. */
  reserved?: Iterable<string>
  /** Slug → workspace id (or null). */
  lookupSlug: (slug: string) => Promise<number | null>
  /** Full host → workspace id via a verified custom domain (or null). Return null when the app has no custom-domain table. */
  lookupDomain: (host: string) => Promise<number | null>
  /** Positive+negative cache TTL in ms. Default 60_000. */
  cacheTtlMs?: number
  /** Clock override for tests. Default Date.now. */
  now?: () => number
}

type CacheHit = { id: number | null; exp: number }

export function createHostResolver(cfg: HostResolverConfig): HostResolver {
  const baseDomain = (cfg.baseDomain ?? process.env.APP_BASE_DOMAIN ?? 'localhost').toLowerCase()
  const reserved = new Set(cfg.reserved ?? DEFAULT_RESERVED_SUBDOMAINS)
  const ttl = cfg.cacheTtlMs ?? 60_000
  const now = cfg.now ?? Date.now
  const cache = new Map<string, CacheHit>()

  return async function resolveWorkspaceByHost(rawHost) {
    const host = (rawHost ?? '').split(':')[0].toLowerCase().trim()
    if (
      !host ||
      host === 'localhost' ||
      host === baseDomain ||
      host === `www.${baseDomain}` ||
      host.endsWith('.vercel.app')
    ) {
      return null
    }

    const cached = cache.get(host)
    if (cached && cached.exp > now()) return cached.id

    let id: number | null = null
    if (host.endsWith(`.${baseDomain}`)) {
      // The label immediately left of the base domain is the slug.
      const sub = host.slice(0, host.length - (baseDomain.length + 1))
      const label = sub.split('.').pop() ?? sub
      if (label && !reserved.has(label)) id = await cfg.lookupSlug(label)
    } else {
      // Not under our base domain → a workspace's own custom domain.
      id = await cfg.lookupDomain(host)
    }

    cache.set(host, { id, exp: now() + ttl })
    return id
  }
}
```

- [ ] Run: `npx vitest run lib/tenant/resolve-host.test.ts` → expected: PASS (8 tests)
- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
  ```
  git add lib/tenant/resolve-host.ts lib/tenant/resolve-host.test.ts
  git commit -m "feat(tenancy): pluggable createHostResolver (slug/domain lookup chain, 60s cache, tested)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.13: DB lookups + multi-tenant `middleware.ts`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/tenant/lookups.ts`
- Create: `/Users/luca/dev/winter-park/template/middleware.ts`

**Interfaces:**
- Consumes: `createHostResolver` (6.12); `workspaces` from `@/db/schema`; `/workspace/[workspaceId]` tree (6.7) as the rewrite target.
- Produces: `lookupWorkspaceBySlug(slug: string): Promise<number | null>`, `lookupWorkspaceByDomain(host: string): Promise<number | null>` from `@/lib/tenant/lookups`; root `middleware.ts` rewriting tenant hosts onto `/workspace/<id>/…`.

**Steps:**

- [ ] Write `/Users/luca/dev/winter-park/template/lib/tenant/lookups.ts` (source: the two lookup functions inlined in irene's `resolve-host.ts` lines 30-50 — edits: `salon`→`workspaces`; the `salonDomain` custom-domain query becomes a documented null stub — the template ships no domains table):

```ts
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { workspaces } from '@/db/schema'

/** Slug → workspace id. Soft-deleted workspaces never resolve. */
export async function lookupWorkspaceBySlug(slug: string): Promise<number | null> {
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), isNull(workspaces.deletedAt)))
    .limit(1)
  return row?.id ?? null
}

/**
 * Verified custom domain → workspace id. The template ships NO custom-domain
 * table, so this always returns null. To support customer-owned domains:
 *   1. add a `workspace_domains` table (workspace_id FK, domain text unique,
 *      verified boolean, deleted_at timestamptz),
 *   2. query it here (lower(domain) = host, verified = true, not deleted),
 *   3. provision/verify the domain on Vercel with lib/vercel/domains.ts.
 * See docs/tenancy.md → "Custom domains".
 */
export async function lookupWorkspaceByDomain(_host: string): Promise<number | null> {
  return null
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/middleware.ts` (source: `/Users/luca/dev/winter-park/irene/middleware.ts` — edits enumerated: `resolveSalonByHost` module import→`createHostResolver` wired with injected lookups; `/salon/`→`/workspace/` prefix check + rewrite; irene's bare-host special case `→ /salon/<id>/site` (public marketing site)→plain `/workspace/<id>` (template has no public-site tree); salon prose→workspace):

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createHostResolver } from '@/lib/tenant/resolve-host'
import { lookupWorkspaceBySlug, lookupWorkspaceByDomain } from '@/lib/tenant/lookups'

/**
 * Multi-tenant host routing. When a request arrives on a workspace's OWN host
 * (`<slug>.<base-domain>` or a verified custom domain), rewrite the path onto
 * the canonical `/workspace/<id>/…` tree so the host transparently serves that
 * workspace's pages.
 *
 * NOT a security boundary: this only decides WHICH workspace's pages a host
 * shows. The workspace layout guards (`requireWorkspaceRole`) remain the wall,
 * so a spoofed Host header only ever reaches what its session may access.
 * Resolution results are cached in-process for 60s (see resolve-host.ts).
 */
const resolveWorkspaceByHost = createHostResolver({
  lookupSlug:   lookupWorkspaceBySlug,
  lookupDomain: lookupWorkspaceByDomain,
})

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Already workspace-scoped → leave it (in-app /workspace/[id] links resolve as-is).
  if (pathname.startsWith('/workspace/')) return NextResponse.next()

  const workspaceId = await resolveWorkspaceByHost(req.headers.get('host'))
  if (workspaceId == null) return NextResponse.next()

  const url = req.nextUrl.clone()
  // Bare host → the workspace home; everything else maps 1:1 onto the
  // canonical /workspace/<id>/… tree.
  url.pathname = pathname === '/'
    ? `/workspace/${workspaceId}`
    : `/workspace/${workspaceId}${pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Page routes only — skip Next internals, API routes, and files with an extension.
  matcher: ['/((?!_next/|api/|.*\\.).*)'],
  // Node.js runtime — the host→workspace lookups use the pg client (needs
  // `crypto`), which the edge runtime doesn't provide.
  runtime: 'nodejs',
}
```

- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Run: `npx next build` → expected: exit 0 (middleware compiles under the nodejs runtime; if the build errors with "nodejs runtime requires experimental.nodeMiddleware", add `experimental: { nodeMiddleware: true }` to `next.config.ts` — irene on the same Next major needs no flag)
- [ ] Commit:
  ```
  git add lib/tenant/lookups.ts middleware.ts
  git commit -m "feat(tenancy): host→workspace middleware rewriting tenant hosts onto /workspace/<id>

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.14: Vercel Domains API client (verbatim)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/vercel/domains.ts`

**Interfaces:**
- Consumes: nothing (self-contained fetch client; env `VERCEL_TOKEN`/`VERCEL_PROJECT_ID`/`VERCEL_TEAM_ID`, all optional).
- Produces: `DnsRecord`, `VercelVerification`, `VercelResult<T>`; `addProjectDomain(domain: string)`, `getProjectDomain(domain: string)`, `verifyProjectDomain(domain: string)` — each `Promise<VercelResult<{ verified: boolean; verification: DnsRecord[] }>>`; `removeProjectDomain(domain: string): Promise<VercelResult<object>>`.

**Steps:**

- [ ] Copy verbatim (zero salon code — confirmed by reading the source): `cp /Users/luca/dev/winter-park/irene/lib/vercel/domains.ts /Users/luca/dev/winter-park/template/lib/vercel/domains.ts`
- [ ] No generalization edits (verify: `grep -ci 'salon\|irene' lib/vercel/domains.ts` → expected: `0`)
- [ ] Run: `npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
  ```
  git add lib/vercel/domains.ts
  git commit -m "feat(tenancy): typed Vercel Domains API client (verbatim port, env-gated)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.15: Feature flags — registry skeleton, precedence (TDD), resolver, nav gate

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/features/precedence.test.ts` (FIRST — TDD)
- Create: `/Users/luca/dev/winter-park/template/lib/features/precedence.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/features/registry.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/features/resolve.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/features/nav-gate.ts`

**Interfaces:**
- Consumes: `featureFlag` table (6.2); `db` from `@/db/drizzle`; `server-only` (6.5).
- Produces: `FeatureDef` (`{ key: string; label: string; group: string; roles: string[]; defaultEnabled: boolean }`), `FEATURE_REGISTRY: FeatureDef[]` (empty), `getFeature(key: string): FeatureDef | undefined` from `@/lib/features/registry`; `FlagScope`, `OverrideRow`, `applyOverrides(defaults, rows): Record<string, boolean>` from `@/lib/features/precedence`; `FeatureScope`, `FeatureContext` (`{ workspaceId?: number; userId?: number }`), `resolveFeatureFlags(ctx): Promise<Record<string, boolean>>`, `isFeatureEnabled(key, ctx): Promise<boolean>`, `setFeatureFlag(input)`, `clearFeatureFlag(input)` from `@/lib/features/resolve`; `NavGate`, `createNavGate(ctx: FeatureContext): Promise<NavGate>` from `@/lib/features/nav-gate`.

**Steps:**

- [ ] Write the failing test `/Users/luca/dev/winter-park/template/lib/features/precedence.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyOverrides } from './precedence'

describe('applyOverrides — most-specific-wins precedence', () => {
  const defaults = { 'area.on': true, 'area.off': false }

  it('returns a copy of the defaults when there are no override rows', () => {
    const out = applyOverrides(defaults, [])
    expect(out).toEqual(defaults)
    expect(out).not.toBe(defaults) // never mutates the input
  })

  it('global override beats the registry default', () => {
    expect(applyOverrides(defaults, [
      { scope: 'global', featureKey: 'area.on', enabled: false },
    ])).toEqual({ 'area.on': false, 'area.off': false })
  })

  it('workspace override beats global', () => {
    expect(applyOverrides(defaults, [
      { scope: 'global',    featureKey: 'area.off', enabled: true },
      { scope: 'workspace', featureKey: 'area.off', enabled: false },
    ])['area.off']).toBe(false)
  })

  it('user override beats workspace and global', () => {
    expect(applyOverrides(defaults, [
      { scope: 'global',    featureKey: 'area.off', enabled: false },
      { scope: 'workspace', featureKey: 'area.off', enabled: false },
      { scope: 'user',      featureKey: 'area.off', enabled: true },
    ])['area.off']).toBe(true)
  })

  it('row order does not matter — precedence comes from scope, not position', () => {
    expect(applyOverrides(defaults, [
      { scope: 'user',   featureKey: 'area.on', enabled: true },
      { scope: 'global', featureKey: 'area.on', enabled: false },
    ])['area.on']).toBe(true)
  })

  it('ignores rows for keys not in the defaults (retired/unknown keys)', () => {
    expect(applyOverrides(defaults, [
      { scope: 'global', featureKey: 'ghost.key', enabled: true },
    ])).toEqual(defaults)
  })

  it('ignores rows with unknown scopes', () => {
    expect(applyOverrides(defaults, [
      { scope: 'galaxy', featureKey: 'area.on', enabled: false },
    ])).toEqual(defaults)
  })
})
```

- [ ] Run: `npx vitest run lib/features/precedence.test.ts` → expected: FAIL (`Cannot find module './precedence'`)
- [ ] Write `/Users/luca/dev/winter-park/template/lib/features/precedence.ts` (pure — extracted from irene `resolve.ts` lines 57-71 so precedence is unit-testable without a DB; `salon` scope→`workspace`):

```ts
/**
 * Pure precedence math for feature-flag resolution — most-specific-wins:
 *   user ▸ workspace ▸ global ▸ registry default.
 * Kept free of db/server imports so it can be unit-tested directly;
 * `lib/features/resolve.ts` (server-only) feeds it the override rows.
 */
export type FlagScope = 'global' | 'workspace' | 'user'

export type OverrideRow = { scope: string; featureKey: string; enabled: boolean }

export function applyOverrides(
  defaults: Record<string, boolean>,
  rows: OverrideRow[],
): Record<string, boolean> {
  const result = { ...defaults }

  // Bucket overrides by scope, then apply least- → most-specific so the most
  // specific present override wins for each key.
  const byScope: Record<FlagScope, Record<string, boolean>> = { global: {}, workspace: {}, user: {} }
  for (const r of rows) {
    if (r.scope === 'global' || r.scope === 'workspace' || r.scope === 'user') {
      byScope[r.scope][r.featureKey] = r.enabled
    }
  }

  for (const k of Object.keys(defaults)) {
    if (k in byScope.global) result[k] = byScope.global[k]
    if (k in byScope.workspace) result[k] = byScope.workspace[k]
    if (k in byScope.user) result[k] = byScope.user[k]
  }

  return result
}
```

- [ ] Run: `npx vitest run lib/features/precedence.test.ts` → expected: PASS (7 tests)
- [ ] Write `/Users/luca/dev/winter-park/template/lib/features/registry.ts` (source: irene `registry.ts` — edits enumerated: `FeatureRole` salon-role union→`roles: string[]` documented as app vocabulary; the ~80-row salon `FEATURE_REGISTRY`→`[]`; header reference to irene's `.claude/specs/_feature-map.md` dropped; `FEATURES_BY_ROLE` + `MODULE_KEYS`/`ModuleKey` blocks (irene lines 154-191) DELETED — salon-onboarding-specific; `getFeature` kept):

```ts
/**
 * Feature Registry — the single source of truth for WHAT features exist.
 *
 * PURE DATA. This module MUST NOT import `db`, drizzle, `server-only`, or any
 * runtime dependency, so a `'use client'` admin toggles UI can import it
 * directly to render the catalog. Persisted OVERRIDES live in the
 * `feature_flag` table; resolution lives in `lib/features/resolve.ts`
 * (server-only). This file only declares keys + metadata + defaults.
 *
 * Keys are STABLE + namespaced (`<area>.<feature>[.<sub>]`) — never rename a
 * shipped key; flag rows reference it by string.
 *
 * The registry ships EMPTY — add your app's features here, e.g.:
 *   { key: 'workspace.reports', label: 'Reports', group: 'Workspace',
 *     roles: ['owner'], defaultEnabled: true }
 */

export type FeatureDef = {
  /** Stable, namespaced identifier — the flag row's `feature_key`. */
  key: string
  /** Human label for the admin catalog UI (English default; localize in UI). */
  label: string
  /** Display grouping for the admin catalog UI. */
  group: string
  /** Roles the feature is meaningful for — the app's own role vocabulary (template seeds 'owner' | 'member' | 'admin'). */
  roles: string[]
  /** Default when no override row exists at any scope. */
  defaultEnabled: boolean
}

export const FEATURE_REGISTRY: FeatureDef[] = []

const REGISTRY_BY_KEY: Record<string, FeatureDef> = Object.fromEntries(
  FEATURE_REGISTRY.map((f) => [f.key, f]),
)

/** Look up a single feature definition by its stable key. */
export function getFeature(key: string): FeatureDef | undefined {
  return REGISTRY_BY_KEY[key]
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/lib/features/resolve.ts` (source: irene `resolve.ts` — edits enumerated: `FeatureScope 'salon'`→`'workspace'`; `FeatureContext.salonId`→`workspaceId`; inline bucket/apply loop (lines 57-71)→`applyOverrides` call; `setFeatureFlag`/`clearFeatureFlag` kept 1:1 with scope value renamed; log prefix kept):

```ts
import 'server-only'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { featureFlag } from '@/db/schema'
import { FEATURE_REGISTRY, getFeature } from './registry'
import { applyOverrides } from './precedence'

/** The three override scopes, narrowing the persisted `feature_flag.scope` column. */
export type FeatureScope = 'global' | 'workspace' | 'user'

/** Resolution context — which workspace / user is asking. Both optional. */
export type FeatureContext = { workspaceId?: number; userId?: number }

/** Snapshot of registry defaults — the safe answer when the DB read fails. */
function registryDefaults(): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const f of FEATURE_REGISTRY) out[f.key] = f.defaultEnabled
  return out
}

/**
 * Resolve EVERY registry key to an effective boolean for the given context.
 *
 * Precedence is most-specific-wins:
 *   user override ▸ workspace override ▸ global override ▸ registry defaultEnabled
 *
 * ONE query fetches all relevant override rows; precedence is applied in JS
 * (`applyOverrides`) so the DB never has to express the layering. On any DB
 * error we log and fall back to the full set of registry defaults — this
 * function never throws.
 */
export async function resolveFeatureFlags(ctx: FeatureContext): Promise<Record<string, boolean>> {
  const defaults = registryDefaults()

  // Build the OR of scope predicates: always global, plus workspace/user when present.
  const conds = [eq(featureFlag.scope, 'global')]
  if (ctx.workspaceId != null) {
    conds.push(and(eq(featureFlag.scope, 'workspace'), eq(featureFlag.scopeId, ctx.workspaceId))!)
  }
  if (ctx.userId != null) {
    conds.push(and(eq(featureFlag.scope, 'user'), eq(featureFlag.scopeId, ctx.userId))!)
  }

  let rows: { scope: string; featureKey: string; enabled: boolean }[]
  try {
    rows = await db
      .select({
        scope:      featureFlag.scope,
        featureKey: featureFlag.featureKey,
        enabled:    featureFlag.enabled,
      })
      .from(featureFlag)
      .where(or(...conds))
  } catch (err) {
    console.error('[features] resolveFeatureFlags DB read failed; using registry defaults', err)
    return defaults
  }

  return applyOverrides(defaults, rows)
}

/** Resolve a single feature key for a context. Unknown keys resolve to `false`. */
export async function isFeatureEnabled(key: string, ctx: FeatureContext): Promise<boolean> {
  const flags = await resolveFeatureFlags(ctx)
  if (key in flags) return flags[key]
  return getFeature(key)?.defaultEnabled ?? false
}

/**
 * Upsert an override at the given scope onto the matching partial unique index.
 * Global rows always store `scope_id = NULL`. Setting a flag never clears it —
 * use `clearFeatureFlag` to remove an override and fall back to a broader scope.
 */
export async function setFeatureFlag(input: {
  scope: FeatureScope
  scopeId?: number | null
  featureKey: string
  enabled: boolean
}): Promise<void> {
  const { scope, featureKey, enabled } = input

  if (scope === 'global') {
    await db
      .insert(featureFlag)
      .values({ scope, scopeId: null, featureKey, enabled })
      .onConflictDoUpdate({
        target: featureFlag.featureKey,
        targetWhere: sql`${featureFlag.scope} = 'global'`,
        set: { enabled, updatedAt: sql`now()` },
      })
    return
  }

  await db
    .insert(featureFlag)
    .values({ scope, scopeId: input.scopeId ?? null, featureKey, enabled })
    .onConflictDoUpdate({
      target: [featureFlag.scope, featureFlag.scopeId, featureFlag.featureKey],
      targetWhere: sql`${featureFlag.scope} <> 'global'`,
      set: { enabled, updatedAt: sql`now()` },
    })
}

/** Remove an override row, restoring fall-through to the next-broader scope / registry default. */
export async function clearFeatureFlag(input: {
  scope: FeatureScope
  scopeId?: number | null
  featureKey: string
}): Promise<void> {
  const { scope, featureKey } = input
  const conds = [eq(featureFlag.scope, scope), eq(featureFlag.featureKey, featureKey)]
  if (scope === 'global') {
    conds.push(isNull(featureFlag.scopeId))
  } else {
    conds.push(eq(featureFlag.scopeId, input.scopeId ?? -1))
  }
  await db.delete(featureFlag).where(and(...conds))
}
```

- [ ] Write `/Users/luca/dev/winter-park/template/lib/features/nav-gate.ts` (source: irene `nav-gate.ts` — verbatim except: no edits needed, module was already fully generic; confirmed by reading the source):

```ts
import 'server-only'
import { resolveFeatureFlags, type FeatureContext } from './resolve'

/**
 * A FAIL-OPEN predicate: "should this nav entry render?" for a feature key.
 *
 * Returns `true` (SHOW) for everything EXCEPT a key whose resolved value is
 * EXACTLY `false`. So unmapped entries (no key), unknown keys, and any value
 * that isn't a hard `false` all SHOW.
 */
export type NavGate = (featureKey?: string | null) => boolean

/**
 * Resolve feature flags ONCE for a request and return a FAIL-OPEN gate that
 * nav/layout code uses to decide whether to render an entry.
 *
 * SAFETY — FAIL-OPEN by construction. A nav entry is hidden ONLY when its
 * mapped key resolves to EXACTLY `false`:
 *   • no key (unmapped entry)            → SHOW
 *   • key absent from the resolved map   → SHOW
 *   • key present but not strictly false → SHOW
 *   • resolution throws / is unavailable → SHOW everything
 *
 * `resolveFeatureFlags` already never throws (DB errors fall back to the full
 * set of registry defaults), but we still wrap it in try/catch so that NO
 * wiring bug — here or upstream — can ever hide navigation by default. The
 * default state of this gate, on any failure, is "render everything".
 */
export async function createNavGate(ctx: FeatureContext): Promise<NavGate> {
  let flags: Record<string, boolean>
  try {
    flags = await resolveFeatureFlags(ctx)
  } catch {
    // Defensive belt-and-suspenders: fail-open to "show everything".
    flags = {}
  }
  return (featureKey) => {
    if (!featureKey) return true // unmapped entry → SHOW
    return flags[featureKey] !== false // hide ONLY on a strict false
  }
}
```

- [ ] Run: `npx tsc --noEmit` → expected: exit 0; `npx vitest run lib/features` → expected: PASS
- [ ] Commit:
  ```
  git add lib/features
  git commit -m "feat(features): empty registry + tested 3-scope precedence + server resolver + fail-open nav gate

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6.16: Docs — `tenancy.md`, `feature-flags.md`, `guards.md` update, CLAUDE.md rows

**Files:**
- Create: `/Users/luca/dev/winter-park/template/docs/tenancy.md`
- Create: `/Users/luca/dev/winter-park/template/docs/feature-flags.md`
- Modify: `/Users/luca/dev/winter-park/template/docs/guards.md` (append one section at end — current file ends with the "Cookie-based returnTo" section)
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (docs table: 2 new rows)

**Interfaces:**
- Consumes: everything this phase produced (documents it).
- Produces: living docs served at `/docs`.

**Steps:**

- [ ] Write `/Users/luca/dev/winter-park/template/docs/tenancy.md`:

```markdown
---
title: Multi-Tenancy
order: 13
category: Patterns
---

# Multi-Tenancy — Workspaces

The template's tenant unit is the **workspace**. Everything tenant-scoped hangs
off `workspaces.id`: memberships, invites, feature-flag overrides, audit/trace
rows.

## Data model

| Table | Shape |
|-------|-------|
| `workspaces` | `id`, `name`, `slug` (nullable, unique among non-null — powers host routing), timestamps, `deleted_at` soft delete |
| `workspace_members` | `workspace_id` FK, `user_id` FK, `role` **text**, `unique(workspace_id, user_id)`, soft delete |
| `invites` | `workspace_id` FK, `email`, `role` text, `token` unique (`crypto.randomUUID()`), `status` pending→accepted\|revoked\|expired, `invited_by_user_id`, `expires_at` |

`workspace_members.role` is TEXT, not a pg enum: the template seeds
`'owner' | 'member'` (see `WORKSPACE_ROLES` in `lib/invite/roles.ts`) and apps
extend the vocabulary without a migration. Guards take the required role(s) as
parameters, so new roles need no schema change.

## Guards

Route access control follows the throw-based guard convention (see
`docs/guards.md`):

```typescript
// app/workspace/guards.ts
await requireWorkspaceRole(workspaceId, ['owner', 'member'])  // any member
await requireWorkspaceRole(workspaceId, 'owner')              // owner-only

// app/admin/guards.ts — platform admin (users.role), NOT workspace-scoped
await requireAdmin()
```

One chokepoint layout gates the whole tenant tree:
`app/workspace/[workspaceId]/layout.tsx` calls `requireWorkspaceRole` and
redirects (`unauthenticated` → login with returnTo, `forbidden` → dashboard).

Server actions use the Effect adapters from `lib/effect/auth.ts`:
`requireSessionE()`, `requireWorkspaceRoleE(workspaceId, role)`,
`requireAdminE()` — each maps the guard error to typed
`Unauthenticated` / `Forbidden`.

## Post-login dispatcher

`/dashboard` (`app/dashboard/page.tsx`) resolves `getUserWorkspaces(userId)`
(`lib/workspace/memberships.ts`) and routes:

- **0 memberships** → `/onboarding` (stub route — replace with your
  create-first-workspace flow; platform admins are exempt)
- **exactly 1** → straight into `/workspace/<id>` (no picker)
- **more than 1** → a picker (plain example UI — restyle per app)

All uncached I/O resolves inside a `<Suspense>` child so redirects fire from
within the boundary (Next 16 Cache Components).

## Invites

Role-parameterized, single-use, emailed invites:

1. Your app inserts an `invites` row (`role` from `INVITABLE_ROLES`, token
   `crypto.randomUUID()`, `expires_at` e.g. +7 days) and sends the link with
   `sendInviteEmail` (`lib/invite/send-email.ts`, Resend, localized copy).
2. The invitee opens `/invite/<token>` — a **magic-link accept**: the token is
   the credential, no prior sign-in. The page validates server-side
   (`validateInvite` in `lib/invite/validate.ts` — shared by the loader AND the
   accept action so they can never diverge).
3. Accepting provisions `persons` → `users` → `workspace_members` in one
   transaction, flips the invite to `accepted` **guarded by
   `status = 'pending'` (single-use)**, mints a session, and hard-navigates
   into the workspace.

## Host → workspace middleware

`middleware.ts` rewrites tenant hosts onto the canonical tree:

- `<slug>.<APP_BASE_DOMAIN>` → `/workspace/<id>/…` (slug lookup)
- a verified custom domain → `/workspace/<id>/…` (domain lookup)
- base domain / `www` / `*.vercel.app` / `localhost` → untouched

> **NOT a security boundary.** Host resolution only decides WHICH workspace's
> pages a host shows. The workspace layout guards remain the wall — a spoofed
> `Host` header only ever reaches what its session may access.

The resolver is pluggable (`createHostResolver({ baseDomain, reserved,
lookupSlug, lookupDomain, cacheTtlMs })` in `lib/tenant/resolve-host.ts`) and
caches results (including misses) in-process for **60s**. Reserved labels
(`www`, `app`, `api`, …) never resolve as slugs. In dev,
`<slug>.localhost:3000` works out of the box (`APP_BASE_DOMAIN` defaults to
`localhost`).

## Custom domains

The template ships `lookupWorkspaceByDomain` as a documented null stub
(`lib/tenant/lookups.ts`). To let workspaces bring their own domain:

1. Add a `workspace_domains` table (`workspace_id` FK, `domain` unique,
   `verified` boolean, `deleted_at`).
2. Query it in `lookupWorkspaceByDomain` (`lower(domain) = host`, verified,
   not deleted).
3. Provision + verify the domain on Vercel with the typed client in
   `lib/vercel/domains.ts` (`addProjectDomain` / `getProjectDomain` /
   `verifyProjectDomain` / `removeProjectDomain`). Every function degrades to
   `{ ok: false, reason: 'unconfigured' }` when `VERCEL_TOKEN` /
   `VERCEL_PROJECT_ID` are absent, so the surface works in local dev with no
   Vercel project at all.
```

- [ ] Write `/Users/luca/dev/winter-park/template/docs/feature-flags.md`:

```markdown
---
title: Feature Flags
order: 14
category: Patterns
---

# Feature Flags

Three pieces, strictly layered:

| Piece | File | May import |
|-------|------|-----------|
| **Registry** (what exists) | `lib/features/registry.ts` | nothing — PURE DATA, client-importable |
| **Precedence** (pure math) | `lib/features/precedence.ts` | nothing — unit-tested |
| **Resolver** (effective values) | `lib/features/resolve.ts` | db, registry, precedence — `server-only` |
| **Nav gate** (render predicate) | `lib/features/nav-gate.ts` | resolver — `server-only` |

## The registry

`FEATURE_REGISTRY` ships **empty**. Add one `FeatureDef` per feature:

```typescript
{ key: 'workspace.reports', label: 'Reports', group: 'Workspace',
  roles: ['owner'], defaultEnabled: true }
```

Keys are stable and namespaced (`<area>.<feature>[.<sub>]`) — **never rename a
shipped key**; `feature_flag` rows reference it by string. The registry must
stay free of db/server imports so a `'use client'` admin UI can import the
catalog directly.

## Overrides & resolution

The `feature_flag` table stores overrides at three scopes with a check
constraint (`global | workspace | user`) and two partial unique indexes (one
global row per key; one scoped row per `(scope, scope_id, key)`).

Resolution is **most-specific-wins**:

```
user override ▸ workspace override ▸ global override ▸ registry defaultEnabled
```

```typescript
const flags = await resolveFeatureFlags({ workspaceId, userId })  // every key → boolean
const on = await isFeatureEnabled('workspace.reports', { workspaceId })
await setFeatureFlag({ scope: 'workspace', scopeId, featureKey, enabled: false })
await clearFeatureFlag({ scope: 'workspace', scopeId, featureKey })  // fall back to broader scope
```

One query fetches all relevant rows; precedence is applied in JS
(`applyOverrides`). On any DB error the resolver logs and returns registry
defaults — it never throws.

## Nav gating (fail-open)

```typescript
const gate = await createNavGate({ workspaceId, userId })
navItems.filter((item) => gate(item.featureKey))
```

A nav entry is hidden ONLY when its key resolves to exactly `false`. Unmapped
entries, unknown keys, and any failure all SHOW — no wiring bug can ever blank
the navigation.

## Rules

- Flags gate **visibility and access**, not data integrity — never rely on a
  flag to protect a mutation; guards do that.
- Setting a flag never deletes it; `clearFeatureFlag` restores fall-through.
- Check flags server-side (layouts, pages, actions); pass booleans down as
  props.
```

- [ ] Append to `/Users/luca/dev/winter-park/template/docs/guards.md` (after the file's final line, which currently reads `Internal auth routes (\`/auth/verify\`, \`/auth/register\`) don't need a \`returnTo\` param — the cookie carries it through the entire flow.`):

```markdown

## Throw-based data guards

Beyond redirect-returning layout guards, guards that server **actions** share
with layouts are throw-based: `requireXxx()` either passes or throws a
`XxxGuardError` carrying `reason: 'unauthenticated' | 'forbidden'`.

| Guard | Error class | Lives in | Checks |
|-------|-------------|----------|--------|
| `requireSession()` | `SessionGuardError` | `lib/auth/session.ts` | valid session exists |
| `requireWorkspaceRole(workspaceId, role)` | `WorkspaceGuardError` | `app/workspace/guards.ts` | active membership with one of `role` (string or array) on an active workspace |
| `requireAdmin()` | `AdminGuardError` | `app/admin/guards.ts` | `users.role === 'admin'` (platform-wide, not workspace-scoped) |

The `unauthenticated` / `forbidden` split is intentional UX: unauthenticated →
send to login; forbidden → show no-permission copy. Layouts catch and redirect:

```typescript
// app/workspace/[workspaceId]/layout.tsx
try {
  await requireWorkspaceRole(workspaceId, ['owner', 'member'])
} catch (e) {
  if (e instanceof WorkspaceGuardError && e.reason === 'unauthenticated') {
    redirect(route.exits.login({ workspaceId }))
  }
  redirect(route.exits.dashboard())
}
```

Server actions never try/catch — they use the Effect adapters in
`lib/effect/auth.ts` (`requireSessionE`, `requireWorkspaceRoleE`,
`requireAdminE`), which map the guard errors to typed `Unauthenticated` /
`Forbidden` failures inside the pipe.
```

- [ ] Edit `/Users/luca/dev/winter-park/template/CLAUDE.md`: in the docs table, after the row
  `| [\`rate-limiting.md\`](docs/rate-limiting.md) | createRateLimit, key strategy, storage |`
  add:

```markdown
| [`tenancy.md`](docs/tenancy.md) | Workspaces, memberships, invites, host→workspace middleware, workspace guards |
| [`feature-flags.md`](docs/feature-flags.md) | Feature registry, 3-scope overrides (global/workspace/user), fail-open nav gating |
```

- [ ] Run: `npx tsc --noEmit` → expected: exit 0 (docs don't affect it — sanity gate)
- [ ] Run: `npx vitest run` → expected: all tests pass (full-suite regression before closing the phase)
- [ ] Commit:
  ```
  git add docs/tenancy.md docs/feature-flags.md docs/guards.md CLAUDE.md
  git commit -m "docs: tenancy + feature-flags guides, throw-based guard convention, CLAUDE.md doc rows

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
