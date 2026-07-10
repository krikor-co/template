# Phase 1: Dep + Tooling + DB Substrate — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Land the tooling and database substrate every later phase builds on: vitest infra, QA gitignore hygiene, annotated `.env.example`, next.config DX tweaks, DB hardening (timestamptz, unique personId, statement_timeout, platform_role + soft delete, audit_log), a regenerated baseline migration, and the forward-only migration runner wired into the build.

**Depends on phases:** none

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`, already checked out). IRENE source repo: `/Users/luca/dev/winter-park/irene` (read-only reference — never modify).
- Table naming: template plural stays (`users`, `persons`, `sessions`, `otps`). New table this phase: `audit_log` (nullable `workspace_id` as a **plain integer column** — the `workspaces` table and real FK land in Phase 6).
- Known irene REGRESSIONS must NOT port: `sessions` keeps template's `.unique()` on the `token` column and `onDelete: 'cascade'` on `userId`.
- Migration story: template has only baseline `drizzle/0000_omniscient_photon.sql` — schema changes **regenerate the baseline** (`rm -rf drizzle && npx drizzle-kit generate --name baseline` → deterministic `drizzle/0000_baseline.sql`), no migration-chain preservation. Runner `scripts/migrate.mjs` reads `./drizzle`, keeps `_migrations` bookkeeping. `build` = `node scripts/migrate.mjs && next build`; `db:deploy` keeps drizzle-kit.
- Test-file convention: `.test.ts` = vitest (unit), `.spec.ts` = Playwright (e2e). Scripts: `test` = `vitest run`, `test:watch` = `vitest`.
- Copy: English defaults everywhere; no hardcoded pt-BR.
- Verification gate for every task: at minimum `npx tsc --noEmit` clean; plus the task-appropriate command (`npx vitest run` for tested code, `npx next build` for config/schema changes).
- Every task ends with a git commit; every commit message ends with the trailer line:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Docs travel with code: this phase updates `docs/schema.md` (timestamptz rule, audit_log shape, migration story) and `docs/overview.md` (unit-test convention) in Task 1.10.

---

### Task 1.1: Vitest unit-test infrastructure

**Files:**
- Create: `/Users/luca/dev/winter-park/template/vitest.config.ts`
- Modify: `/Users/luca/dev/winter-park/template/package.json` (scripts block lines 5–19, devDependencies lines 45–63)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `vitest.config.ts` (mirrors tsconfig `@/*` alias; `include: ['**/*.test.ts']`; excludes `node_modules/**`, `.next/**`, `.worktrees/**`, `e2e/**`, `**/*.spec.ts`); npm scripts `test` (`vitest run`) and `test:watch` (`vitest`); devDep `vitest@^2.1.9`. Later phases (zoned.test.ts in the lib phase, Effect tests in Phase 2) rely on `npx vitest run` collecting any co-located `*.test.ts`.

**Steps:**

- [ ] Step: copy source — `cp /Users/luca/dev/winter-park/irene/vitest.config.ts /Users/luca/dev/winter-park/template/vitest.config.ts`
- [ ] Step: apply generalization edits — **none needed**. The file is app-agnostic (verified against irene source): it only wires the `@/` alias via `fileURLToPath(new URL('.', import.meta.url))` and the include/exclude globs. Template also has an `e2e/` dir, so the `e2e/**` exclude is load-bearing here too. Confirm the copied file matches irene byte-for-byte: `diff /Users/luca/dev/winter-park/irene/vitest.config.ts /Users/luca/dev/winter-park/template/vitest.config.ts` → expected: no output.
- [ ] Step: edit `/Users/luca/dev/winter-park/template/package.json` — two edits:
  1. In `scripts`, after the line `"lint": "eslint .",` insert:
     ```json
     "test": "vitest run",
     "test:watch": "vitest",
     ```
  2. In `devDependencies`, after `"typescript": "^5.6.0"` add (mind the comma on the typescript line):
     ```json
     "vitest": "^2.1.9"
     ```
