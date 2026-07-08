# Phase 3: Effect Boundary — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Port irene's Effect server boundary (`lib/effect/` — typed errors, runAction/runQuery, mapResult, dbE, validate, parseIdE, cacheE, OTel tracing → `trace_span`, tracedAction, actor context, markers registry) into the template, generalized to workspace naming, with cache profiles, one in-repo worked example (logoutAction), unit tests, and docs.

**Depends on phases:** 1

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE source repo: `/Users/luca/dev/winter-park/irene` (read-only reference).
- Effect is adopted: ports that were Effect-based in irene STAY Effect-based. Layer function names keep irene's: `runAction`, `runQuery`, `mapResult`, `dbE`, `validate`, `parseIdE`, `withCacheProfile`.
- Error union: `Forbidden`, `Unauthenticated`, `NotFound`, `ValidationFailed`, `RateLimited`, `Conflict` (class `ConflictError`, tag `'Conflict'`), `ExternalServiceError`, `DbError`, `Timeout`, `SubscriptionInactive({ workspaceId })`.
- Tenant concept: "workspace" everywhere irene says salon. Guard adapter names: `requireSessionE`, `requireAdminE`, `requireWorkspaceRoleE`. In THIS phase the admin/workspace adapters are fail-closed STUBS — Phase 6 (Task 6.4) rewrites `lib/effect/auth.ts` wholesale, wrapping `requireAdmin`/`AdminGuardError` and `requireWorkspaceRole`/`WorkspaceGuardError` (roles seeded `'owner' | 'member'`). The three exported names + signatures are FROZEN here exactly as Phase 6 (final, already drafted) declares them: `requireSessionE(): Effect.Effect<SessionPayload, Unauthenticated>`, `requireAdminE(): Effect.Effect<void, Forbidden | Unauthenticated>`, `requireWorkspaceRoleE(workspaceId: string, role: string | string[]): Effect.Effect<void, Forbidden | Unauthenticated>`.
- New table this phase: `trace_span` (workspace_id + user_id denormalized, nullable, NO foreign keys — workspaces table doesn't exist until Phase 6).
- OTel `serviceName` from env `OTEL_SERVICE_NAME` with package-name fallback (`process.env.npm_package_name`, final literal fallback `'template'`).
- Copy: English defaults only. No hardcoded pt-BR anywhere.
- Migration story: template has only baseline 0000 — schema changes regenerate the baseline (`rm -rf drizzle && npx drizzle-kit generate --name baseline` → `drizzle/0000_baseline.sql`). No migration-chain preservation.
- Docs travel with code: `docs/data-flow.md`, `docs/caching.md`, `docs/rate-limiting.md`, `CLAUDE.md` updated in this phase. NO `EFFECT_DISABLE` kill-switch, NO "Phase 7" migration residue in any ported doc or comment.
- Verification gate for every task: at minimum `npx tsc --noEmit` clean; plus task-appropriate command (`npx vitest run` for tested code, `npm run build` for config/schema). Every task ends with a git commit whose message is given exactly, with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Consumed from Phase 1 (assumed present when this phase runs): vitest + `vitest.config.ts` mirroring the `@/` alias with `.test.ts` include / `.spec.ts` excluded, npm scripts `test`/`test:watch`; `scripts/migrate.mjs` reading `./drizzle`. Task 3.5 has an explicit gate step that halts if vitest is missing.
- Template facts this plan is written against (verified 2026-07-08): `getSession(): Promise<SessionPayload | null>` in `lib/auth/session.ts`; `SessionPayload = { userId: string; email: string }` in `lib/auth/jwt.ts` (throws at import when `AUTH_SECRET` unset); `db` exported from `db/drizzle.ts`; `persons`/`users`/`sessions` plural tables; zod `^3.23.0` already a dependency.

---

### Task 3.1: Install Effect + OpenTelemetry dependencies

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/package.json` (dependencies block, currently lines 20–44)
- Modify: `/Users/luca/dev/winter-park/template/package-lock.json` (via npm)

**Interfaces:**
- Consumes: nothing.
- Produces: importable packages `effect@^3.21.2`, `@effect/opentelemetry@^0.63.0`, `@opentelemetry/api@^1.9.1`, `@opentelemetry/core@^2.7.1`, `@opentelemetry/resources@^2.7.1`, `@opentelemetry/sdk-trace-base@^2.7.1`, `@opentelemetry/semantic-conventions@^1.40.0`. Every later task in this phase and every Effect-based port in Phases 4–8 imports `effect`.

Steps:

- [ ] Step: install the exact dependency set (mirrors irene's known-working versions; `@opentelemetry/api` and `@opentelemetry/core` are declared explicitly because `lib/effect/db-span-exporter.ts` imports them directly — in irene they were only transitive):
  ```bash
  cd /Users/luca/dev/winter-park/template
  npm install effect@^3.21.2 @effect/opentelemetry@^0.63.0 @opentelemetry/api@^1.9.1 @opentelemetry/core@^2.7.1 @opentelemetry/resources@^2.7.1 @opentelemetry/sdk-trace-base@^2.7.1 @opentelemetry/semantic-conventions@^1.40.0
  ```
- [ ] Step: verify install — Run: `npm ls effect @effect/opentelemetry @opentelemetry/api @opentelemetry/core @opentelemetry/resources @opentelemetry/sdk-trace-base @opentelemetry/semantic-conventions` → expected: exit 0, all seven printed without `UNMET`.
- [ ] Step: verify types still clean — Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit:
  ```bash
  git add package.json package-lock.json
  git commit -m "backport(effect): add effect + opentelemetry dependencies

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3.2: `trace_span` table + baseline regeneration

**Files:**
- Create: `/Users/luca/dev/winter-park/template/db/schema/trace-span.ts`
- Modify: `/Users/luca/dev/winter-park/template/db/schema/index.ts` (6 lines after Phase 1 added `export * from './audit-log'` — add one export at end)
- Modify (regenerated): `/Users/luca/dev/winter-park/template/drizzle/` (delete whatever single `0000_*.sql` baseline Phase 1 Task 1.8 generated + `meta/`, regenerate)

**Interfaces:**
- Consumes: nothing new.
- Produces: `traceSpan` pgTable export and `TraceSpan` row type from `@/db/schema` — columns `spanId: text PK`, `traceId: text NOT NULL`, `parentSpanId: text NULL`, `name: text NOT NULL`, `startTs: timestamptz NOT NULL`, `durationMs: integer NOT NULL`, `status: text NOT NULL`, `attributes: jsonb NOT NULL DEFAULT {}`, `errorMessage: text NULL`, `workspaceId: integer NULL`, `userId: integer NULL`, `createdAt: timestamptz NOT NULL DEFAULT now()`. Consumed by Task 3.4's `DbSpanExporter` and by the Phase covering the retention cron.

Steps:

- [ ] Step: Write `/Users/luca/dev/winter-park/template/db/schema/trace-span.ts` with this exact content (irene's `db/schema/trace-span.ts` with: `salonId`/`salon_id` → `workspaceId`/`workspace_id`; index `trace_span_salon_created_at_idx` → `trace_span_workspace_created_at_idx`; cron/partial-index comment rewritten — irene referenced its migration 0008 and `/api/cron/purge-spans`; deprecated object-return index syntax → array syntax for drizzle-orm 0.38):
  ```typescript
  import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

  /**
   * Custom OTel span storage — every `Effect.withSpan(...)` boundary call
   * ends up here via `lib/effect/db-span-exporter.ts`.
   *
   * Indexed for common queries:
   *   - "what's slow right now"          → (name, created_at)
   *   - "what's failing in workspace X"  → (workspace_id, created_at)
   *   - "recent activity"                → (created_at DESC)
   *
   * workspace_id / user_id are denormalized from span attributes for fast
   * filtering. They are plain nullable integers on purpose — no FK: spans are
   * observation infrastructure and must survive row deletion in the tables
   * they reference. Purge old rows with a retention cron. If error volume
   * grows, add a partial index on status = 'error' via custom SQL.
   */
  export const traceSpan = pgTable('trace_span', {
    spanId:       text('span_id').primaryKey(),
    traceId:      text('trace_id').notNull(),
    parentSpanId: text('parent_span_id'),
    name:         text('name').notNull(),
    startTs:      timestamp('start_ts', { withTimezone: true }).notNull(),
    durationMs:   integer('duration_ms').notNull(),
    status:       text('status').notNull(),        // 'ok' | 'error' | 'unset'
    attributes:   jsonb('attributes').notNull().default({}),
    errorMessage: text('error_message'),
    workspaceId:  integer('workspace_id'),         // denormalized from attributes for fast tenant filtering
    userId:       integer('user_id'),              // denormalized from attributes — WHO acted
    createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  }, (t) => [
    index('trace_span_created_at_idx').on(t.createdAt),
    index('trace_span_workspace_created_at_idx').on(t.workspaceId, t.createdAt),
    index('trace_span_name_created_at_idx').on(t.name, t.createdAt),
    index('trace_span_user_created_at_idx').on(t.userId, t.createdAt),
    index('trace_span_trace_id_idx').on(t.traceId),
  ])

  export type TraceSpan = typeof traceSpan.$inferSelect
  ```
- [ ] Step: edit `/Users/luca/dev/winter-park/template/db/schema/index.ts` — append at end of file (after Phase 1's last line, `export * from './audit-log'`):
  ```typescript
  export * from './trace-span'
  ```
- [ ] Step: regenerate the baseline migration:
  ```bash
  cd /Users/luca/dev/winter-park/template
  rm -rf drizzle
  npx drizzle-kit generate --name baseline
  ```
  → expected: a single new `drizzle/0000_baseline.sql` plus `drizzle/meta/`.
- [ ] Step: verify the table + 5 indexes landed — Run: `grep -c 'trace_span' drizzle/0000_*.sql` → expected: ≥ 6 (1 CREATE TABLE + 5 CREATE INDEX). Run: `grep 'workspace_created_at_idx' drizzle/0000_*.sql` → expected: one CREATE INDEX line.
- [ ] Step: Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: full build gate (requires `DATABASE_URL` in `.env` pointing at the scratch dev DB). Because the baseline was regenerated with a new name/hash, reset the scratch DB first so the fresh 0000 applies cleanly (the Phase 1 runner's `_migrations` bookkeeping would otherwise collide with the already-applied old baseline):
  ```bash
  psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
  npm run build
  ```
  → expected: exit 0 (migrations apply, `next build` succeeds). If no scratch `DATABASE_URL` is configured in this environment, SKIP this step and note it in the commit body — Phase 13's verification gate covers build+migrate.
- [ ] Step: commit:
  ```bash
  git add db/schema/trace-span.ts db/schema/index.ts drizzle
  git commit -m "backport(effect): add trace_span table and regenerate baseline migration

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3.3: Port `lib/effect/errors.ts` (tagged error union)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/effect/errors.ts` (ported from `/Users/luca/dev/winter-park/irene/lib/effect/errors.ts`, 75 lines)

**Interfaces:**
- Consumes: `Data` from `effect` (Task 3.1).
- Produces (every later Effect task + Phases 4–8 consume these):
  - `class Forbidden extends Data.TaggedError('Forbidden')<{ message: string }>`
  - `class Unauthenticated extends Data.TaggedError('Unauthenticated')<{ message: string }>`
  - `class NotFound extends Data.TaggedError('NotFound')<{ entity: string; id?: string | number }>` (getter `message` → `` `${entity} not found` ``)
  - `class ValidationFailed extends Data.TaggedError('ValidationFailed')<{ message: string; fieldErrors?: Record<string, string[]> }>`
  - `class RateLimited extends Data.TaggedError('RateLimited')<{ message: string; retryAfterMs?: number }>`
  - `class ConflictError extends Data.TaggedError('Conflict')<{ message: string }>`
  - `class ExternalServiceError extends Data.TaggedError('ExternalServiceError')<{ service: string; cause: unknown }>`
  - `class DbError extends Data.TaggedError('DbError')<{ cause: unknown }>`
  - `class Timeout extends Data.TaggedError('Timeout')<{ message: string; durationMs?: number }>`
  - `class SubscriptionInactive extends Data.TaggedError('SubscriptionInactive')<{ workspaceId: number }>` (getter `message` → `` `workspace ${workspaceId} has no active subscription` ``)
  - `type TaggedAppError` = union of all ten.

Steps:

- [ ] Step: copy source —
  ```bash
  mkdir -p /Users/luca/dev/winter-park/template/lib/effect
  cp /Users/luca/dev/winter-park/irene/lib/effect/errors.ts /Users/luca/dev/winter-park/template/lib/effect/errors.ts
  ```
- [ ] Step: apply generalization edits (irene line refs):
  1. Line 13 comment: `(e.g. not the salon owner).` → `(e.g. not a member of the workspace with the required role).`
  2. Lines 54–59, replace the whole `SubscriptionInactive` doc comment block:
     ```typescript
     /**
      * The workspace has no ACTIVE subscription (status ∉ {active,trialing}).
      * Raised by the billing gate (Stripe phase) as action-level defense-in-depth
      * behind the layout gates — a write into a paused workspace must fail closed
      * even if a stale client somehow reaches the server action.
      */
     ```
  3. Line 60: `export class SubscriptionInactive extends Data.TaggedError('SubscriptionInactive')<{ salonId: number }> {` → `export class SubscriptionInactive extends Data.TaggedError('SubscriptionInactive')<{ workspaceId: number }> {`
  4. Line 61: `` get message() { return `salon ${this.salonId} has no active subscription` } `` → `` get message() { return `workspace ${this.workspaceId} has no active subscription` } ``
  5. No other edits — the remaining 8 classes and the `TaggedAppError` union port verbatim.
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -c 'salon' lib/effect/errors.ts` → expected: 0.
- [ ] Step: commit:
  ```bash
  git add lib/effect/errors.ts
  git commit -m "backport(effect): port tagged error union (lib/effect/errors.ts)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3.4: Port tracing pipeline — `actor-context.ts`, `db-span-exporter.ts`, `tracing.ts`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/effect/actor-context.ts` (from irene, 27 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/effect/db-span-exporter.ts` (from irene, 122 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/effect/tracing.ts` (from irene, 20 lines)
- Modify: `/Users/luca/dev/winter-park/template/.env.example` (the grouped runbook Phase 1 Task 1.3 wrote — append 1 documented var at end)

**Interfaces:**
- Consumes: `traceSpan` from `@/db/schema` (Task 3.2); `db` from `@/db/drizzle` (existing); OTel packages (Task 3.1).
- Produces:
  - `type Actor = 'assistant' | 'system'`; `withActor<T>(actor: Actor, fn: () => Promise<T>): Promise<T>`; `currentActor(): Actor | undefined` — consumed by Task 3.7's `runAction` and by the AI phase's confirm path.
  - `class DbSpanExporter implements SpanExporter` — consumed only by `tracing.ts`.
  - `TracingLayer` (an `@effect/opentelemetry` NodeSdk Layer) — consumed by `runAction`/`runQuery`/`tracedAction` (Tasks 3.7, 3.8).
  - Env contract: `OTEL_SERVICE_NAME` (optional).

Steps:

- [ ] Step: copy sources —
  ```bash
  cp /Users/luca/dev/winter-park/irene/lib/effect/actor-context.ts /Users/luca/dev/winter-park/template/lib/effect/actor-context.ts
  cp /Users/luca/dev/winter-park/irene/lib/effect/db-span-exporter.ts /Users/luca/dev/winter-park/template/lib/effect/db-span-exporter.ts
  cp /Users/luca/dev/winter-park/irene/lib/effect/tracing.ts /Users/luca/dev/winter-park/template/lib/effect/tracing.ts
  ```
- [ ] Step: apply generalization edits to `actor-context.ts` (irene line refs; code is untouched — comments only):
  1. Lines 4–7: `marks WHO/WHAT initiated the current server operation so a trace span can distinguish AI-INITIATED work (Irene running a capability the owner confirmed) from a direct human action. Without this, an AI-run action is attributed to the owner's `userId` and looks like the human did it.` → `marks WHO/WHAT initiated the current server operation so a trace span can distinguish AI-INITIATED work (an assistant running a capability the user confirmed) from a direct human action. Without this, an AI-run action is attributed to the confirming user's `userId` and looks like the human did it.`
  2. Line 9: `Set by the assistant's confirm path` — keep verbatim (already generic).
  3. Line 12: `The owner's `userId` is STILL captured` → `The user's `userId` is STILL captured`
- [ ] Step: apply generalization edits to `db-span-exporter.ts` (irene line refs):
  1. Line 35: `const salonId = pickSalonId(attributes)` → `const workspaceId = pickWorkspaceId(attributes)`
  2. Line 47: `salonId,` → `workspaceId,`
  3. Line 104: `function pickSalonId(attrs: Record<string, unknown>): number | null {` → `function pickWorkspaceId(attrs: Record<string, unknown>): number | null {`
  4. Line 105: `const raw = attrs.salonId` → `const raw = attrs.workspaceId`
  5. Line 26 comment `(powers the activity feed)` on the userId line — irene has this phrase in `trace-span.ts` not here; verify with `grep -n 'activity feed' lib/effect/db-span-exporter.ts` → expected 0 matches, no edit needed.
  6. Everything else (`sanitizeAttributes`, `pickUserId`, `suppressTracing` recursion guard, hrTime helpers, error swallowing) ports verbatim; imports `@/db/drizzle` and `@/db/schema` resolve unchanged in template.
- [ ] Step: apply generalization edits to `tracing.ts` (irene line refs):
  1. Lines 9–11 comment: `Spans are persisted to our Postgres `trace_span` table via DbSpanExporter. Use SQL to query traces, or wire `/admin/traces` later. Auto-purged at 30 days via `/api/cron/purge-spans`.` → `Spans are persisted to our Postgres `trace_span` table via DbSpanExporter. Use SQL to query traces, or wire an /admin/traces page later. Add a retention cron to purge old rows (see docs/cron.md once the cron convention lands).`
  2. Line 18: `resource:      { serviceName: 'irene' },` → `resource:      { serviceName: process.env.OTEL_SERVICE_NAME ?? process.env.npm_package_name ?? 'template' },`
- [ ] Step: edit `/Users/luca/dev/winter-park/template/.env.example` — append at end of file (it joins the feature-gated group of Phase 1's runbook; no other phase adds this var):
  ```

  # Observability — OTel service name stamped on every trace_span row
  # (lib/effect/tracing.ts). Defaults to the npm package name; set only to
  # override (e.g. several deployments sharing one database).
  OTEL_SERVICE_NAME=
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -rn 'salon\|irene\|Irene' lib/effect/actor-context.ts lib/effect/db-span-exporter.ts lib/effect/tracing.ts` → expected: no matches.
- [ ] Step: commit:
  ```bash
  git add lib/effect/actor-context.ts lib/effect/db-span-exporter.ts lib/effect/tracing.ts .env.example
  git commit -m "backport(effect): port tracing layer, db span exporter, actor context

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3.5: Port `db.ts`, `validate.ts`, `parse.ts` + unit tests

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/effect/db.ts` (from irene, 41 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/effect/validate.ts` (from irene, 28 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/effect/parse.ts` (from irene, 45 lines — minus `parseSalonIdE`)
- Test: `/Users/luca/dev/winter-park/template/lib/effect/validate.test.ts`
- Test: `/Users/luca/dev/winter-park/template/lib/effect/parse.test.ts`

**Interfaces:**
- Consumes: `DbError`, `ValidationFailed` from `./errors` (3.3); `db` from `@/db/drizzle`; `ZodSchema` from `zod` (existing dep).
- Produces:
  - `dbE.try<T>(fn: () => PromiseLike<T>): Effect.Effect<T, DbError>`
  - `dbE.findFirst<T>(query: PromiseLike<T[]>): Effect.Effect<T | undefined, DbError>`
  - `dbE.run<T>(query: PromiseLike<T>): Effect.Effect<T, DbError>`
  - `dbE.transaction<T>(fn: (tx: DbTx) => Promise<T>): Effect.Effect<T, DbError>`
  - `validate<T>(schema: ZodSchema<T>, value: unknown): Effect.Effect<T, ValidationFailed>`
  - `parseIdE(raw: string, label: string): Effect.Effect<number, ValidationFailed>`

Steps:

- [ ] Step: dependency gate — Run: `npx vitest --version` → expected: a version prints. If this fails, STOP: Phase 1 (tooling: vitest + vitest.config.ts) has not landed; execute it first.
- [ ] Step: copy sources —
  ```bash
  cp /Users/luca/dev/winter-park/irene/lib/effect/db.ts /Users/luca/dev/winter-park/template/lib/effect/db.ts
  cp /Users/luca/dev/winter-park/irene/lib/effect/validate.ts /Users/luca/dev/winter-park/template/lib/effect/validate.ts
  cp /Users/luca/dev/winter-park/irene/lib/effect/parse.ts /Users/luca/dev/winter-park/template/lib/effect/parse.ts
  ```
- [ ] Step: apply generalization edits to `db.ts` (irene line refs):
  1. Lines 18–19 comment: `Saves the boilerplate `.then((r) => r[0])` pattern that would otherwise repeat 100+ times across the migration.` → `Saves the boilerplate `.then((r) => r[0])` pattern that would otherwise repeat across the codebase.`
  2. No other edits — `@/db/drizzle` import path is identical in template.
- [ ] Step: `validate.ts` — zero edits (no irene-isms; verify with `grep -in 'salon\|irene' lib/effect/validate.ts` → 0 matches).
- [ ] Step: apply generalization edits to `parse.ts` (irene line refs):
  1. Line 10 comment: `Use these instead of file-local `parseSalonId`-style helpers.` → `Use these instead of file-local `parseWorkspaceId`-style helpers.`
  2. Lines 29–30, example block inside the doc comment:
     ```
      *     Effect.bind('sid', () => parseIdE(input.salonId, 'salonId')),
      *     Effect.bind('txId', () => parseIdE(input.transactionId, 'transactionId')),
     ```
     →
     ```
      *     Effect.bind('workspaceId', () => parseIdE(input.workspaceId, 'workspaceId')),
      *     Effect.bind('personId',    () => parseIdE(input.personId, 'personId')),
     ```
  3. Delete lines 44–45 (`/** Convenience: `parseIdE(raw, 'salonId')`. */` and `export const parseSalonIdE = (raw: string) => parseIdE(raw, 'salonId')`). No convenience alias ships — apps add their own if wanted.
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/effect/validate.test.ts` with this exact content:
  ```typescript
  import { describe, expect, it } from 'vitest'
  import { Effect } from 'effect'
  import { z } from 'zod'
  import { validate } from './validate'
  import { ValidationFailed } from './errors'

  const Input = z.object({
    name: z.string().min(1, 'Name is required'),
    age:  z.number().int().positive('Age must be positive'),
  })

  describe('validate', () => {
    it('succeeds with the parsed value', () => {
      const value = Effect.runSync(validate(Input, { name: 'Ada', age: 36 }))
      expect(value).toEqual({ name: 'Ada', age: 36 })
    })

    it('fails with ValidationFailed carrying fieldErrors per field', () => {
      const error = Effect.runSync(Effect.flip(validate(Input, { name: '', age: -1 })))
      expect(error).toBeInstanceOf(ValidationFailed)
      expect(error._tag).toBe('ValidationFailed')
      expect(error.fieldErrors).toEqual({
        name: ['Name is required'],
        age:  ['Age must be positive'],
      })
    })

    it('surfaces the first issue message at the top level', () => {
      const error = Effect.runSync(Effect.flip(validate(Input, { name: '', age: 36 })))
      expect(error.message).toBe('Name is required')
    })
  })
  ```
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/effect/parse.test.ts` with this exact content:
  ```typescript
  import { describe, expect, it } from 'vitest'
  import { Effect } from 'effect'
  import { parseIdE } from './parse'

  describe('parseIdE', () => {
    it('parses a positive integer string', () => {
      expect(Effect.runSync(parseIdE('42', 'workspaceId'))).toBe(42)
    })

    it.each(['0', '-3', 'abc', ''])('fails with ValidationFailed for %j', (raw) => {
      const error = Effect.runSync(Effect.flip(parseIdE(raw, 'workspaceId')))
      expect(error._tag).toBe('ValidationFailed')
      expect(error.message).toBe('Invalid workspaceId')
    })
  })
  ```
- [ ] Step: Run: `npx vitest run lib/effect` → expected: 2 files, 8 tests, all PASS.
- [ ] Step: Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -rn 'salon' lib/effect/db.ts lib/effect/parse.ts` → expected: 0 matches.
- [ ] Step: commit:
  ```bash
  git add lib/effect/db.ts lib/effect/validate.ts lib/effect/parse.ts lib/effect/validate.test.ts lib/effect/parse.test.ts
  git commit -m "backport(effect): port dbE, validate, parseIdE with unit tests

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3.6: Cache profiles in `lib/cache-registry.ts` + port `lib/effect/cache.ts` + `docs/caching.md`

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/lib/cache-registry.ts` (whole file rewritten — currently 48 lines, becomes ~95)
- Create: `/Users/luca/dev/winter-park/template/lib/effect/cache.ts` (from irene, 16 lines)
- Modify: `/Users/luca/dev/winter-park/template/docs/caching.md` (replace line 33; append Effect section)

**Interfaces:**
- Consumes: `Effect` from `effect`; `updateTag`/`revalidateTag`/`cacheTag`/`cacheLife` from `next/cache`.
- Produces:
  - `CacheProfile: { hot: {revalidate:30, expire:300, stale:30}, warm: {revalidate:120, expire:1800, stale:120}, cold: {revalidate:600, expire:86400, stale:600} }`
  - `type CacheProfileName = 'hot' | 'warm' | 'cold'`
  - `withCacheProfile(name: CacheProfileName): void`
  - Module-level `tagWith(descriptor: readonly string[]): void`, `invalidate(descriptor: readonly string[]): void`, `softInvalidate(descriptor: readonly string[], profile?: string): void` (in addition to the same functions returned by `createTagRegistry` — identical references, zero behavior change)
  - `cacheE.invalidate(descriptor: readonly string[]): Effect.Effect<void>` and `cacheE.softInvalidate(descriptor: readonly string[]): Effect.Effect<void>` from `@/lib/effect/cache`
  - `createTagRegistry` signature unchanged.

Steps:

- [ ] Step: rewrite `/Users/luca/dev/winter-park/template/lib/cache-registry.ts` with this exact content (adds irene's CacheProfile/withCacheProfile block with the doc-comment's salon examples neutralized: "salon owner"→"users", "Day-of-salon, receivables, today's receipts, hello widget"→"dashboard widgets, activity feeds, live counters", "Analysis, customer/professional/expense detail, customer list"→"entity detail pages, lists, reports", "(services, products, payment options, locale)"→"(settings, catalogs, locale)"; hoists `tagWith`/`invalidate`/`softInvalidate` to exported module scope so `lib/effect/cache.ts` can wrap them without importing an app tags module — the closures never referenced the resolvers, so this is a pure refactor):
  ```typescript
  import { cacheLife, revalidateTag, updateTag, cacheTag } from 'next/cache'

  /**
   * Named cache-life profiles, in seconds.
   *
   * Push-based invalidation (via `invalidate(Tag.X)`) is the primary mechanism:
   * every server action that mutates data calls it on the right tags. These
   * profiles are a SAFETY NET for the cases push-invalidation can't observe:
   * raw-SQL maintenance, cron jobs, external integrations, and the occasional
   * mutation that ships without an invalidate call.
   *
   *   hot   — operational data users watch in near-real-time.
   *           Dashboard widgets, activity feeds, live counters.
   *           30s revalidate, 5min absolute expire.
   *   warm  — aggregates and detail views the user expects to be "recent".
   *           Entity detail pages, lists, reports.
   *           2min revalidate, 30min expire.
   *   cold  — reference data that changes rarely (settings, catalogs, locale).
   *           10min revalidate, 24h expire.
   *
   * `revalidate` = how soon Next will refetch in the background; `expire`
   * = hard ceiling past which a stale cache entry is discarded entirely.
   * `stale` mirrors `revalidate` so client-side hints align.
   */
  export const CacheProfile = {
    hot:  { revalidate: 30,        expire: 5  * 60,      stale: 30 },
    warm: { revalidate: 2  * 60,   expire: 30 * 60,      stale: 2  * 60 },
    cold: { revalidate: 10 * 60,   expire: 24 * 60 * 60, stale: 10 * 60 },
  } as const

  export type CacheProfileName = keyof typeof CacheProfile

  /**
   * Apply a named profile to the current `'use cache'` scope. Call once per
   * cached function — multiple calls don't compose, the last one wins per
   * Next semantics. Pair with `tagWith()` for invalidation control.
   */
  export function withCacheProfile(name: CacheProfileName): void {
    cacheLife(CacheProfile[name])
  }

  type Resolver<P> = (params: P) => readonly string[]
  type Registry = Record<string, Resolver<any>>

  type TagFunctions<R extends Registry> = {
    [K in keyof R]: R[K] extends Resolver<infer P>
      ? (params: P) => readonly string[]
      : never
  }

  /**
   * Descriptor-level helpers. Exported at module level (and returned by
   * `createTagRegistry` — same references) so framework wrappers like the
   * Effect adapter `lib/effect/cache.ts` can operate on any registry's
   * descriptors without importing an app-specific tags module. App code
   * should keep importing them from its own tags module for readability.
   */
  export function tagWith(descriptor: readonly string[]) {
    cacheTag(descriptor[descriptor.length - 1])
  }

  export function invalidate(descriptor: readonly string[]) {
    for (const tag of descriptor) {
      updateTag(tag)
    }
  }

  export function softInvalidate(descriptor: readonly string[], profile: string = 'default') {
    for (const tag of descriptor) {
      revalidateTag(tag, profile)
    }
  }

  /**
   * Creates a typed, hierarchical cache tag registry.
   *
   * Resolvers return a chain of tags from least to most specific:
   *   booking: (p) => ['bookings', `booking:${p.id}`]
   *
   * tagWith() applies the most specific tag inside a 'use cache' scope.
   * invalidate() uses updateTag — immediate freshness (read-your-own-writes).
   * softInvalidate() uses revalidateTag — serves stale while revalidating in background.
   *
   * Usage:
   *   export const { Tag, tagWith, invalidate, softInvalidate } = createTagRegistry({
   *     bookings: (_: Record<string, never>) => ['bookings'] as const,
   *     booking:  (p: { id: string })        => ['bookings', `booking:${p.id}`] as const,
   *   })
   */
  export function createTagRegistry<R extends Registry>(resolvers: R) {
    const Tag = resolvers as unknown as TagFunctions<R>
    return { Tag, tagWith, invalidate, softInvalidate }
  }
  ```
- [ ] Step: copy + generalize `lib/effect/cache.ts` —
  ```bash
  cp /Users/luca/dev/winter-park/irene/lib/effect/cache.ts /Users/luca/dev/winter-park/template/lib/effect/cache.ts
  ```
  Edits (irene line refs):
  1. Line 2: `import { invalidate as invalidateRaw, softInvalidate as softInvalidateRaw } from '@/lib/salon/tags'` → `import { invalidate as invalidateRaw, softInvalidate as softInvalidateRaw } from '@/lib/cache-registry'`
  2. No other edits (the doc comment has no salon references).
- [ ] Step: update `/Users/luca/dev/winter-park/template/docs/caching.md`:
  1. Replace line 33 (the paragraph starting `Use `cacheLife()` when you need to control the cache duration explicitly.` and ending `most queries work fine without it.`) with:
     ```markdown
     ### Cache-life profiles

     Named profiles live in `lib/cache-registry.ts` (`CacheProfile`) and are applied with `withCacheProfile(name)` inside the `'use cache'` scope, right after `tagWith`:

     | Profile | revalidate | expire | Use for |
     |---|---|---|---|
     | `hot`  | 30s    | 5 min  | operational data users watch in near-real-time (dashboard widgets, activity feeds) |
     | `warm` | 2 min  | 30 min | aggregates and detail views expected to be "recent" (entity detail, lists, reports) |
     | `cold` | 10 min | 24 h   | reference data that changes rarely (settings, catalogs, locale) |

     ```typescript
     import { withCacheProfile } from '@/lib/cache-registry'

     export async function getPersonsState(): Promise<State> {
       'use cache'
       tagWith(Tag.persons({}))
       withCacheProfile('warm')
       // ... fetch and return state
     }
     ```

     Profile rules:

     - **Push-first.** Push-based invalidation (`invalidate(Tag.X)` after every mutation) is the primary freshness mechanism.
     - **Profiles are a safety net, not a strategy.** They cover what push can't observe: raw-SQL maintenance, cron jobs, external integrations, a missed invalidate call. Never rely on `revalidate` for read-your-own-writes.
     - **Once per cached fn.** Call `withCacheProfile` exactly once per `'use cache'` function — multiple calls don't compose; the last one wins per Next semantics.
     - Reach for Next's raw `cacheLife()` only when none of the three profiles fit — and consider adding a profile instead.
     ```
  2. Append at end of file (after line 51):
     ```markdown

     ---

     ## Cached queries with Effect

     The body of a `'use cache'` function stays plain async at the signature — Next inspects it that way to register the cache key. Effect lives **inside** the body via `runQuery(pipe(...))`, which uses `Effect.runPromise` to collapse the chain back into the resolved `Promise<A>` Next stores under the cache key.

     The pattern is always: `'use cache'` → `tagWith(Tag.x(...))` → `withCacheProfile('hot' | 'warm' | 'cold')` → `return runQuery(pipe(...), { queryName, attributes })`.

     ```typescript
     import { Effect, pipe } from 'effect'
     import { runQuery } from '@/lib/effect/run-query'
     import { dbE } from '@/lib/effect/db'
     import { withCacheProfile } from '@/lib/cache-registry'
     import { Tag, tagWith } from '@/lib/person/tags'

     export async function fetchRecentPersons(): Promise<PersonRow[]> {
       'use cache'
       tagWith(Tag.persons({}))
       withCacheProfile('warm')

       return runQuery(pipe(
         dbE.run(db.select().from(persons).orderBy(desc(persons.createdAt)).limit(10)),
         Effect.map((rows) => rows.map(toPersonRow)),
       ), { queryName: 'fetchRecentPersons' })
     }
     ```

     **Cache hits bypass the body entirely** — the registered cache key resolves before the function executes, so no Effect runs and no span is emitted. Spans appear only on **misses**, which is exactly when the work happened and is worth tracing.

     `runQuery` bakes in a 30s timeout by default and provides the `TracingLayer`. Pass `timeout: '5 seconds'` for tighter ceilings, or `null` to disable. Failures **throw** at the boundary (matching Drizzle's native semantics) — no `{ success, error }` envelope.

     For the full mutation/query pattern, typed-error union, and pipe step reference, see [`data-flow.md` → "Server actions and cached queries with Effect"](data-flow.md#server-actions-and-cached-queries-with-effect).
     ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -n 'withCacheProfile\|CacheProfileName' lib/cache-registry.ts` → expected: both present. Run: `grep -n 'lib/salon' lib/effect/cache.ts` → expected: 0 matches.
- [ ] Step: commit:
  ```bash
  git add lib/cache-registry.ts lib/effect/cache.ts docs/caching.md
  git commit -m "backport(effect): cache profiles + cacheE Effect wrapper

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3.7: Port `run-action.ts`, `run-query.ts`, `boundary.ts` + unit tests

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/effect/run-action.ts` (from irene, 113 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/effect/run-query.ts` (from irene, 66 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/effect/boundary.ts` (from irene, 88 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/effect/test-env.ts` (test-only env stub, not matched by vitest's `*.test.ts` include)
- Test: `/Users/luca/dev/winter-park/template/lib/effect/run-action.test.ts`
- Test: `/Users/luca/dev/winter-park/template/lib/effect/boundary.test.ts`

**Interfaces:**
- Consumes: `TracingLayer` (3.4), `currentActor` (3.4), `Timeout`/`TaggedAppError` (3.3), `getSession(): Promise<SessionPayload | null>` from `@/lib/auth/session` (existing template, `SessionPayload.userId: string`).
- Produces (the canonical boundary — every action/query in Phases 4–8 consumes these):
  - `type ActionResult<A> = ({ success: true } & A) | { success: false; error: string; kind: TaggedAppError['_tag']; fieldErrors?: Record<string, string[]> }`
  - `type RunActionOpts = { actionName?: string; timeout?: Duration.DurationInput | null; attributes?: Record<string, string | number | boolean | undefined> }`
  - `runAction<A, E extends TaggedAppError>(effect: Effect.Effect<A, E, never>, opts?: RunActionOpts): Promise<ActionResult<A>>`
  - `type RunQueryOpts = { queryName?: string; timeout?: Duration.DurationInput | null; attributes?: Record<string, string | number | boolean | undefined> }`
  - `runQuery<A, E>(effect: Effect.Effect<A, E, never>, opts?: RunQueryOpts): Promise<A>` (throws on failure)
  - `type BoundaryCopy = { fallback: string; validation?; notFound?; forbidden?; conflict?; rateLimit?; timeout?; external?; db?; subscriptionInactive?: string; custom?: (failure: BoundaryFailure) => string | null }`
  - `type BoundaryFailure = { success: false; error: string; kind: TaggedAppError['_tag']; fieldErrors?: Record<string, string[]> }`
  - `type FlatActionResult<A> = ({ success: true } & A) | { success: false; error: string }`
  - `mapResult<A>(result: ActionResult<A>, copy: BoundaryCopy): FlatActionResult<A>`

Steps:

- [ ] Step: copy sources —
  ```bash
  cp /Users/luca/dev/winter-park/irene/lib/effect/run-action.ts /Users/luca/dev/winter-park/template/lib/effect/run-action.ts
  cp /Users/luca/dev/winter-park/irene/lib/effect/run-query.ts /Users/luca/dev/winter-park/template/lib/effect/run-query.ts
  cp /Users/luca/dev/winter-park/irene/lib/effect/boundary.ts /Users/luca/dev/winter-park/template/lib/effect/boundary.ts
  ```
- [ ] Step: apply generalization edits to `run-action.ts` (irene line refs):
  1. Lines 22–23 comment: `to preserve backward compatibility with every existing consumer in `_sections/*` which reads success-branch fields directly (e.g. `result.transactionId`).` → `so section components read success-branch fields directly (e.g. `result.personId`).`
  2. Line 75: `let userId: number | undefined` → `let userId: string | undefined` (template `SessionPayload.userId` is a string; the exporter's `pickUserId` parses numeric strings, so attribution still lands in `trace_span.user_id`).
  3. Lines 73–74 comment: `getSession is request-cached, so this is free when the action already read the session. Powers the /admin activity feed.` → `getSession is request-cached, so this is free when the action already read the session. Powers per-user span attribution in trace_span.`
  4. Lines 77–78 comment: `actor marks AI-initiated work (the assistant confirm path) so the activity feed can show "Irene" instead of attributing it to the owner who confirmed.` → `actor marks AI-initiated work (an assistant confirm path) so traces can distinguish it from a direct human action by the same user.`
  5. No code edits besides #2 — imports (`@/lib/auth/session`, `./tracing`, `./errors`, `./actor-context`) all resolve in template.
- [ ] Step: apply generalization edits to `run-query.ts` (irene line refs — doc comment only):
  1. Line 26 (usage example in header comment): `tagWith(Tag.X({ salonId }))` → `tagWith(Tag.X({ workspaceId }))`
  2. Line 30 (same example): `), { queryName: 'fetchSomething', attributes: { salonId } })` → `), { queryName: 'fetchSomething', attributes: { workspaceId } })`
- [ ] Step: apply generalization edits to `boundary.ts` (irene line refs — doc comment only):
  1. Line 39 comment: `/** Salon has no active subscription (paused plan). */` → `/** Workspace has no active subscription (billing gate). */`
  2. No other edits — the `switch (failure.kind)` including the `'SubscriptionInactive'` case ports verbatim.
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/effect/test-env.ts` with this exact content:
  ```typescript
  /**
   * Vitest-only env stubs. Modules under test transitively import
   * `lib/auth/jwt.ts` (throws at import time when AUTH_SECRET is unset) and
   * `db/drizzle.ts` (asserts DATABASE_URL). Unit tests import this module
   * FIRST — ESM evaluates imports in declaration order — so those imports
   * don't explode. No DB connection is ever opened (pg pools connect lazily).
   * Never import this from app code.
   */
  process.env.AUTH_SECRET ??= 'unit-test-secret'
  process.env.DATABASE_URL ??= 'postgres://unit:test@localhost:5432/unit_test_placeholder'

  export {}
  ```
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/effect/run-action.test.ts` with this exact content (tests deliberately omit `actionName` so no boundary span is created and the batched exporter never attempts a DB insert):
  ```typescript
  import { describe, expect, it } from 'vitest'
  import './test-env'
  import { Effect } from 'effect'
  import { runAction } from './run-action'
  import { ConflictError, NotFound, ValidationFailed } from './errors'

  describe('runAction error mapping', () => {
    it('flattens success data into the envelope', async () => {
      const result = await runAction(Effect.succeed({ id: 7 }))
      expect(result).toEqual({ success: true, id: 7 })
    })

    it('maps a typed failure to { success: false, kind, error }', async () => {
      const result = await runAction(Effect.fail(new NotFound({ entity: 'person', id: 1 })))
      expect(result).toEqual({ success: false, kind: 'NotFound', error: 'person not found' })
    })

    it('copies ValidationFailed fieldErrors onto the boundary result', async () => {
      const result = await runAction(Effect.fail(new ValidationFailed({
        message:     'Name is required',
        fieldErrors: { name: ['Name is required'] },
      })))
      expect(result).toEqual({
        success:     false,
        kind:        'ValidationFailed',
        error:       'Name is required',
        fieldErrors: { name: ['Name is required'] },
      })
    })

    it("uses the class tag 'Conflict' for ConflictError", async () => {
      const result = await runAction(Effect.fail(new ConflictError({ message: 'already settled' })))
      expect(result).toMatchObject({ success: false, kind: 'Conflict', error: 'already settled' })
    })

    it('maps defects (raw throws) to a generic DbError result', async () => {
      const result = await runAction(Effect.sync(() => { throw new Error('boom') }))
      expect(result).toEqual({ success: false, kind: 'DbError', error: 'Unexpected server error' })
    })

    it('fires the boundary timeout as a typed Timeout failure', async () => {
      const never = Effect.promise(() => new Promise<{ ok: boolean }>(() => {}))
      const result = await runAction(never, { timeout: '20 millis' })
      expect(result).toMatchObject({ success: false, kind: 'Timeout' })
    })
  })
  ```
- [ ] Step: Run: `npx vitest run lib/effect/run-action.test.ts` → expected: FAIL is NOT acceptable here (this is a port, not new logic — the implementation already exists): 6 tests PASS. If the defect test prints `[runAction defect]` noise to stderr, that is expected console output from `Cause.pretty`, not a failure.
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/effect/boundary.test.ts` with this exact content:
  ```typescript
  import { describe, expect, it } from 'vitest'
  import { mapResult } from './boundary'
  import type { ActionResult } from './run-action'
  import type { TaggedAppError } from './errors'

  const fail = (
    kind: TaggedAppError['_tag'],
    error: string,
    fieldErrors?: Record<string, string[]>,
  ): ActionResult<Record<string, never>> =>
    ({ success: false, error, kind, ...(fieldErrors ? { fieldErrors } : {}) })

  describe('mapResult', () => {
    it('passes success through untouched', () => {
      const result: ActionResult<{ id: number }> = { success: true, id: 1 }
      expect(mapResult(result, { fallback: 'F' })).toEqual({ success: true, id: 1 })
    })

    it('routes unmatched kinds to fallback', () => {
      expect(mapResult(fail('DbError', 'pg down'), { fallback: 'F' }))
        .toEqual({ success: false, error: 'F' })
    })

    it('routes per-kind overrides', () => {
      expect(mapResult(fail('Conflict', 'x'), { fallback: 'F', conflict: 'C' }))
        .toEqual({ success: false, error: 'C' })
      expect(mapResult(fail('ValidationFailed', 'x'), { fallback: 'F', validation: 'V' }))
        .toEqual({ success: false, error: 'V' })
      expect(mapResult(fail('SubscriptionInactive', 'x'), { fallback: 'F', subscriptionInactive: 'S' }))
        .toEqual({ success: false, error: 'S' })
      expect(mapResult(fail('Unauthenticated', 'x'), { fallback: 'F', forbidden: 'NoPerm' }))
        .toEqual({ success: false, error: 'NoPerm' })
    })

    it('passes the limiter message through when rateLimit copy is omitted', () => {
      expect(mapResult(fail('RateLimited', 'Try again in 30s'), { fallback: 'F' }))
        .toEqual({ success: false, error: 'Try again in 30s' })
    })

    it('custom routing runs first and wins when it returns a string', () => {
      const result = mapResult(fail('ValidationFailed', 'amount_invalid', { amount: ['too low'] }), {
        fallback: 'F',
        custom:   (r) => (r.fieldErrors?.amount?.length ? 'Amount must be greater than zero' : null),
      })
      expect(result).toEqual({ success: false, error: 'Amount must be greater than zero' })
    })

    it('custom returning null falls through to the kind switch', () => {
      const result = mapResult(fail('Conflict', 'x'), {
        fallback: 'F',
        conflict: 'C',
        custom:   () => null,
      })
      expect(result).toEqual({ success: false, error: 'C' })
    })
  })
  ```
- [ ] Step: Run: `npx vitest run lib/effect` → expected: 4 test files (validate, parse, run-action, boundary), 20 tests (3 + 5 + 6 + 6), all PASS.
- [ ] Step: Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -rn 'salon\|irene\|Irene\|_sections' lib/effect/run-action.ts lib/effect/run-query.ts lib/effect/boundary.ts` → expected: 0 matches.
- [ ] Step: commit:
  ```bash
  git add lib/effect/run-action.ts lib/effect/run-query.ts lib/effect/boundary.ts lib/effect/test-env.ts lib/effect/run-action.test.ts lib/effect/boundary.test.ts
  git commit -m "backport(effect): port runAction/runQuery/mapResult boundary with unit tests

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3.8: Port `traced.ts`, ship empty `markers.ts` registry, add auth guard adapters

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/effect/traced.ts` (from irene, 48 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/effect/markers.ts` (NEW content — irene's 122-line registry is 100% salon-domain; only the pattern ships)
- Create: `/Users/luca/dev/winter-park/template/lib/effect/auth.ts` (NEW content — irene's `auth.ts` wraps salon guards that don't port; template gets `requireSessionE` implemented + two fail-closed stubs)

**Interfaces:**
- Consumes: `TracingLayer` (3.4); `getSession`/`SessionPayload` (existing); `Forbidden`, `Unauthenticated` (3.3).
- Produces:
  - `tracedAction<T>(name: string, attributes: Record<string, string | number | boolean | undefined>, fn: () => Promise<T>): Promise<T>` — consumed by Phase 4 (i18n `setLocale`) and any not-yet-Effect action that wants a span.
  - `Markers: {}` (empty const, app-extensible), `type Marker`, `isMarker(message: string | undefined, marker: Marker): boolean`.
  - `requireSessionE(): Effect.Effect<SessionPayload, Unauthenticated>` — WORKING now.
  - `requireAdminE(): Effect.Effect<void, Forbidden | Unauthenticated>` — fail-closed STUB.
  - `requireWorkspaceRoleE(workspaceId: string, role: string | string[]): Effect.Effect<void, Forbidden | Unauthenticated>` — fail-closed STUB.
  - Phase 6 Task 6.4 replaces the ENTIRE file content, wrapping the real throw-based guards (`requireAdmin`/`AdminGuardError`, `requireWorkspaceRole`/`WorkspaceGuardError`, each with `reason: 'unauthenticated' | 'forbidden'`). These three names + signatures are frozen here to match Phase 6's final version exactly — export nothing else from this file.

Steps:

- [ ] Step: copy + generalize `traced.ts` —
  ```bash
  cp /Users/luca/dev/winter-park/irene/lib/effect/traced.ts /Users/luca/dev/winter-park/template/lib/effect/traced.ts
  ```
  Edits (irene line refs):
  1. Line 9 comment: `capturing the operation name, timing, ok/error, salonId, and the acting `userId`` → `capturing the operation name, timing, ok/error, workspaceId, and the acting `userId``
  2. Line 31: `let userId: number | undefined` → `let userId: string | undefined` (same template `SessionPayload` reason as run-action.ts).
  3. No other edits — `@/lib/auth/session` and `./tracing` imports resolve unchanged.
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/effect/markers.ts` with this exact content:
  ```typescript
  /**
   * Central registry of sentinel marker strings used inside `ConflictError` /
   * `ValidationFailed` messages to route specific user-facing copy at the
   * action boundary.
   *
   * The pattern: an Effect chain fails with a typed error whose `message` is
   * one of these constants. The boundary mapper (`mapResult`'s `custom` hook)
   * inspects the message and picks the right user-facing string:
   *
   *   // lib/effect/markers.ts
   *   export const Markers = {
   *     orderLocked: 'order_locked',
   *   } as const
   *
   *   // inside the pipe:
   *   Effect.fail(new ConflictError({ message: Markers.orderLocked }))
   *
   *   // at the boundary:
   *   return mapResult(result, {
   *     fallback: 'Could not save the order.',
   *     custom:   (r) => isMarker(r.error, Markers.orderLocked) ? 'This order is locked.' : null,
   *   })
   *
   * Why a central registry: file-local marker constants drift — a typo at the
   * boundary falls through to the generic fallback silently. One source of
   * truth makes the `_tag` + marker pair the discriminant.
   *
   * The registry ships EMPTY — add app-domain markers as your actions need
   * them. Never invent local marker constants in action files.
   */
  export const Markers = {} as const

  export type Marker = (typeof Markers)[keyof typeof Markers]

  /** Compare a tagged-error message against a known marker. */
  export const isMarker = (message: string | undefined, marker: Marker): boolean =>
    message === marker
  ```
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/effect/auth.ts` with this exact content:
  ```typescript
  import { Effect, pipe } from 'effect'
  import { getSession } from '@/lib/auth/session'
  import type { SessionPayload } from '@/lib/auth/jwt'
  import { Forbidden, Unauthenticated } from './errors'

  /**
   * Effect-flavored auth guard adapters. Each maps a throw/null-based guard
   * into typed Effect failures so consumers can pattern-match on the
   * discriminator inside a pipe.
   *
   * The unauthenticated/forbidden split is intentional UX: `Unauthenticated`
   * means "no session, send to login"; `Forbidden` means "logged in but lacks
   * the required role, show no-permission copy". Conflating them loses that.
   */

  /** Require a valid session; yields the session payload for attribution. */
  export const requireSessionE = (): Effect.Effect<SessionPayload, Unauthenticated> =>
    pipe(
      // getSession never rejects (it catches internally and returns null).
      Effect.promise(() => getSession()),
      Effect.flatMap((session) =>
        session === null
          ? Effect.fail(new Unauthenticated({ message: 'Not signed in' }))
          : Effect.succeed(session),
      ),
    )

  /**
   * STUB — the admin guard (`requireAdmin` / `AdminGuardError` over
   * `users.role === 'admin'`) is not wired yet. Fails closed with `Forbidden`
   * until then. The real implementation wraps the throw-based `requireAdmin()`
   * with `Effect.tryPromise` and maps
   * `AdminGuardError.reason === 'unauthenticated'` → `Unauthenticated`,
   * everything else → `Forbidden`.
   */
  export const requireAdminE = (): Effect.Effect<void, Forbidden | Unauthenticated> =>
    Effect.fail(new Forbidden({ message: 'Admin guard not wired yet' }))

  /**
   * STUB — the workspace-role guard (`requireWorkspaceRole` /
   * `WorkspaceGuardError` over workspace_members) is not wired yet. Fails
   * closed with `Forbidden` until then. Pass a single role for exact-role
   * surfaces (`'owner'`) or an array for any-of (`['owner', 'member']`).
   * The real implementation wraps the throw-based
   * `requireWorkspaceRole(workspaceId, role)` with `Effect.tryPromise` and maps
   * `WorkspaceGuardError.reason === 'unauthenticated'` → `Unauthenticated`,
   * everything else → `Forbidden`.
   */
  export const requireWorkspaceRoleE = (
    workspaceId: string,
    role: string | string[],
  ): Effect.Effect<void, Forbidden | Unauthenticated> =>
    Effect.fail(new Forbidden({
      message: `Workspace guard not wired yet — workspace ${workspaceId}, role ${Array.isArray(role) ? role.join(', ') : role}`,
    }))
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `npx eslint lib/effect` → expected: exit 0 (no unused imports). Run: `grep -rn 'salon' lib/effect/` → expected: 0 matches across the whole directory.
- [ ] Step: Run: `npx vitest run lib/effect` → expected: still 20 tests PASS (no regressions from the new modules).
- [ ] Step: commit:
  ```bash
  git add lib/effect/traced.ts lib/effect/markers.ts lib/effect/auth.ts
  git commit -m "backport(effect): port tracedAction, markers registry, auth guard adapters

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3.9: Worked example — convert `logoutAction` to `runAction` + `mapResult`

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/app/dashboard/_components/LogoutButton/actions.ts` (whole file, currently 27 lines)

**Interfaces:**
- Consumes: `runAction` (3.7), `mapResult` (3.7), `dbE` (3.5).
- Produces: `logoutAction(): Promise<{ success: true } | { success: false; error: string }>` — signature UNCHANGED, so `LogoutButton.tsx` (which reads `result.success` / `result.error`) needs zero edits. This file is the in-repo demonstration of the runAction/mapResult pattern that CLAUDE.md and docs/data-flow.md point at.

Steps:

- [ ] Step: rewrite `/Users/luca/dev/winter-park/template/app/dashboard/_components/LogoutButton/actions.ts` with this exact content:
  ```typescript
  'use server'

  import { Effect, pipe } from 'effect'
  import { cookies } from 'next/headers'
  import { eq } from 'drizzle-orm'
  import { db } from '@/db/drizzle'
  import { sessions } from '@/db/schema'
  import { runAction } from '@/lib/effect/run-action'
  import { mapResult } from '@/lib/effect/boundary'
  import { dbE } from '@/lib/effect/db'

  /**
   * Worked example of the Effect action pattern (see docs/data-flow.md →
   * "Server actions and cached queries with Effect"): pure-pipe business
   * logic, `runAction` boundary (30s timeout + `logoutAction` span into
   * trace_span), `mapResult` collapsing every failure kind to one user-facing
   * message. The result signature is the flat legacy shape, so the section
   * component is unchanged.
   */
  const logout = (token: string | undefined) => pipe(
    Effect.Do,
    Effect.tap(() =>
      token
        ? dbE.run(db.update(sessions).set({ forceDeactivation: true }).where(eq(sessions.token, token)))
        : Effect.void,
    ),
    Effect.map(() => ({})),
  )

  export async function logoutAction(): Promise<
    { success: true } | { success: false; error: string }
  > {
    const cookieStore = await cookies()
    const token = cookieStore.get('session_token')?.value

    const result = await runAction(logout(token), { actionName: 'logoutAction' })

    // Cookies clear regardless of DB outcome — a failed session-row update
    // must not leave the client logged in. (The legacy version threw before
    // reaching this point on DB error; this is strictly safer.)
    const cookieOpts = { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const }
    cookieStore.set('session_token', '', { ...cookieOpts, maxAge: 0 })
    cookieStore.set('auth_email', '', { ...cookieOpts, maxAge: 0 })
    cookieStore.set('auth_is_new', '', { ...cookieOpts, maxAge: 0 })

    return mapResult(result, { fallback: 'Could not log out. Please try again.' })
  }
  ```
- [ ] Step: verify the consumer contract is untouched — Run: `grep -n 'result.success\|result.error' app/dashboard/_components/LogoutButton/LogoutButton.tsx` → expected: both lines present and unmodified (no edits to the component).
- [ ] Step: Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: Run: `npm run build` → expected: exit 0 (proves the Effect imports survive the Next server-action compilation path). If no scratch `DATABASE_URL` is configured (Phase 1's migrate runner runs first in `build`), run `npx next build` alone instead and defer the migrate+build combination to Phase 13's gate.
- [ ] Step: commit:
  ```bash
  git add app/dashboard/_components/LogoutButton/actions.ts
  git commit -m "backport(effect): convert logoutAction to the Effect boundary

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3.10: Docs — `data-flow.md` Effect section, `rate-limiting.md` Effect section, `CLAUDE.md` invariants + decision rows

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/docs/data-flow.md` (430 lines — append new section at end)
- Modify: `/Users/luca/dev/winter-park/template/docs/rate-limiting.md` (58 lines — append new section at end)
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (checklist lines ~31–32, docs-table data-flow row ~36, invariants insert before `## Quick decision guide` ~line 97, decision-guide rows after the transition-guard row ~line 119 — use the anchor strings below, not line numbers, in case Phases 1–2 shifted them)

**Interfaces:**
- Consumes: everything produced in 3.3–3.9 (documented, not imported).
- Produces: the documented contract later phases' actions are written against. No code.

Steps:

- [ ] Step: append to `/Users/luca/dev/winter-park/template/docs/data-flow.md` (after the last line of the existing worked example) this exact content — irene's `docs/data-flow.md` L450–643 with: salon worked example replaced by a template-entity (`persons`) example; `requireOwnerE(salonId)` → `requireSessionE()` / `requireWorkspaceRoleE(workspaceId, role)`; `lib/salon/tags` → the app tags module; tracing row corrected to DbSpanExporter/trace_span (irene's table said ConsoleSpanExporter, stale even there); the sentinel-marker example rewritten onto the `Markers` registry (irene's inline constants predate its own markers.ts); the entire "Kill-switch pattern (transitional)" section DROPPED (no `EFFECT_DISABLE`, no Phase-7 residue):

  ````markdown

  ---

  ## Server actions and cached queries with Effect

  Every server action mutation, read action, and `'use cache'` query runs inside an Effect program. Two boundary helpers — `runAction` and `runQuery` — convert Effects back into the plain `Promise<...>` shapes Next.js expects. Business logic stays composable; cross-cutting concerns (timeout, retry, observability, typed errors) live at the boundary.

  ### Why Effect

  - **Typed errors as values.** Every action lists exactly which errors it can fail with (`Effect.Effect<A, ValidationFailed | NotFound | DbError>`). Adding a new error path is a compile-time event.
  - **Pipe composition.** Cross-cutting concerns (`Effect.timeoutFail`, `Effect.retry`, `Effect.withSpan`) plug onto the boundary without touching business logic.
  - **Free parallelism.** `Effect.all({ a, b, c }, { concurrency: 'unbounded' })` is the structured-concurrency equivalent of `Promise.all` — same perf, typed errors flow through.
  - **Free observability.** Every action and query gets an OTel span via `Effect.withSpan(...)`, persisted to the `trace_span` table.

  ### The infrastructure (`lib/effect/`)

  | File | Role |
  |---|---|
  | `errors.ts` | Tagged error classes: `Forbidden`, `Unauthenticated`, `NotFound`, `ValidationFailed`, `RateLimited`, `Conflict`, `ExternalServiceError`, `DbError`, `Timeout`, `SubscriptionInactive`. All extend `Data.TaggedError(...)`. |
  | `db.ts` | Drizzle bridge. `dbE.try(fn)`, `dbE.findFirst(query)`, `dbE.run(query)`, `dbE.transaction(asyncCallback)`. Maps thrown errors to `DbError`. |
  | `cache.ts` | `cacheE.invalidate(Tag.X(...))` and `cacheE.softInvalidate(...)` — Effect wrappers over the cache-registry helpers, composable via `Effect.tap`. |
  | `auth.ts` | `requireSessionE()`, `requireAdminE()`, `requireWorkspaceRoleE(workspaceId, role)`. Map throw-based guards into typed `Forbidden` / `Unauthenticated`. The admin/workspace adapters fail closed until their guards land (see the file's comments). |
  | `validate.ts` | `validate(zodSchema, raw)` — runs `schema.parse` inside Effect, maps `ZodError` to `ValidationFailed` with `fieldErrors`. |
  | `parse.ts` | `parseIdE(raw, label)` — string → positive int, failing with `ValidationFailed` (never a thrown defect). |
  | `tracing.ts` | `TracingLayer` — `@effect/opentelemetry` NodeSdk wired to `DbSpanExporter` (spans persist to `trace_span`). Provided automatically by `runAction`/`runQuery`. |
  | `db-span-exporter.ts` | Batched SpanExporter writing to Postgres. Denormalizes `workspaceId`/`userId` from span attributes. Never breaks the app on failure. |
  | `run-action.ts` | Server-action boundary. Returns `Promise<ActionResult<A>>` (flat `{ success: true, ...data } \| { success: false, error, kind }`). Bakes default 30s timeout + span when `actionName` is supplied; attributes the span to the session user and the AI `actor` marker. |
  | `run-query.ts` | Cached-query boundary. Returns `Promise<A>`, throws on failure (matches Drizzle/Promise semantics). Bakes default 30s timeout + span when `queryName` is supplied. |
  | `boundary.ts` | `mapResult(result, copy)` — collapses the per-action `switch (result.kind)` boilerplate into one copy object with per-kind overrides and a `custom` hook. |
  | `traced.ts` | `tracedAction(name, attributes, fn)` — span for plain-async actions not yet on the Effect boundary. Same trace stream, zero rewrite. |
  | `actor-context.ts` | `withActor('assistant', fn)` / `currentActor()` — AsyncLocalStorage marker distinguishing AI-initiated work in spans. |
  | `markers.ts` | `Markers` sentinel-string registry + `isMarker` for boundary copy routing. Ships empty; apps add entries. |

  ### Style: pure pipe + `Effect.Do`

  **No `Effect.gen`, no generators.** Every Effect program is a `pipe(Effect.Do, Effect.bind('x', ...), Effect.tap(...), Effect.flatMap(...), Effect.map(...))` chain.

  - `Effect.bind('name', (acc) => effect)` — run an Effect, attach the result to the record under `name`.
  - `Effect.let('name', (acc) => value)` — synchronous derived value.
  - `Effect.tap((acc) => effect)` — side-effect (auth gate, cache invalidate, log); record stays unchanged.
  - `Effect.flatMap((acc) => effect)` — branching. Use this for `T | undefined` narrowing (`filterOrFail` does NOT narrow).
  - `Effect.filterOrFail((acc) => boolean, (acc) => error)` — invariants that don't need narrowing.
  - `Effect.map((acc) => value)` — final projection.

  ### The mutation pattern (server actions)

  ```typescript
  // app/people/_components/RenamePersonDialog/actions.ts
  'use server'

  import { Effect, pipe } from 'effect'
  import { z } from 'zod'
  import { eq } from 'drizzle-orm'
  import { db } from '@/db/drizzle'
  import { persons } from '@/db/schema'
  import { runAction } from '@/lib/effect/run-action'
  import { dbE } from '@/lib/effect/db'
  import { cacheE } from '@/lib/effect/cache'
  import { requireSessionE } from '@/lib/effect/auth'
  import { validate } from '@/lib/effect/validate'
  import { parseIdE } from '@/lib/effect/parse'
  import { NotFound } from '@/lib/effect/errors'
  import { Tag } from '@/lib/person/tags'

  const Input = z.object({
    personId: z.string(),
    name:     z.string().min(1, 'Name is required'),
  })

  // Pure-pipe business logic.
  const renamePerson = (raw: unknown) => pipe(
    Effect.Do,
    Effect.bind('input',    () => validate(Input, raw)),
    Effect.tap (()          => requireSessionE()),
    Effect.bind('personId', ({ input }) => parseIdE(input.personId, 'personId')),

    Effect.bind('person', ({ personId }) =>
      dbE.findFirst(db.select({ id: persons.id }).from(persons).where(eq(persons.id, personId)).limit(1))),
    // T | undefined narrowing — use Effect.flatMap, NOT filterOrFail.
    Effect.flatMap((acc) => acc.person == null
      ? Effect.fail(new NotFound({ entity: 'person', id: acc.personId }))
      : Effect.succeed(acc)),

    Effect.tap(({ personId, input }) =>
      dbE.run(db.update(persons).set({ name: input.name }).where(eq(persons.id, personId)))),
    Effect.tap(({ personId }) => cacheE.invalidate(Tag.person({ id: String(personId) }))),
    Effect.map(({ personId }) => ({ personId })),
  )

  // Boundary — defaults bake in a 30s timeout and a span when `actionName` is set.
  export async function renamePersonAction(input: { personId: string; name: string }) {
    return runAction(renamePerson(input), {
      actionName: 'renamePersonAction',
      attributes: { personId: input.personId },
    })
  }
  ```

  For a live, minimal example in this repo, see `app/dashboard/_components/LogoutButton/actions.ts`.

  ### The cached-query pattern (`'use cache'`)

  `'use cache'` requires a plain async function. We satisfy that at the boundary; Effect lives inside the body via `runQuery(pipe(...))`.

  ```typescript
  // lib/person/queries.ts
  export async function fetchRecentPersons(): Promise<PersonRow[]> {
    'use cache'                                              // ← Next sees a plain async fn
    tagWith(Tag.persons({}))
    withCacheProfile('warm')

    return runQuery(pipe(
      dbE.run(db.select().from(persons).orderBy(desc(persons.createdAt)).limit(10)),
      Effect.map((rows) => rows.map(toPersonRow)),
    ), { queryName: 'fetchRecentPersons' })
  }
  ```

  The cache machinery (`'use cache'`, `tagWith`, `withCacheProfile`) runs first and registers the cache key + tags + TTL. `runQuery(pipe(...))` then collapses the Effect chain into the resolved Promise that Next stores under that key. Cache hits bypass the body entirely — no Effect runs, no span is emitted.

  ### Boundary error mapping with `mapResult`

  `runAction` returns `{ success: false, error, kind }` where `kind` is the error's `_tag`. Instead of a 15–25-line `switch (result.kind)` per action, route copy with `mapResult`:

  ```typescript
  const result = await runAction(renamePerson(input), { actionName: 'renamePersonAction' })
  return mapResult(result, {
    fallback: 'Could not rename this person.',
    notFound: 'This person no longer exists.',
    custom:   (r) => (r.kind === 'ValidationFailed' && r.fieldErrors?.name?.length)
      ? 'Name is required.'
      : null,
  })
  ```

  Default routing: every kind → `fallback`. Override per kind (`validation`, `notFound`, `forbidden`, `conflict`, `rateLimit`, `timeout`, `external`, `db`, `subscriptionInactive`); `custom` runs first and wins when it returns a string. `rateLimit` omitted passes the limiter's own message through.

  ### The boundary defaults

  Both `runAction` and `runQuery` bake in two defaults when you supply an `actionName`/`queryName`:

  | Default | Override |
  |---|---|
  | `Effect.timeoutFail({ duration: '30 seconds', onTimeout: () => new Timeout(...) })` | Pass `timeout: '5 seconds'` (or any `Duration.DurationInput`), or `null` to disable. |
  | `Effect.withSpan(actionName, { attributes })` | Pass `attributes: { workspaceId, ... }` to enrich. Inner `Effect.withSpan(...)` calls nest under it. |

  Inner per-step `timeoutFail` always wins over the outer default (an inner 5s fires before the outer 30s).

  ### Hard rules

  | Rule | Why |
  |---|---|
  | No `Effect.gen`, ever | Pure pipe + `Effect.Do` everywhere. Single paradigm across the codebase. |
  | No `Effect.Layer` except `TracingLayer` | Single Drizzle pool, no DI graph to inject. |
  | `dbE.transaction` callback stays plain async | Drizzle's API is callback-style; throw inside to roll back. Typed errors do NOT propagate through the transaction body — do read-checks before. |
  | Result shape is FLAT | `runAction` returns `{ success: true, ...data }` (spread), not `{ success: true, data }` (nested). Sections read success-branch fields directly. |
  | `filterOrFail` does NOT narrow | For `T \| undefined` → `T`, use `Effect.flatMap` with explicit null check. |
  | Untyped catches are forbidden | `catch: () => ({})` pollutes the error union with `{}`. Always map to a typed error. |
  | Cached queries use `runQuery`, not `runAction` | `'use cache'` consumers expect plain `Promise<A>` that throws on failure, not the discriminated envelope. |
  | No client-cancel propagation | Next 16 doesn't expose request `AbortSignal` to server actions. `Effect.timeout` is the only ceiling available. |

  ### Sentinel markers for specific error copy

  When a `Conflict` needs to map to a specific user-facing string (several distinct conflict reasons behind one `_tag`), register a sentinel in `lib/effect/markers.ts` and route at the boundary — never invent file-local marker constants:

  ```typescript
  // lib/effect/markers.ts
  export const Markers = {
    orderLocked: 'order_locked',
  } as const

  // inside the pipe:
  Effect.fail(new ConflictError({ message: Markers.orderLocked }))

  // at the boundary:
  return mapResult(result, {
    fallback: 'Could not update the order.',
    custom:   (r) => isMarker(r.error, Markers.orderLocked) ? 'This order is locked.' : null,
  })
  ```
  ````

- [ ] Step: append to `/Users/luca/dev/winter-park/template/docs/rate-limiting.md` (after line 58) this exact content (irene's L60–103 with `requireOwnerE(input.salonId)` → `requireSessionE()`, the salon-scoped key → email+IP keys matching the doc's existing OTP example, and irene's "canonical example lives in app/salon/..." closing line dropped):

  ````markdown

  ---

  ## Inside an Effect pipe

  Effect-flavoured server actions bridge the throw-based `limiter.check()` call into a typed `RateLimited` failure (see [`lib/effect/errors.ts`](../lib/effect/errors.ts) → `RateLimited`). Wrap the check with `dbE.try(...)`, then `Effect.flatMap` to narrow `{ ok: false }` into `Effect.fail(new RateLimited(...))`:

  ```typescript
  import { Effect, pipe } from 'effect'
  import { dbE } from '@/lib/effect/db'
  import { RateLimited } from '@/lib/effect/errors'

  const sendOtpE = (raw: unknown) => pipe(
    Effect.Do,
    Effect.bind('input', () => validate(InputSchema, raw)),
    Effect.bind('ip',    () => Effect.promise(() => getClientIp())),

    // Bridge the throw-based limiter.check() into a typed RateLimited failure.
    Effect.tap(({ input, ip }) => pipe(
      dbE.try(() => sendOtpLimit.check(input.email, ip)),
      Effect.flatMap((res) => res.ok
        ? Effect.succeed(undefined)
        : Effect.fail(new RateLimited({ message: res.error })),
      ),
    )),

    // ... rest of the pipe
  )
  ```

  Place the limiter check **after** `validate` (and after any auth guard) and **before** any expensive read or DB write — same ordering rule as the legacy pattern.

  At the boundary, `runAction` maps the failure to `{ success: false, kind: 'RateLimited', error: <message> }`. With `mapResult`, omit the `rateLimit` copy key to pass the limiter's own user-facing message through:

  ```typescript
  return mapResult(result, {
    fallback: 'Could not send the code. Please try again.',
    // no `rateLimit:` — limit.error ("Too many attempts...") flows through verbatim
  })
  ```

  For the full Effect mutation pattern (typed-error union, `runAction` envelope, span/timeout defaults), see [`data-flow.md` → "Server actions and cached queries with Effect"](data-flow.md#server-actions-and-cached-queries-with-effect).
  ````

- [ ] Step: edit `/Users/luca/dev/winter-park/template/CLAUDE.md` — four anchor-string edits:
  1. Checklist line (exact — 10 spaces between `?` and `→`) `□ Component fetches?          → add deps.ts + query.ts + tags.ts` → `□ Component fetches?          → add deps.ts + query.ts + tags.ts (cached query body wraps in `runQuery(pipe(...))`)`
  2. Checklist line (exact — 10 spaces between `?` and `→`) `□ Component mutates?          → add actions.ts with 'use server'` → `□ Component mutates?          → add actions.ts with 'use server' (action body wraps in `runAction(pipe(...))`)`
  3. Docs-table row `| [`data-flow.md`](docs/data-flow.md) | Load/mutation/client-fetch + worked example |` → `| [`data-flow.md`](docs/data-flow.md) | Load/mutation/client-fetch, Effect boundary (runAction/runQuery), worked examples |`
  4. Insert BEFORE the `---` line that precedes `## Quick decision guide` (i.e. immediately after the last Layout-guards bullet `- Use `createTransitionGuard` from `lib/transition.ts` when exit animations must play before a layout redirect`) this exact block:
     ```markdown

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
     ```
  5. In the Quick decision guide table, insert AFTER the row `| Action triggers animation before redirect | Transition guard — `grant()` in action, `isActive()` in layout |` these four rows:
     ```markdown
     | Writing a new server action | `runAction(pipe(Effect.Do, ...), { actionName, attributes: { workspaceId } })` |
     | Writing a new cached query | `'use cache'` + `tagWith` + `withCacheProfile` + `return runQuery(pipe(...), { queryName, attributes })` |
     | Action needs to fail with a domain error | `Effect.fail(new NotFound({ entity: 'person', id }))` from `lib/effect/errors.ts` |
     | DB transaction with multiple writes | `dbE.transaction(async (tx) => { ... throw to rollback })` — keep callback plain async |
     ```
- [ ] Step: verification — Run: `grep -n 'EFFECT_DISABLE\|Phase 7\|salonId\|requireOwnerE\|parseSalonIdE\|lib/salon' docs/data-flow.md docs/rate-limiting.md docs/caching.md CLAUDE.md` → expected: 0 matches. Run: `grep -c 'runAction' CLAUDE.md` → expected: ≥ 3. Run: `npx tsc --noEmit` → expected: exit 0 (docs don't compile, but confirms the tree is still clean before the phase-closing commit).
- [ ] Step: commit:
  ```bash
  git add docs/data-flow.md docs/rate-limiting.md CLAUDE.md
  git commit -m "backport(effect): document Effect invariants across CLAUDE.md and docs

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

## Phase exit criteria

- `lib/effect/` contains exactly 14 production files (`errors`, `run-action`, `run-query`, `boundary`, `db`, `validate`, `parse`, `cache`, `tracing`, `db-span-exporter`, `traced`, `actor-context`, `markers`, `auth`) + `test-env.ts` + 4 test files; `grep -rn 'salon\|irene' lib/effect/` returns nothing.
- `npx vitest run lib/effect` → 20 tests green. `npx tsc --noEmit` → clean. `npm run build` → clean against the scratch DB (or deferred to Phase 13 if none is configured).
- `trace_span` exists in the regenerated baseline. When a scratch DB is configured: running the app and clicking Log out inserts a `logoutAction` span row (spot-check: `psql "$DATABASE_URL" -c "SELECT name, status, user_id FROM trace_span ORDER BY created_at DESC LIMIT 5;"`); otherwise Phase 13's browser pass covers this.
- Phases 4–8 can import: the full error union, `runAction`/`runQuery`/`mapResult`, `dbE`/`validate`/`parseIdE`/`cacheE`/`withCacheProfile`, `tracedAction`, `withActor`/`currentActor`, `Markers`/`isMarker`, `requireSessionE` (working) and `requireAdminE`/`requireWorkspaceRoleE(workspaceId: string, role: string | string[])` (fail-closed stubs — Phase 6 Task 6.4 rewrites `lib/effect/auth.ts` wholesale with these exact signatures).