- [ ] Step: install — Run: `cd /Users/luca/dev/winter-park/template && npm install` → expected: exit 0, `vitest` appears in `node_modules/.bin/`.
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run --passWithNoTests` → expected: exit 0 with "No test files found" (the first real test lands in Task 1.6; do NOT add `passWithNoTests` to the config — it is a one-off CLI flag here). Then Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```
  git add vitest.config.ts package.json package-lock.json
  git commit -m "chore(test): add vitest infra — .test.ts (vitest) / .spec.ts (playwright) split

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 1.2: .gitignore QA/browser-verification block

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/.gitignore` (append after line 44 `next-env.d.ts`)

**Interfaces:**
- Consumes: nothing.
- Produces: ignore rules for `/.auth/` (Playwright storageState `.auth/app.json`, minted by the QA phase's auth-setup), `.playwright-mcp/`, root `/*.png`, `playwright_*/`, `playwright-artifacts-*/`. The QA/testing phase relies on `/.auth/` being ignored before it ever writes a live token there.

**Steps:**

- [ ] Step: apply edits — template `.gitignore` already has `/playwright-report/` (line 36) and `/test-results/` (line 37); do **not** duplicate them. Append this block verbatim at the end of the file (after `next-env.d.ts`):
  ```gitignore

  # browser-verification auth state (holds a LIVE session token — never commit)
  /.auth/

  # Playwright MCP scratch (console/page dumps)
  .playwright-mcp/

  # QA / browser-verify throwaway artifacts (root only)
  /*.png
  playwright_*/
  playwright-artifacts-*/
  ```
  (Source: irene `.gitignore` lines 47–48, 57–63 — `modal-state.md` is irene work-product, not ported; `/.worktrees/`, `/tmp/`, `/node-compile-cache/`, `/scripts/playwright/node_modules/` are not in this phase's scope.)
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && git check-ignore .auth/app.json .playwright-mcp/dump.txt screenshot.png playwright_run1/x playwright-artifacts-2/x playwright-report/index.html` → expected: all six paths echoed, exit 0.
- [ ] Step: commit —
  ```
  git add .gitignore
  git commit -m "chore: gitignore QA/browser-verification artifacts (.auth, playwright-mcp, root pngs)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 1.3: Annotated .env.example runbook

**Files:**
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/.env.example` (currently 4 bare lines)

**Interfaces:**
- Consumes: nothing.
- Produces: the grouped-runbook convention (active vars first, feature-gated vars grouped by integration with inline setup steps). Later phases append to the correct group when they port their integration (Twilio → Phase 5, Blob → blob phase, Stripe → billing phase, VERCEL_* → tenancy phase, OTEL_SERVICE_NAME → Phase 2) — the placeholder lines already exist so those phases only refine comments if needed.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/.env.example` with exactly this content (adapted from irene `.env.example` — GOOGLE_MAPS_API_KEY is irene-specific and dropped; `RESEND_FROM_EMAIL` default de-branded from `noreply@verify.prolizz.com`; Stripe/Blob/Vercel groups added per the vars the ported code reads):
  ```bash
  # ── Core (required) ──────────────────────────────────────────────────────────

  # Postgres connection string. Local: any Postgres 15+ database,
  # e.g. postgres://localhost:5432/app_dev
  # Vercel: attach a Marketplace Postgres (Neon) store — the var is injected.
  DATABASE_URL=

  # Signs session JWTs (lib/auth/jwt.ts). Generate with: openssl rand -hex 32
  AUTH_SECRET=

  # Email OTP delivery (Resend). Setup:
  #   1. Create an API key at https://resend.com/api-keys
  #   2. Verify a sending domain, then set the from address below.
  RESEND_API_KEY=
  RESEND_FROM_EMAIL=noreply@example.com

  # Absolute origin of the app (emails, links, redirects).
  NEXT_PUBLIC_APP_URL=http://localhost:3000

  # ── Feature-gated (leave unset until the feature is enabled) ─────────────────
  # Each block below activates an optional integration. The code detects
  # presence of these vars — unset means the feature is off, nothing breaks.

  # Phone OTP (Twilio Verify) — enables the SMS auth channel; unset = email-only
  # auth. Setup:
  #   1. Twilio Console → Verify → create a Verify service (copy its SID).
  #   2. Account SID + Auth Token are on the console dashboard.
  TWILIO_ACCOUNT_SID=
  TWILIO_AUTH_TOKEN=
  TWILIO_VERIFY_SERVICE_SID=

  # Cron jobs — every app/api/cron/* route is gated by this secret (fail-closed:
  # routes return 401 while it is unset). Vercel Crons send
  # `Authorization: Bearer $CRON_SECRET`. Generate with `openssl rand -hex 32`
  # and set it in the Vercel project env (Production). See docs/cron.md.
  CRON_SECRET=

  # File uploads (Vercel Blob) — used by lib/blob/upload-image.ts and the
  # /api/blob-image proxy. Attach a Blob store to the Vercel project
  # (Storage → Blob), then `vercel env pull`. The PUBLIC token is only needed
  # if the app splits public assets into a second, public Blob store.
  BLOB_READ_WRITE_TOKEN=
  BLOB_PUBLIC_READ_WRITE_TOKEN=

  # Billing (Stripe) — used by lib/stripe/*. Keys:
  #   https://dashboard.stripe.com/apikeys
  # Webhook secret: `stripe listen --forward-to localhost:3000/api/stripe`
  # locally, or the dashboard webhook endpoint config in production.
  STRIPE_SECRET_KEY=
  STRIPE_WEBHOOK_SECRET=

  # Custom domains (Vercel Domains API) — used by lib/vercel/domains.ts for
  # multi-tenant custom-domain provisioning. Create a token at
  # https://vercel.com/account/settings/tokens; project + team ids are in the
  # Vercel project settings.
  VERCEL_TOKEN=
  VERCEL_PROJECT_ID=
  VERCEL_TEAM_ID=
  ```
- [ ] Step: verification — Run: `grep -cE '^(DATABASE_URL|AUTH_SECRET|RESEND_API_KEY|RESEND_FROM_EMAIL|NEXT_PUBLIC_APP_URL|TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN|TWILIO_VERIFY_SERVICE_SID|CRON_SECRET|BLOB_READ_WRITE_TOKEN|BLOB_PUBLIC_READ_WRITE_TOKEN|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|VERCEL_TOKEN|VERCEL_PROJECT_ID|VERCEL_TEAM_ID)=' /Users/luca/dev/winter-park/template/.env.example` → expected output: `16`.
- [ ] Step: commit —
  ```
  git add .env.example
  git commit -m "docs(env): annotate .env.example as a grouped setup runbook (active vs feature-gated)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 1.4: next.config.ts — dev indicator position + documented bodySizeLimit block

**Files:**
- Modify (full rewrite, file is 8 lines): `/Users/luca/dev/winter-park/template/next.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `devIndicators: { position: 'bottom-right' }` active; `experimental.serverActions.bodySizeLimit: '8mb'` present but **commented out** — the blob phase uncomments it when it ports the upload primitive.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/next.config.ts` with exactly this content (devIndicators comment generalized from irene's — the original references irene routes `/owner/day`, `/owner/customers/[id]`; bodySizeLimit block kept as irene wrote it but commented out, per scope):
  ```typescript
  import type { NextConfig } from 'next'

  const nextConfig: NextConfig = {
    cacheComponents: true,
    // Dev-only overlay: the floating Next.js indicator defaults to bottom-LEFT,
    // where it sits on top of left-aligned page chrome on mobile viewports
    // (stat-card icons, list headers) during dev and screenshot verification.
    // Move it to bottom-right so it never covers card headers/content.
    // No effect on the production bundle (indicator is dev-only).
    devIndicators: {
      position: 'bottom-right',
    },
    // Server Actions default to a 1 MB request-body cap — any real photo upload
    // through a Server Action 413s. When the app ships file uploads (e.g. the
    // Vercel Blob upload primitive + client-side downscale in
    // components/ui/downscale-image.ts), uncomment this block as the backstop
    // for the fail-safe original-file path.
    // experimental: {
    //   serverActions: {
    //     bodySizeLimit: '8mb',
    //   },
    // },
  }

  export default nextConfig
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Then Run: `npx next build` → expected: exit 0 (compiles with the new config; run with `.env.local` present if the docs pages need env at build).
- [ ] Step: commit —
  ```
  git add next.config.ts
  git commit -m "chore(next): dev indicator bottom-right + documented serverActions bodySizeLimit block

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 1.5: pg Pool statement_timeout in db/drizzle.ts

**Files:**
- Modify (full rewrite, file is 8 lines): `/Users/luca/dev/winter-park/template/db/drizzle.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the shared `db` export unchanged in type (`drizzle({ client: pool, schema })`), pool now created with `statement_timeout: 30_000`. Phase 2's `runAction` 30s boundary timeout pairs with this value — keep them equal.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/db/drizzle.ts` with exactly this content (port of irene `db/drizzle.ts`; comment's Effect phrasing generalized — irene says "paired with `Effect.timeoutFail({ duration: '30 seconds' })`", template's Effect boundary lands in Phase 2):
  ```typescript
  import { drizzle } from 'drizzle-orm/node-postgres'
  import pg from 'pg'
  import * as schema from './schema'

  /**
   * `statement_timeout: 30000` (ms) ensures Postgres KILLS the running query
   * after 30s — paired with the 30s action-boundary timeout (lib/effect/
   * run-action.ts). Without it, an application-level timeout cancels the
   * awaiting code but the pg query keeps running, holding a pool slot. 3-4
   * long timed-out queries can exhaust the default 10-slot pool while the app
   * reports "everything fine, just slow."
   */
  const pool = new pg.Pool({
    connectionString:  process.env.DATABASE_URL!,
    statement_timeout: 30_000,
  })

  export const db = drizzle({ client: pool, schema })
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```
  git add db/drizzle.ts
  git commit -m "fix(db): 30s statement_timeout on the pg pool (kill runaway queries server-side)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 1.6: Schema hardening — timestamptz everywhere, unique(users.personId), platform_role enum, soft delete (TDD)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/db/schema/schema-invariants.test.ts`
- Modify: `/Users/luca/dev/winter-park/template/db/schema/persons.ts` (lines 7–8), `/Users/luca/dev/winter-park/template/db/schema/users.ts` (full rewrite, 13 lines), `/Users/luca/dev/winter-park/template/db/schema/sessions.ts` (lines 8, 12–13), `/Users/luca/dev/winter-park/template/db/schema/otp-codes.ts` (lines 9, 12), `/Users/luca/dev/winter-park/template/db/schema/rate-limits.ts` (line 8)

**Interfaces:**
- Consumes: vitest infra from Task 1.1 (`npx vitest run`).
- Produces:
  - `platformRoleEnum = pgEnum('platform_role', ['user', 'admin'])` exported from `db/schema/users.ts` (re-exported via `@/db/schema`) — Phase 5's `requireAdmin` guard reads `users.role`.
  - `users.role: 'user' | 'admin'` (default `'user'`), `users.deletedAt: Date | null` (timestamptz), `unique()` on `users.personId`.
  - All timestamp columns across the schema are timestamptz — the invariant test auto-enforces this on every table later phases add (workspaces, feature_flag, trace_span, workspace_pulse, ai_call_log).
  - `db/schema/schema-invariants.test.ts` — the template's first `.test.ts`, so from this task on plain `npm test` passes without `--passWithNoTests`.

**Steps:**

- [ ] Step: write failing test — Create `/Users/luca/dev/winter-park/template/db/schema/schema-invariants.test.ts` with exactly this content:
  ```typescript
  import { describe, expect, it } from 'vitest'
  import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
  import * as schema from '@/db/schema'
  import { users } from '@/db/schema'

  /**
   * Schema-wide invariants (see docs/schema.md):
   * - every timestamp column is timestamptz ({ withTimezone: true }) — naive
   *   `timestamp` silently drops the timezone and breaks across server-TZ changes
   * - users.personId is unique (1:1 person↔user; OTP login resolves person→user)
   *
   * Iterates every table exported from db/schema/index.ts, so new tables are
   * covered automatically.
   */
  const tables = Object.values(schema).filter(
    (value): value is PgTable => value instanceof PgTable,
  )

  describe('schema invariants', () => {
    it('exports at least the five substrate tables', () => {
      expect(tables.length).toBeGreaterThanOrEqual(5)
    })

    it('every timestamp column is timestamptz', () => {
      const offenders: string[] = []
      for (const table of tables) {
        const { columns, name } = getTableConfig(table)
        for (const column of columns) {
          const sqlType = column.getSQLType()
          if (sqlType.startsWith('timestamp') && !sqlType.includes('with time zone')) {
            offenders.push(`${name}.${column.name}`)
          }
        }
      }
      expect(offenders).toEqual([])
    })

    it('users.personId carries a unique constraint (1:1 person↔user)', () => {
      const { uniqueConstraints } = getTableConfig(users)
      const hasPersonIdUnique = uniqueConstraints.some(
        (constraint) =>
          constraint.columns.length === 1 && constraint.columns[0]?.name === 'person_id',
      )
      expect(hasPersonIdUnique).toBe(true)
    })
  })
  ```
- [ ] Step: run test, expect FAIL — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run db/schema/schema-invariants.test.ts` → expected: exit 1; "every timestamp column is timestamptz" fails listing exactly these 10 offenders: `persons.created_at`, `persons.updated_at`, `users.created_at`, `users.updated_at`, `sessions.expires_at`, `sessions.created_at`, `sessions.last_active_at`, `otp_codes.expires_at`, `otp_codes.created_at`, `rate_limits.window_start`; "users.personId carries a unique constraint" fails (`false` !== `true`).
- [ ] Step: implement — apply these exact edits (irene source pattern: `db/schema/user.ts`, which has `platformRoleEnum`, `role`, `deletedAt`, `personIdUnique`, all-timestamptz; adapted to template's plural names — table stays `users`, import stays `persons`):
  1. `db/schema/persons.ts` line 7: `createdAt: timestamp('created_at').defaultNow().notNull(),` → `createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),`
  2. `db/schema/persons.ts` line 8: `updatedAt: timestamp('updated_at').defaultNow().notNull(),` → `updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),`
  3. `db/schema/users.ts` — full rewrite with exactly:
     ```typescript
     import { integer, pgTable, timestamp, unique, pgEnum } from 'drizzle-orm/pg-core'
     import { persons } from './persons'

     export const platformRoleEnum = pgEnum('platform_role', ['user', 'admin'])

     export const users = pgTable(
       'users',
       {
         id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
         personId:  integer('person_id').notNull().references(() => persons.id),
         role:      platformRoleEnum('role').notNull().default('user'),
         createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
         updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
         deletedAt: timestamp('deleted_at', { withTimezone: true }),
       },
       (t) => ({
         personIdUnique: unique().on(t.personId),
       })
     )

     export type User = typeof users.$inferSelect
     export type NewUser = typeof users.$inferInsert
     ```
  4. `db/schema/sessions.ts` line 8: `expiresAt:         timestamp('expires_at').notNull(),` → `expiresAt:         timestamp('expires_at', { withTimezone: true }).notNull(),`
  5. `db/schema/sessions.ts` line 12: `createdAt:         timestamp('created_at').defaultNow().notNull(),` → `createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),`
  6. `db/schema/sessions.ts` line 13: `lastActiveAt:      timestamp('last_active_at').defaultNow().notNull(),` → `lastActiveAt:      timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),`
     — do NOT touch line 6 (`userId ... onDelete: 'cascade'`) or line 7 (`token ... .unique()`): keeping them is the pinned no-regression rule.
  7. `db/schema/otp-codes.ts` line 9: `expiresAt: timestamp('expires_at').notNull(),` → `expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),`
  8. `db/schema/otp-codes.ts` line 12: `createdAt: timestamp('created_at').defaultNow().notNull(),` → `createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),`
  9. `db/schema/rate-limits.ts` line 8: `windowStart: timestamp('window_start').defaultNow().notNull(),` → `windowStart: timestamp('window_start', { withTimezone: true }).defaultNow().notNull(),`
- [ ] Step: run test, expect PASS — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run` → expected: exit 0, 3 tests pass. Then Run: `npx tsc --noEmit` → expected: exit 0 (no template code reads `payload` shapes affected by these columns; `User` type gains `role`/`deletedAt` additively).
- [ ] Step: commit —
  ```
  git add db/schema/persons.ts db/schema/users.ts db/schema/sessions.ts db/schema/otp-codes.ts db/schema/rate-limits.ts db/schema/schema-invariants.test.ts
  git commit -m "feat(db): timestamptz on all timestamps, unique(users.person_id), platform_role enum + soft delete

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 1.7: audit_log table (workspace FK deferred)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/db/schema/audit-log.ts`
- Modify: `/Users/luca/dev/winter-park/template/db/schema/index.ts` (5 lines — add one export)

**Interfaces:**
- Consumes: `users` from `db/schema/users.ts` (Task 1.6).
- Produces: `auditLog` table (`audit_log`) with columns `id`, `workspaceId` (plain nullable integer — **no FK yet**; Phase 6 converts it to `references(() => workspaces.id)`), `userId` (nullable FK → `users.id`), `action` text notNull, `entityType` text notNull, `entityId` integer, `details` jsonb, `ipAddress` text, `userAgent` text, `createdAt` timestamptz. Types `AuditLog`, `NewAuditLog`. Phase 6 tenancy and the AI-stack phase (assistant confirm audit writes) insert into this table.

**Steps:**

- [ ] Step: Create `/Users/luca/dev/winter-park/template/db/schema/audit-log.ts` with exactly this content (port of irene `db/schema/audit-log.ts`; edits vs source: `salonId integer('salon_id').references(() => salon.id)` → plain `workspaceId integer('workspace_id')` with the deferred-FK comment, `import { salon } from './salon'` dropped, `import { user } from './user'` → `import { users } from './users'`, `user.id` → `users.id`, double quotes → template single-quote style, `$inferSelect`/`$inferInsert` type exports added):
  ```typescript
  import { integer, text, pgTable, timestamp, jsonb } from 'drizzle-orm/pg-core'
  import { users } from './users'

  /**
   * Generic audit trail: who did what to which entity.
   *
   * `workspaceId` is a plain integer for now — the `workspaces` table lands in
   * the tenancy phase, which converts this column to a real FK
   * (`references(() => workspaces.id)`). Nullable on purpose: platform-level
   * actions (e.g. admin role edits) have no workspace scope.
   */
  export const auditLog = pgTable('audit_log', {
    id:          integer('id').primaryKey().generatedAlwaysAsIdentity(),
    workspaceId: integer('workspace_id'),
    userId:      integer('user_id').references(() => users.id),
    action:      text('action').notNull(),
    entityType:  text('entity_type').notNull(),
    entityId:    integer('entity_id'),
    details:     jsonb('details'),
    ipAddress:   text('ip_address'),
    userAgent:   text('user_agent'),
    createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  })

  export type AuditLog = typeof auditLog.$inferSelect
  export type NewAuditLog = typeof auditLog.$inferInsert
  ```
- [ ] Step: edit `/Users/luca/dev/winter-park/template/db/schema/index.ts` — after line 5 `export * from './rate-limits'` add:
  ```typescript
  export * from './audit-log'
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run` → expected: exit 0 (the timestamptz invariant test now iterates `audit_log` too and stays green). Then Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```
  git add db/schema/audit-log.ts db/schema/index.ts
  git commit -m "feat(db): audit_log table (nullable workspace_id, FK deferred to tenancy phase)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 1.8: Regenerate the baseline migration

**Files:**
- Delete: `/Users/luca/dev/winter-park/template/drizzle/` (entire dir — old baseline `0000_omniscient_photon.sql` + `meta/`)
- Create (generated): `/Users/luca/dev/winter-park/template/drizzle/0000_baseline.sql`, `/Users/luca/dev/winter-park/template/drizzle/meta/0000_snapshot.json`, `/Users/luca/dev/winter-park/template/drizzle/meta/_journal.json`

**Interfaces:**
- Consumes: final schema state from Tasks 1.6–1.7.
- Produces: a single fresh baseline under `./drizzle` containing all six tables + the `platform_role` enum. **Baseline-regeneration procedure later schema phases must repeat verbatim:** `cd /Users/luca/dev/winter-park/template && rm -rf drizzle && npx drizzle-kit generate --name baseline` → deterministic filename `drizzle/0000_baseline.sql` (the `--name` flag pins the migration name, so re-runs in any later phase always produce the same file name — the final runtime gate hard-checks for exactly `0000_baseline.sql`).

**Steps:**

- [ ] Step: delete the old baseline — Run: `rm -rf /Users/luca/dev/winter-park/template/drizzle` → expected: `ls /Users/luca/dev/winter-park/template/drizzle` errors with "No such file or directory".
- [ ] Step: regenerate — Run: `cd /Users/luca/dev/winter-park/template && npx drizzle-kit generate --name baseline` → expected: exit 0; `ls drizzle` shows exactly one SQL file, `0000_baseline.sql`, plus the `meta/` dir (generate is offline; no DATABASE_URL needed).
- [ ] Step: verification — inspect the generated SQL (all greps against `/Users/luca/dev/winter-park/template/drizzle/0000_baseline.sql`):
  - `grep -c 'timestamp with time zone' drizzle/0000_baseline.sql` → expected: `12` (the 10 hardened columns + `users.deleted_at` + `audit_log.created_at`: persons 2, users 3, sessions 3, otp_codes 2, rate_limits 1, audit_log 1)
  - `grep -cE '" timestamp (DEFAULT|NOT)' drizzle/0000_baseline.sql` → expected: `0` (no naive timestamp columns remain — timestamptz lines read `timestamp with time zone` so they don't match)
  - `grep -c 'CREATE TYPE "public"."platform_role" AS ENUM' drizzle/0000_baseline.sql` → expected: `1`
  - `grep -c 'CREATE TABLE.*"audit_log"' drizzle/0000_baseline.sql` → expected: `1`
  - `grep -c 'users_person_id_unique' drizzle/0000_baseline.sql` → expected: `1`
  - `grep -c 'sessions_token_unique' drizzle/0000_baseline.sql` → expected: `1` (no-regression check)
  - `grep -ci 'on delete cascade' drizzle/0000_baseline.sql` → expected: `1` (sessions.user_id FK — no-regression check)
  - `grep -c '"workspace_id" integer' drizzle/0000_baseline.sql` → expected: `1`, and `grep -c 'workspace_id.*REFERENCES' drizzle/0000_baseline.sql` → expected: `0` (FK really deferred)
- [ ] Step: run `npx vitest run` → expected: exit 0 (schema invariants still green — generation does not touch schema TS).
- [ ] Step: commit —
  ```
  git add -A drizzle
  git commit -m "chore(db): regenerate baseline migration 0000 for the hardened schema

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 1.9: Forward-only migration runner wired into the build

**Files:**
- Create: `/Users/luca/dev/winter-park/template/scripts/migrate.mjs` (port of `/Users/luca/dev/winter-park/irene/scripts/migrate.mjs`, 76 lines)
- Modify: `/Users/luca/dev/winter-park/template/package.json` (`"build"` script; add `"db:deploy"`)

**Interfaces:**
- Consumes: baseline migration in `./drizzle` (Task 1.8).
- Produces: `scripts/migrate.mjs` — node script, no args; behavior contract later phases rely on: hydrates `DATABASE_URL` from `.env.local`/`.env` when unset in env; **exits 0 with a warning when `DATABASE_URL` is absent** (build never blocks on a missing DB); creates `_migrations (name text PRIMARY KEY, applied_at timestamptz)` bookkeeping table; applies unapplied `drizzle/*.sql` in filename order, one transaction per file. npm scripts: `build` = `node scripts/migrate.mjs && next build`, `db:deploy` = `drizzle-kit migrate`.

**Steps:**

- [ ] Step: copy source — `mkdir -p /Users/luca/dev/winter-park/template/scripts && cp /Users/luca/dev/winter-park/irene/scripts/migrate.mjs /Users/luca/dev/winter-park/template/scripts/migrate.mjs`
- [ ] Step: apply generalization edits — four edits (everything else in the file is app-agnostic: env hydration lines 22–32, `_migrations` bookkeeping lines 48–51, per-file transaction loop lines 53–72 port unchanged):
  1. Header comment, lines 1–11 — replace the whole block:
     ```javascript
     // Forward-only, idempotent migration runner — runs on deploy (wired into the
     // build command before `next build`). Applies any `migrations/*.sql` file not yet
     // recorded in the `_migrations` table, in filename order, each in its own
     // transaction. Safe to re-run (already-applied files are skipped; the SQL itself
     // uses IF NOT EXISTS / ON CONFLICT so a partially-synced DB won't error).
     //
     // Why not drizzle-kit migrate: it's broken on a fresh DB here (table-ordering
     // bug) and prod-v2 was created via `drizzle-kit push` (no migration journal),
     // so a plain forward-only runner is the predictable, safe choice.
     //
     // DATABASE_URL comes from the Vercel build env in prod; from .env.local locally.
     ```
     →
     ```javascript
     // Forward-only, idempotent migration runner — runs on deploy (wired into the
     // build command before `next build`). Applies any `drizzle/*.sql` file not yet
     // recorded in the `_migrations` table, in filename order, each in its own
     // transaction. Safe to re-run (already-applied files are skipped).
     //
     // Reads drizzle-kit's output dir (`./drizzle`, see drizzle.config.ts). The
     // `meta/` subdir is ignored (only `*.sql` files are collected) and drizzle's
     // `--> statement-breakpoint` lines start with `--`, i.e. SQL comments, so each
     // file runs as one multi-statement query. `npm run db:deploy` keeps the
     // drizzle-kit migrate path for manual use; this runner is the deploy path:
     // dependency-light (pg only), forward-only, with its own `_migrations`
     // bookkeeping so fresh and existing databases behave identically at build time.
     //
     // DATABASE_URL comes from the Vercel build env in prod; from .env.local locally.
     ```
  2. Line 20: `const MIGRATIONS_DIR = path.join(REPO_ROOT, 'migrations')` → `const MIGRATIONS_DIR = path.join(REPO_ROOT, 'drizzle')`
  3. Line 40: `console.log('[migrate] no migrations/ directory — nothing to run.')` → `console.log('[migrate] no drizzle/ directory — nothing to run.')`
  4. No other irene-isms exist in the file (verified: no imports beyond `node:path`, `node:url`, `node:fs`, `pg`; no salon strings).
- [ ] Step: edit `/Users/luca/dev/winter-park/template/package.json` — two edits:
  1. `"build": "drizzle-kit migrate && next build",` → `"build": "node scripts/migrate.mjs && next build",`
  2. After the `"build"` line insert: `"db:deploy": "drizzle-kit migrate",`
- [ ] Step: verification (runner behavior) — Run: `cd /Users/luca/dev/winter-park/template && node scripts/migrate.mjs` → expected: exit 0. With `DATABASE_URL` resolvable (env or `.env.local`): prints `[migrate] applied 0000_baseline.sql` then `[migrate] done — 1 new, 1 total.`; run it a second time → prints `[migrate] done — 0 new, 1 total.` (idempotence). Without any `DATABASE_URL`: prints `[migrate] DATABASE_URL not set — skipping migrations (build continues).` and still exits 0. (Note: if the dev DB already has the tables from a prior `drizzle-kit migrate`, point `DATABASE_URL` at a scratch database for the apply check — the baseline's `CREATE TYPE`/`ALTER TABLE` statements are not idempotent against a half-synced DB.)
- [ ] Step: verification (build wiring) — Run: `cd /Users/luca/dev/winter-park/template && npm run build` → expected: exit 0, output starts with a `[migrate]` line followed by the Next.js build. Then Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```
  git add scripts/migrate.mjs package.json
  git commit -m "feat(db): forward-only migration runner (scripts/migrate.mjs) wired into build; db:deploy keeps drizzle-kit

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 1.10: Docs — schema hardening rules, migration story, unit-test convention

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/docs/schema.md` (Conventions section lines 95–131; append new `## Migrations` section after `## In the template`, line 145+)
- Modify: `/Users/luca/dev/winter-park/template/docs/overview.md` (Getting started section — insert after the "New feature checklist" block, line 159)

**Interfaces:**
- Consumes: everything landed in Tasks 1.1–1.9 (documents it).
- Produces: `docs/schema.md` sections "timestamps are always timestamptz", audit_log shape, platform_role/soft-delete note, `## Migrations`; `docs/overview.md` "### Unit tests" subsection. Phase 5 later appends the partial-unique-index pattern to the same Conventions section; Phase 2 adds Effect docs elsewhere.

**Steps:**

- [ ] Step: edit `/Users/luca/dev/winter-park/template/docs/schema.md` — five edits:
  1. Line 101, replace:
     `**Timestamps**: every table has \`createdAt\`. Add \`updatedAt\` when the table's rows are mutable (edited after creation).`
     →
     `**Timestamps**: always \`timestamp(..., { withTimezone: true })\` (Postgres \`timestamptz\`) — a naive \`timestamp\` silently drops the timezone and breaks when the server TZ changes. This is enforced by \`db/schema/schema-invariants.test.ts\`, which fails the unit-test run for any naive timestamp column. Every table has \`createdAt\`. Add \`updatedAt\` when the table's rows are mutable (edited after creation).`
  2. In the three code examples (lines 105–129), update every timestamp call (replace_all within the file):
     - `timestamp('created_at').defaultNow().notNull()` → `timestamp('created_at', { withTimezone: true }).defaultNow().notNull()`
     - `timestamp('updated_at').defaultNow().notNull()` → `timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()`
     - `timestamp('deleted_at')` → `timestamp('deleted_at', { withTimezone: true })`
  3. Line 131, replace:
     `The template starts simple — \`persons\`, \`users\`, and \`sessions\` use only \`createdAt\`. Add \`updatedAt\` and \`deletedAt\` as complexity demands it.`
     →
     `The template's auth tables carry \`createdAt\` + \`updatedAt\`; \`users\` additionally has \`deletedAt\` (soft delete) and a \`role\` column on the \`platform_role\` enum (\`user | admin\`) for platform-level admin access. \`users.personId\` is unique — one auth account per person.`
  4. In `## In the template` (line 145+), after the line `Other roles (\`customers\`, \`professionals\`, etc.) are created per-project via \`/scaffold-feature\`.` append:
     ```markdown

     The template also ships `audit_log` — a generic audit trail (`workspaceId`,
     `userId`, `action`, `entityType`/`entityId`, jsonb `details`, `ipAddress`/
     `userAgent`, `createdAt`). Write a row from any action whose effect you may
     need to explain later (role changes, destructive mutations, AI-confirmed
     operations). `workspaceId` is nullable: platform-level actions have no
     workspace scope.
     ```
  5. Append at the end of the file:
     ```markdown

     ---

     ## Migrations

     The template keeps a **single baseline migration** in `drizzle/`
     (`0000_baseline.sql` + `meta/`). While the schema is still template-owned,
     schema changes **regenerate the baseline** instead of appending a chain
     (`--name baseline` pins the deterministic filename):

     ```bash
     rm -rf drizzle
     npx drizzle-kit generate --name baseline
     ```

     Reset dev databases after regenerating (`npm run db:push` against a scratch
     DB, or drop and recreate). Once an app built on the template has a real
     deployed database, freeze the baseline and let `drizzle-kit generate` append
     numbered migrations from then on.

     Deploys run `scripts/migrate.mjs` (the `build` script is
     `node scripts/migrate.mjs && next build`): a forward-only, idempotent runner
     that applies any `drizzle/*.sql` not yet recorded in its `_migrations`
     bookkeeping table, in filename order, one transaction per file. If
     `DATABASE_URL` is unset the runner warns and exits 0 so the build continues.
     `npm run db:deploy` keeps the plain `drizzle-kit migrate` path for manual use.
     ```
- [ ] Step: edit `/Users/luca/dev/winter-park/template/docs/overview.md` — after the "New feature checklist" code block (ends line 159, before the `---` at line 161) insert:
  ```markdown

  ### Unit tests

  Vitest runs any co-located `*.test.ts` file (`npm test`, `npm run test:watch`).
  The suffixes are split so the two runners never collect each other's suites:
  `.test.ts` = vitest (unit, colocated next to the source file), `.spec.ts` =
  Playwright (e2e, under `e2e/`). Example: `db/schema/schema-invariants.test.ts`
  guards the schema conventions from [Schema](schema).
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Then Run: `npx vitest run` → expected: exit 0 (docs edits cannot break tests — this is the phase-exit gate). Optionally start `npm run dev` and load `/docs/schema` to eyeball the rendered markdown.
- [ ] Step: commit —
  ```
  git add docs/schema.md docs/overview.md
  git commit -m "docs: timestamptz + audit_log schema rules, baseline-regeneration migration story, unit-test convention

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

## Phase exit criteria

- `npx tsc --noEmit` → exit 0
- `npx vitest run` → exit 0 (3 passing tests in `db/schema/schema-invariants.test.ts`)
- `npm run build` → exit 0 (`[migrate]` runner output, then Next build)
- `git log --oneline` shows the 10 task commits on `backport/irene-2026-07`
