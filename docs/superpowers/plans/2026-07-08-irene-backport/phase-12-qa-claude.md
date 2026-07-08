# Phase 12: QA Harness + .claude Suite — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Port irene's browser-verification + autonomous-QA stack (Playwright pre-auth harness, QA auditor scripts, findings ledger, seed skeleton, `.claude` agents/skills, navigation map, QA charter) into the template, fully de-salon'd and parameterized for port 3000 / `.auth/app.json` / template schema.

**Depends on phases:** 1, 5, 6

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE source repo: `/Users/luca/dev/winter-park/irene` (read-only reference).
- Identifiers: dev port **3000**; Playwright storageState **`.auth/app.json`**; `E2E_VERIFY_PATH` default **`/dashboard`**; `BASE_URL` default **`http://localhost:3000`**; localStorage theme key **`app.theme.mode`** (next-themes `storageKey`, phase 4); auth cookie name **`session_token`** (= `AUTH_SESSION_COOKIE` in `lib/auth/identifier.ts`, phase 5).
- Copy: English defaults everywhere. The interact.mjs submit regex is **English-first with pt-BR alternates**. No hardcoded pt-BR defaults.
- Table naming: template plural stays — `persons`, `users`, `sessions` (column `token`, NOT `jwt_token`; no `type` column), `otp_codes`, `workspaces`, `workspace_members` (roles `'owner' | 'member'`), `invites`, `feature_flag`, `audit_log`, `trace_span`, `workspace_pulse`, `ai_call_log`.
- Phase 5 slim JWT: `lib/auth/jwt.ts::createSessionToken` signs payload `{ userId: number }` (HS256, 30d, `AUTH_SECRET`). The guard `lib/auth/session.ts::getSession` requires the cookie JWT **and** a `sessions` row (`token` = cookie value, not expired, not force-deactivated). If phase 5 landed a different payload shape, mirror the LANDED `lib/auth/jwt.ts` — the landed phase wins.
- Migration story: single regenerated baseline (`rm -rf drizzle && npx drizzle-kit generate --name baseline` → `drizzle/0000_baseline.sql`); runner `scripts/migrate.mjs` reads `./drizzle` (phase 1). No migrations in this phase — no schema changes here.
- Verification gate for every task: `npx tsc --noEmit` clean (this phase adds no TS, but the gate proves no accidental breakage) plus `node --check` for every `.mjs` file touched and grep-based de-irene checks for every `.md`. Steps that need a live dev server + DB (running auth-setup/smoke/seed end-to-end) may defer to phase 13's gate when no scratch `DATABASE_URL` is configured — each such step says so explicitly.
- Every task ends with a git commit including the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Known irene regressions must NOT port: `sessions` keeps template's `unique()` on the token column and `onDelete: cascade` (nothing in this phase touches schema; the harness INSERTs must match the template columns exactly).

**What already exists (do NOT re-add):**
- `.gitignore` already has `/playwright-report/`, `/test-results/` (template baseline) and `/.auth/`, `.playwright-mcp/`, `/*.png`, `playwright_*/`, `playwright-artifacts-*/` (phase 1 Task 1.2). This phase adds only `/scripts/playwright/node_modules/` and `/tmp/`.
- `scripts/` dir + `scripts/migrate.mjs` (phase 1 Task 1.9).
- Root `node_modules/playwright@1.58.2` (hoisted dependency of `@playwright/test` — `import { chromium } from 'playwright'` resolves from repo root).
- `jose@^5.9.0` and `pg@^8.13.0` in root `package.json` dependencies.
- `.claude/skills/design-flow`, `.claude/skills/frontend-design`, `.claude/commands/*` — untouched by this phase.
- Template routes referenced by ported files: `/` (landing), `/auth/identify`, `/auth/verify`, `/auth/register` (template baseline), `/dashboard` (session-guarded, redirects to `/auth/identify` when logged out), `/docs` (template baseline; phase 11 gates it in production), `/onboarding`, `/workspace/[workspaceId]`, `/invite/[token]` (phase 6).

**Interfaces consumed from earlier phases (exact, per their plan files):**
- Phase 1: `scripts/migrate.mjs` exists; vitest infra (`npx vitest run`); `.gitignore` QA block; `users.role` pgEnum `platform_role` (`'user' | 'admin'`, default `'user'`), `unique(users.personId)`; `audit_log` table with nullable `workspace_id`, `user_id` FK → `users.id`.
- Phase 5: `createSessionToken({ userId: number }): Promise<string>` from `lib/auth/jwt.ts`; `AUTH_SESSION_COOKIE = 'session_token'` from `lib/auth/identifier.ts`; `persons.email` nullable + partial unique; `persons.email_verified` boolean column.
- Phase 6: `workspaces` (`id`, `name` notNull, `slug` nullable + partial unique, timestamps w/ defaults, `deleted_at`), `workspace_members` (`workspace_id` FK, `user_id` FK, `role` text, `unique(workspaceId, userId)`, timestamps w/ defaults), `invites` (`workspace_id` FK notNull, `invited_by_user_id` FK), `feature_flag` (`scope` in `global|workspace|user`, `scope_id` plain integer); routes `/onboarding`, `/workspace/[workspaceId]`.

---

### Task 12.1: Demo seed skeleton — `scripts/seed-demo.mjs` (+ `seed:demo` npm script)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/scripts/seed-demo.mjs`
- Modify: `/Users/luca/dev/winter-park/template/package.json` (scripts block — insert one line after `"db:generate"`)

**Interfaces:**
- Consumes: template tables `persons` (`name`, `email`, `email_verified` — probed), `users` (`person_id`, `role`), `workspaces` (`name`, `slug`), `workspace_members` (`workspace_id`, `user_id`, `role`) — phases 1/5/6; `DATABASE_URL` from env/`.env.local`/`.env`.
- Produces: `node scripts/seed-demo.mjs` (idempotent, sentinel-scoped) seeding exactly three users + one workspace and printing their ids:
  - `owner@demo.invalid` → platform role `user`, workspace role `owner`
  - `member@demo.invalid` → platform role `user`, workspace role `member`
  - `admin@demo.invalid` → platform role `admin`, no membership
  - workspace `Demo Workspace`, slug `demo-workspace`
  Task 12.2's `auth-setup.mjs` resolves its default target user (`owner@demo.invalid`) from this seed. Phase 13's gate runs it before the smoke test.

This is a NEW skeleton (irene's 801-line `seed-demo.mjs` is salon-domain; only its patterns port: env hydration, `@demo.invalid` sentinel scoping, reverse-FK cleanup, `information_schema` probing, find-or-create idempotence). It is plain `.mjs` glue with no unit-testable logic — verification is syntax check + (DB-dependent) a real double-run.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/scripts/seed-demo.mjs` with exactly this content:

  ```js
  // Demo seed — a SKELETON. Seeds the auth + tenancy substrate (persons, users,
  // workspaces, workspace_members) with sentinel-scoped demo rows that an app
  // extends with its own domain tables.
  //
  // SAFE TO RE-RUN. Every demo person's email ends with "@demo.invalid"; the
  // script always deletes ALL demo data (scoped to those persons + the demo
  // workspace slug, in reverse-FK order) before seeding fresh. Real rows are
  // never touched.
  //
  // Extending for your app: add domain-table INSERTs in main() after the
  // workspace block, and matching DELETEs in clean() ABOVE the tables they
  // reference (children first). Guard every optional table with tableExists()
  // so the skeleton keeps working across schema drift.
  //
  // Connection: DATABASE_URL, hydrated from .env.local then .env (matching
  // scripts/migrate.mjs). Uses `pg` (matching scripts/qa/sql.mjs + drizzle).
  //
  // Usage:  node scripts/seed-demo.mjs   (or: npm run seed:demo)

  import path from 'node:path'
  import { fileURLToPath } from 'node:url'
  import { readFileSync, existsSync } from 'node:fs'
  import pg from 'pg'

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const REPO_ROOT = path.resolve(__dirname, '..')

  // ── env hydration: repo-root .env.local then .env, never overriding ────────
  for (const file of ['.env.local', '.env']) {
    const p = path.join(REPO_ROOT, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
      if (!m || line.trim().startsWith('#')) continue
      if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }

  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) throw new Error('DATABASE_URL not set (checked env, .env.local, .env)')

  // Sentinel scoping: cleanup touches ONLY rows reachable from persons whose
  // email ends with DEMO_DOMAIN (plus the demo workspace slug as a belt-and-
  // braces anchor). ".invalid" is an IETF-reserved TLD — it can never collide
  // with a real address.
  const DEMO_DOMAIN = '@demo.invalid'
  const DEMO_WORKSPACE_SLUG = 'demo-workspace'

  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 })
  async function q(text, params) { return (await pool.query(text, params)).rows }
  async function one(text, params) { return (await pool.query(text, params)).rows[0] }

  // ── information_schema probes: survive schema drift across apps ────────────
  async function tableExists(t) {
    return !!(await one(`SELECT 1 FROM information_schema.tables WHERE table_name = $1`, [t]))
  }
  async function columnExists(t, c) {
    return !!(await one(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      [t, c]
    ))
  }

  // ── clean: delete all demo data in reverse-FK order ─────────────────────────
  async function clean() {
    const demoUsers = await q(
      `SELECT u.id FROM users u JOIN persons p ON p.id = u.person_id WHERE p.email LIKE $1`,
      [`%${DEMO_DOMAIN}`]
    )
    const userIds = demoUsers.map((r) => r.id)
    const inUsers = userIds.length ? userIds : [-1]

    let wsIds = []
    if (await tableExists('workspaces')) {
      const rows = await q(
        `SELECT DISTINCT w.id FROM workspaces w
         WHERE w.slug = $1
            OR w.id IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = ANY($2))`,
        [DEMO_WORKSPACE_SLUG, inUsers]
      )
      wsIds = rows.map((r) => r.id)
    }
    const inWs = wsIds.length ? wsIds : [-1]

    // Children first. Every optional table is probe-guarded so the script runs
    // against any migration state. ADD YOUR APP'S DOMAIN-TABLE DELETES HERE,
    // above the tables they reference.
    if (await tableExists('workspace_pulse')) {
      await q(`DELETE FROM workspace_pulse WHERE workspace_id = ANY($1)`, [inWs])
    }
    if (await tableExists('trace_span')) {
      await q(`DELETE FROM trace_span WHERE workspace_id = ANY($1) OR user_id = ANY($2)`, [inWs, inUsers])
    }
    if (await tableExists('ai_call_log')) {
      await q(`DELETE FROM ai_call_log WHERE workspace_id = ANY($1)`, [inWs])
    }
    if (await tableExists('audit_log')) {
      await q(`DELETE FROM audit_log WHERE workspace_id = ANY($1) OR user_id = ANY($2)`, [inWs, inUsers])
    }
    if (await tableExists('invites')) {
      await q(`DELETE FROM invites WHERE workspace_id = ANY($1) OR invited_by_user_id = ANY($2)`, [inWs, inUsers])
    }
    if (await tableExists('feature_flag')) {
      await q(`DELETE FROM feature_flag WHERE scope = 'workspace' AND scope_id = ANY($1)`, [inWs])
      await q(`DELETE FROM feature_flag WHERE scope = 'user' AND scope_id = ANY($1)`, [inUsers])
    }
    if (await tableExists('workspace_members')) {
      await q(`DELETE FROM workspace_members WHERE workspace_id = ANY($1) OR user_id = ANY($2)`, [inWs, inUsers])
    }
    if (await tableExists('workspaces')) {
      await q(`DELETE FROM workspaces WHERE id = ANY($1)`, [inWs])
    }
    // sessions.user_id is ON DELETE CASCADE — the explicit DELETE keeps the
    // intent visible and covers schemas where the cascade was dropped.
    await q(`DELETE FROM sessions WHERE user_id = ANY($1)`, [inUsers])
    await q(`DELETE FROM users WHERE id = ANY($1)`, [inUsers])
    await q(`DELETE FROM persons WHERE email LIKE $1`, [`%${DEMO_DOMAIN}`])

    return { users: userIds.length, workspaces: wsIds.length }
  }

  // ── low-level creators ───────────────────────────────────────────────────────
  async function makePerson({ name, email }) {
    const cols = ['name', 'email']
    const vals = [name, email]
    // email_verified lands with the dual-identifier auth phase; probe so the
    // skeleton also runs against pared-down schemas.
    if (await columnExists('persons', 'email_verified')) {
      cols.push('email_verified')
      vals.push(true)
    }
    const ph = vals.map((_, i) => `$${i + 1}`).join(',')
    const r = await one(`INSERT INTO persons (${cols.join(',')}) VALUES (${ph}) RETURNING id`, vals)
    return r.id
  }
  async function makeUser(personId, role = 'user') {
    const r = await one(`INSERT INTO users (person_id, role) VALUES ($1, $2) RETURNING id`, [personId, role])
    return r.id
  }

  // ── main ────────────────────────────────────────────────────────────────────
  async function main() {
    const cleaned = await clean()
    console.log(`> cleaned demo rows (${cleaned.users} users, ${cleaned.workspaces} workspaces)`)

    const ownerPid = await makePerson({ name: 'Demo Owner', email: `owner${DEMO_DOMAIN}` })
    const memberPid = await makePerson({ name: 'Demo Member', email: `member${DEMO_DOMAIN}` })
    const adminPid = await makePerson({ name: 'Demo Admin', email: `admin${DEMO_DOMAIN}` })

    const ownerUid = await makeUser(ownerPid, 'user')
    const memberUid = await makeUser(memberPid, 'user')
    const adminUid = await makeUser(adminPid, 'admin') // platform admin — no workspace membership

    let wsId = null
    if (await tableExists('workspaces')) {
      const ws = await one(
        `INSERT INTO workspaces (name, slug) VALUES ($1, $2) RETURNING id`,
        ['Demo Workspace', DEMO_WORKSPACE_SLUG]
      )
      wsId = ws.id
      await q(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'owner'), ($1, $3, 'member')`,
        [wsId, ownerUid, memberUid]
      )
    }

    console.log('> seeded:')
    console.log(`   owner${DEMO_DOMAIN}  -> userId=${ownerUid} (workspace role: owner)`)
    console.log(`   member${DEMO_DOMAIN} -> userId=${memberUid} (workspace role: member)`)
    console.log(`   admin${DEMO_DOMAIN}  -> userId=${adminUid} (platform role: admin)`)
    if (wsId !== null) console.log(`   workspace '${DEMO_WORKSPACE_SLUG}' -> workspaceId=${wsId}`)
    console.log('> done — safe to re-run.')
  }

  main()
    .catch((err) => {
      console.error('seed-demo FAILED:', err.message)
      process.exitCode = 1
    })
    .finally(() => pool.end())
  ```

- [ ] Step: add the npm script — Edit `/Users/luca/dev/winter-park/template/package.json`, in the `"scripts"` block insert after the `"db:generate": "drizzle-kit generate",` line:
  ```
      "seed:demo": "node scripts/seed-demo.mjs",
  ```
  (Anchor on the `db:generate` line; phase 1 may have added `test`/`test:watch` lines elsewhere in the block — leave them.)
- [ ] Step: verification (static) — Run: `cd /Users/luca/dev/winter-park/template && node --check scripts/seed-demo.mjs` → expected: exit 0, no output. Then Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: verification (live, DB-dependent) — if a dev/scratch `DATABASE_URL` is configured (env or `.env.local`) **and** the phase 1/5/6 baseline has been applied to it (`node scripts/migrate.mjs`): Run `node scripts/seed-demo.mjs` **twice** → expected both runs exit 0; first prints `cleaned demo rows (0 users, 0 workspaces)`, second prints `cleaned demo rows (3 users, 1 workspaces)`; both print the three `-> userId=` lines and the workspaceId line. Then Run: `node -e "const pg=require('pg');const p=new pg.Pool({connectionString:process.env.DATABASE_URL});p.query(\"SELECT count(*)::int c FROM persons WHERE email LIKE '%@demo.invalid'\").then(r=>{console.log(r.rows[0].c);return p.end()})"` → expected: `3`. If no `DATABASE_URL` is configured: defer this step to phase 13's gate (note it in the commit body).
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add scripts/seed-demo.mjs package.json
  git commit -m "backport(qa): sentinel-scoped idempotent demo seed skeleton (scripts/seed-demo.mjs)" -m "Seeds persons/users/workspaces/workspace_members only: owner/member/admin @demo.invalid + 'demo-workspace'. Reverse-FK cleanup with information_schema probing; safe to re-run. Powers auth-setup's default target user." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12.2: Playwright pre-auth harness — `scripts/playwright/{auth-setup.mjs,smoke.mjs,package.json}` + gitignore lines

**Files:**
- Create: `/Users/luca/dev/winter-park/template/scripts/playwright/auth-setup.mjs` (port of `/Users/luca/dev/winter-park/irene/scripts/playwright/auth-setup.mjs`, restructured — full content below because the user-resolution block moves into `main()`)
- Create: `/Users/luca/dev/winter-park/template/scripts/playwright/smoke.mjs` (port of `/Users/luca/dev/winter-park/irene/scripts/playwright/smoke.mjs`)
- Create: `/Users/luca/dev/winter-park/template/scripts/playwright/package.json` (port of irene's)
- Modify: `/Users/luca/dev/winter-park/template/.gitignore` (append 3 lines after the phase-1 QA block that ends with `playwright-artifacts-*/`)

**Interfaces:**
- Consumes: phase 5's slim JWT contract (`createSessionToken` payload `{ userId: number }`, HS256, 30d, `AUTH_SECRET`) — the script MIRRORS `lib/auth/jwt.ts`, it does not import it (plain-node, no TS); template `sessions` columns (`user_id`, `token`, `expires_at`; `force_deactivation`/timestamps have defaults); seed users from Task 12.1; root-hoisted `playwright`, `jose`, `pg`.
- Produces:
  - `node scripts/playwright/auth-setup.mjs` — env contract: `AUTH_SECRET` (required), `DATABASE_URL` (required), `BASE_URL` (default `http://localhost:3000`), `E2E_USER_ID` (numeric, wins when set), `E2E_USER_EMAIL` (default `owner@demo.invalid`), `E2E_VERIFY_PATH` (default `/dashboard`). Writes storageState to `.auth/app.json`; exits non-zero if the guard bounces to `/auth`.
  - `node scripts/playwright/smoke.mjs` — exits 0 iff `.auth/app.json` enters `E2E_VERIFY_PATH` without bouncing to `/auth`; screenshot at `tmp/verification/smoke.png`. Phase 13's gate calls both.
  - `scripts/playwright/package.json` with `npm run auth` / `npm run smoke` and devDeps `@playwright/mcp@^0.0.41`, `playwright@^1.58.2`.

**Irene-isms eliminated (vs the irene sources read 2026-07-08):** `:3001`→`:3000`; `.auth/irene.json`→`.auth/app.json`; `INSERT INTO session (user_id, jwt_token, expires_at, type) VALUES (...,'web')`→`INSERT INTO sessions (user_id, token, expires_at)`; `E2E_VERIFY_PATH` default `/salon/1/owner`→`/dashboard` (+ salon comment rewritten); `E2E_USER_ID` default `1` w/ salon comment→email-based lookup defaulting to `owner@demo.invalid`; header comment "Irene auth ="→"App auth ="; `session` table prose→`sessions`; smoke route `/salon/1/owner`→`E2E_VERIFY_PATH`; package name `irene-browser-verification`→`app-browser-verification`.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/scripts/playwright/auth-setup.mjs` with exactly this content:

  ```js
  // Mint a session ONCE -> save an authenticated Playwright storageState.
  // The Playwright MCP server then boots with that state and the agent's browser
  // starts already logged in, with no OTP flow to drive on every verification.
  //
  // App auth = a JWT cookie (`session_token`, HS256, 30d, signed with AUTH_SECRET)
  // PLUS a matching row in the `sessions` table. The layout guard
  // (lib/auth/session.ts) requires both: a valid JWT and a non-deactivated,
  // unexpired sessions row whose `token` equals the cookie. So we mint the JWT,
  // INSERT the row, then bake the cookie into a storageState file — no UI login.
  //
  // Usage:  node auth-setup.mjs
  // Env (loaded from repo-root .env.local then .env if not already set):
  //   AUTH_SECRET     (required — same secret the dev server uses to verify the JWT)
  //   DATABASE_URL    (required — MUST be the database the target server reads)
  //   BASE_URL        (default http://localhost:3000)
  //   E2E_USER_ID     (numeric user id; wins over E2E_USER_EMAIL when set)
  //   E2E_USER_EMAIL  (default owner@demo.invalid — seeded by scripts/seed-demo.mjs)
  //   E2E_VERIFY_PATH (default /dashboard — any session-guarded route)

  import path from 'node:path'
  import { fileURLToPath } from 'node:url'
  import { mkdirSync, readFileSync, existsSync } from 'node:fs'
  import { chromium } from 'playwright'
  import { SignJWT } from 'jose'
  import pg from 'pg'

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const REPO_ROOT = path.resolve(__dirname, '../..')

  // --- minimal env loader: repo-root .env.local then .env, never overriding ---
  for (const file of ['.env.local', '.env']) {
    const p = path.join(REPO_ROOT, file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
      if (!m || line.trim().startsWith('#')) continue
      const key = m[1]
      const val = m[2].trim().replace(/^["']|["']$/g, '')
      if (process.env[key] === undefined) process.env[key] = val
    }
  }

  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
  const AUTH_SECRET = process.env.AUTH_SECRET
  const DATABASE_URL = process.env.DATABASE_URL
  const USER_EMAIL = process.env.E2E_USER_EMAIL || 'owner@demo.invalid'

  // Cookie name = AUTH_SESSION_COOKIE in lib/auth/identifier.ts. Keep in sync.
  const COOKIE_NAME = 'session_token'
  const AUTH_FILE = path.resolve(REPO_ROOT, '.auth/app.json')
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

  // Guard-verify path: a route whose layout requires a session. Navigating it
  // proves the minted state is ACCEPTED before we save the storageState.
  const VERIFY_PATH = process.env.E2E_VERIFY_PATH || '/dashboard'

  if (!AUTH_SECRET) throw new Error('AUTH_SECRET is not set (checked env, .env.local, .env)')
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set (checked env, .env.local, .env)')

  // Mirror lib/auth/jwt.ts::createSessionToken exactly (slim payload: numeric userId).
  async function createSessionToken(userId) {
    const secret = new TextEncoder().encode(AUTH_SECRET)
    return new SignJWT({ userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)
  }

  async function main() {
    mkdirSync(path.dirname(AUTH_FILE), { recursive: true })

    const pool = new pg.Pool({ connectionString: DATABASE_URL })
    let userId
    let token
    try {
      if (process.env.E2E_USER_ID) {
        userId = Number(process.env.E2E_USER_ID)
      } else {
        const r = await pool.query(
          `SELECT u.id FROM users u JOIN persons p ON p.id = u.person_id WHERE p.email = $1`,
          [USER_EMAIL]
        )
        if (!r.rows.length) {
          throw new Error(
            `No user found for ${USER_EMAIL}. Run: node scripts/seed-demo.mjs (or pass E2E_USER_ID).`
          )
        }
        userId = r.rows[0].id
      }

      console.log(`> Minting session for userId=${userId}`)
      token = await createSessionToken(userId)
      const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS)
      await pool.query(
        `INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [userId, token, expiresAt]
      )
    } finally {
      await pool.end()
    }
    console.log('> Session row inserted')

    // Bake the cookie into a storageState by setting it on a real context, then
    // navigating once to prove the guard accepts it before we save.
    const browser = await chromium.launch()
    const context = await browser.newContext()
    const { hostname } = new URL(BASE_URL)
    await context.addCookies([
      {
        name:     COOKIE_NAME,
        value:    token,
        domain:   hostname,
        path:     '/',
        httpOnly: true,
        secure:   false,
        sameSite: 'Lax',
        expires:  Math.floor((Date.now() + THIRTY_DAYS_MS) / 1000),
      },
    ])

    const page = await context.newPage()
    const target = `${BASE_URL}${VERIFY_PATH}`
    console.log(`> Verifying the session lands authenticated at ${target}`)
    await page.goto(target, { waitUntil: 'domcontentloaded' })

    if (new URL(page.url()).pathname.startsWith('/auth')) {
      await browser.close()
      throw new Error(
        `Redirected to ${page.url()} — guard rejected the session. ` +
          `Check that userId=${userId} exists and DATABASE_URL matches the target server's DB.`
      )
    }

    await context.storageState({ path: AUTH_FILE })
    await browser.close()
    console.log(`> OK — authenticated state saved to ${AUTH_FILE}`)
  }

  main().catch((err) => {
    console.error('auth-setup FAILED:', err.message)
    process.exit(1)
  })
  ```

- [ ] Step: Write `/Users/luca/dev/winter-park/template/scripts/playwright/smoke.mjs` with exactly this content:

  ```js
  // Quick proof that the saved storageState enters ALREADY authenticated (no OTP).
  // Opens a session-guarded route, confirms it did not bounce to /auth, screenshots.
  //
  // Usage:  node smoke.mjs    (run auth-setup.mjs first)
  // Env:    BASE_URL        (default http://localhost:3000)
  //         E2E_VERIFY_PATH (default /dashboard)

  import path from 'node:path'
  import { fileURLToPath } from 'node:url'
  import { existsSync, mkdirSync } from 'node:fs'
  import { chromium } from 'playwright'

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const REPO_ROOT = path.resolve(__dirname, '../..')

  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
  const VERIFY_PATH = process.env.E2E_VERIFY_PATH || '/dashboard'
  const AUTH_FILE = path.resolve(REPO_ROOT, '.auth/app.json')
  const SHOT = path.resolve(REPO_ROOT, 'tmp/verification/smoke.png')

  if (!existsSync(AUTH_FILE)) {
    console.error(`State not found at ${AUTH_FILE}. Run: node scripts/playwright/auth-setup.mjs`)
    process.exit(1)
  }

  const browser = await chromium.launch()
  const context = await browser.newContext({ storageState: AUTH_FILE })
  const page = await context.newPage()

  await page.goto(`${BASE_URL}${VERIFY_PATH}`, { waitUntil: 'domcontentloaded' })
  const url = page.url()
  const title = await page.title()

  mkdirSync(path.dirname(SHOT), { recursive: true })
  await page.screenshot({ path: SHOT, fullPage: true })
  await browser.close()

  const ok = !new URL(url).pathname.startsWith('/auth')
  console.log(`URL:        ${url}`)
  console.log(`Title:      ${title}`)
  console.log(`Screenshot: ${SHOT}`)
  console.log(ok ? 'OK — authenticated via saved state.' : 'FAIL — bounced to /auth; state invalid/expired.')
  process.exit(ok ? 0 : 1)
  ```

- [ ] Step: Write `/Users/luca/dev/winter-park/template/scripts/playwright/package.json` with exactly this content:

  ```json
  {
    "name": "app-browser-verification",
    "private": true,
    "type": "module",
    "description": "Browser-verification tooling (Playwright) — isolated from the app's build pipeline. playwright, jose and pg resolve from the repo-root node_modules; `npm install` here only adds @playwright/mcp for machines that pin it locally.",
    "scripts": {
      "auth": "node auth-setup.mjs",
      "smoke": "node smoke.mjs"
    },
    "devDependencies": {
      "@playwright/mcp": "^0.0.41",
      "playwright": "^1.58.2"
    }
  }
  ```

- [ ] Step: append to `/Users/luca/dev/winter-park/template/.gitignore`, immediately after the phase-1 QA block's last line (`playwright-artifacts-*/`):

  ```gitignore

  # playwright harness local install + QA screenshot scratch
  /scripts/playwright/node_modules/
  /tmp/
  ```
  (Phase 1 already ignores `/.auth/`, `.playwright-mcp/`, `/*.png`, `playwright_*/`, `playwright-artifacts-*/` — do not duplicate. `/tmp/` is where visit/interact/mobile/smoke write screenshots by default.)
- [ ] Step: verification — Run: `node --check scripts/playwright/auth-setup.mjs && node --check scripts/playwright/smoke.mjs && node -e "JSON.parse(require('fs').readFileSync('scripts/playwright/package.json','utf8'));console.log('json ok')"` → expected: `json ok`, exit 0. Then: `git check-ignore scripts/playwright/node_modules/x tmp/qa/x.png` → expected: both paths echoed, exit 0. Then: `grep -rniE "irene|salon|:3001" scripts/playwright/` → expected: no output, exit 1. Then: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: verification (live, needs dev server + DB — otherwise defer to phase 13's gate): with `npm run dev` running and Task 12.1's seed applied: `node scripts/playwright/auth-setup.mjs` → expected: `> OK — authenticated state saved to <repo>/.auth/app.json`, exit 0. Then `node scripts/playwright/smoke.mjs` → expected: `OK — authenticated via saved state.`, exit 0, and the final URL printed contains `/dashboard` (not `/auth`).
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add scripts/playwright/auth-setup.mjs scripts/playwright/smoke.mjs scripts/playwright/package.json .gitignore
  git commit -m "backport(qa): Playwright pre-auth harness (auth-setup + smoke, storageState .auth/app.json)" -m "Mints the slim JWT ({userId:number}) mirroring lib/auth/jwt.ts, INSERTs the plural sessions row (token column), verifies against /dashboard. Default target user owner@demo.invalid from seed-demo; BASE_URL :3000. Ignores /scripts/playwright/node_modules/ and /tmp/." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12.3: `.mcp.json` — Playwright MCP wiring

**Files:**
- Create: `/Users/luca/dev/winter-park/template/.mcp.json` (port of `/Users/luca/dev/winter-park/irene/.mcp.json` — single edit: `--storage-state=.auth/irene.json` → `--storage-state=.auth/app.json`)

**Interfaces:**
- Consumes: `.auth/app.json` produced by Task 12.2's auth-setup.
- Produces: project-scoped `playwright` MCP server definition (headless, isolated, pre-authed) that `verify-in-browser` (Task 12.9), `browser-verifier-mcp` (Task 12.7) and the QA charter (Task 12.5) rely on. `--isolated` + `--storage-state` MUST travel together (without `--isolated`, `@playwright/mcp` ignores the state — documented in the skill).

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/.mcp.json` with exactly this content:

  ```json
  {
    "mcpServers": {
      "playwright": {
        "type": "stdio",
        "command": "npx",
        "args": [
          "@playwright/mcp@latest",
          "--headless",
          "--isolated",
          "--storage-state=.auth/app.json"
        ],
        "env": {}
      }
    }
  }
  ```

- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && node -e "const j=JSON.parse(require('fs').readFileSync('.mcp.json','utf8'));const a=j.mcpServers.playwright.args;if(!a.includes('--isolated')||!a.includes('--storage-state=.auth/app.json'))throw new Error('bad args');console.log('mcp ok')"` → expected: `mcp ok`, exit 0. Then: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add .mcp.json
  git commit -m "backport(qa): Playwright MCP wiring (.mcp.json — headless, isolated, .auth/app.json)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12.4: QA auditor scripts — `scripts/qa/{visit,interact,mobile,contrast,sql}.mjs`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/scripts/qa/visit.mjs` (port of `/Users/luca/dev/winter-park/irene/scripts/qa/visit.mjs`, 152 lines)
- Create: `/Users/luca/dev/winter-park/template/scripts/qa/interact.mjs` (port of `/Users/luca/dev/winter-park/irene/scripts/qa/interact.mjs`, 115 lines)
- Create: `/Users/luca/dev/winter-park/template/scripts/qa/mobile.mjs` (port of `/Users/luca/dev/winter-park/irene/scripts/qa/mobile.mjs`, 61 lines)
- Create: `/Users/luca/dev/winter-park/template/scripts/qa/contrast.mjs` (port of `/Users/luca/dev/winter-park/irene/scripts/qa/contrast.mjs`, 68 lines)
- Create: `/Users/luca/dev/winter-park/template/scripts/qa/sql.mjs` (port of `/Users/luca/dev/winter-park/irene/scripts/qa/sql.mjs`, 62 lines)

Do NOT port any other `scripts/qa/*` file (drive.mjs, record-*.mjs, shoot-*.mjs, seed-overnight.mjs, scenarios/, check-/verify-/*-check.ts, findings artifacts) — salon-specific per the spec's exclusion list.

**Interfaces:**
- Consumes: `.auth/app.json` (Task 12.2); `BASE_URL` env default `http://localhost:3000`; theme localStorage key `app.theme.mode` (phase 4 `ThemeProvider storageKey`); root-hoisted `playwright` + `pg`; `DATABASE_URL` hydration pattern (sql.mjs).
- Produces (CLI contracts the agents/skills in Tasks 12.6–12.11 and the charter in 12.5 reference):
  - `node scripts/qa/visit.mjs [--outdir D] [--dark] [--no-auth] [--width N] <path-or-url>...` → JSON array on stdout (`httpStatus`, `bouncedToAuth`, `consoleErrors`, `pageErrors`, `failedRequests`, DOM digest), screenshots `<outdir>/<slug>.png` (default outdir `tmp/qa/_visits`).
  - `node scripts/qa/interact.mjs [--no-auth] [--outdir D] <path>...` → empty-submit validation probe, JSON on stdout, before/after screenshots (default outdir `tmp/qa/interact`).
  - `node scripts/qa/mobile.mjs --outdir <D> <routes...>` → 390×844 overflow audit, per-route `ok`/`OVERFLOW` lines + screenshots.
  - `node scripts/qa/contrast.mjs <routes...>` → WCAG AA contrast failures per route.
  - `node scripts/qa/sql.mjs "<SQL>"` | `-f file.sql` | stdin → rows as JSON (DB truth for QA runs).

**Steps:**

- [ ] Step: copy sources —
  ```bash
  mkdir -p /Users/luca/dev/winter-park/template/scripts/qa
  cp /Users/luca/dev/winter-park/irene/scripts/qa/visit.mjs /Users/luca/dev/winter-park/template/scripts/qa/visit.mjs
  cp /Users/luca/dev/winter-park/irene/scripts/qa/interact.mjs /Users/luca/dev/winter-park/template/scripts/qa/interact.mjs
  cp /Users/luca/dev/winter-park/irene/scripts/qa/mobile.mjs /Users/luca/dev/winter-park/template/scripts/qa/mobile.mjs
  cp /Users/luca/dev/winter-park/irene/scripts/qa/contrast.mjs /Users/luca/dev/winter-park/template/scripts/qa/contrast.mjs
  cp /Users/luca/dev/winter-park/irene/scripts/qa/sql.mjs /Users/luca/dev/winter-park/template/scripts/qa/sql.mjs
  ```
- [ ] Step: apply generalization edits to `scripts/qa/visit.mjs` (line refs = irene source):
  1. Line 8 usage comment: `//   node scripts/qa/visit.mjs --dark /salon/1/owner            # toggle dark mode` → `//   node scripts/qa/visit.mjs --dark /dashboard                 # toggle dark mode`
  2. Line 10 usage comment: `//   node scripts/qa/visit.mjs --outdir tmp/qa/owner <paths...>  # screenshot dir` → `//   node scripts/qa/visit.mjs --outdir tmp/qa/run1 <paths...>   # screenshot dir`
  3. Line 12: `// Env: BASE_URL (default http://localhost:3001)` → `// Env: BASE_URL (default http://localhost:3000)`
  4. Line 22: `const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'` → `const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'`
  5. Line 23: `const AUTH_FILE = path.resolve(REPO_ROOT, '.auth/irene.json')` → `const AUTH_FILE = path.resolve(REPO_ROOT, '.auth/app.json')`
  6. Lines 74–80 (the dark-mode init block incl. its 3-line comment) — replace:
     ```js
       // Force dark BOTH ways: next-themes' key AND the app's ThemeToggle mode key
       // (`irene.theme.mode`) — otherwise the ThemeToggle's mount effect re-resolves
       // `system` (→ light in headless Chrome) and reverts the forced dark class.
       if (dark) await page.addInitScript(() => {
         localStorage.setItem('theme', 'dark')
         localStorage.setItem('irene.theme.mode', 'dark')
       })
     ```
     →
     ```js
       // Force dark BOTH ways: persist next-themes' key BEFORE load (the
       // ThemeProvider storageKey is `app.theme.mode` — lib/theme/ThemeProvider.tsx),
       // then add the `dark` class after load — otherwise the provider's mount
       // effect re-resolves `system` (→ light in headless Chrome) and reverts a
       // class-only toggle.
       if (dark) await page.addInitScript(() => {
         localStorage.setItem('app.theme.mode', 'dark')
       })
     ```
     (Line 95 `if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))` stays — it is the second half of "BOTH ways".)
- [ ] Step: apply generalization edits to `scripts/qa/interact.mjs`:
  1. Line 16: `const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'` → `const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'`
  2. Line 17: `const AUTH_FILE = path.resolve(REPO_ROOT, '.auth/irene.json')` → `const AUTH_FILE = path.resolve(REPO_ROOT, '.auth/app.json')`
  3. Lines 37–38 (comment + regex) — replace:
     ```js
     // label patterns for the primary action button (pt-BR + a few en)
     const SUBMIT_RX = /^(continuar|salvar|criar|adicionar|avançar|próximo|confirmar|cadastrar|registrar|enviar|concluir|continue|save|create|add|next|submit)\b/i
     ```
     →
     ```js
     // label patterns for the primary action button — English-first, with pt-BR
     // alternates (extend for your app's locales)
     const SUBMIT_RX = /^(continue|save|create|add|next|submit|send|confirm|register|finish|verify|continuar|salvar|criar|adicionar|avançar|próximo|confirmar|cadastrar|registrar|enviar|concluir)\b/i
     ```
- [ ] Step: apply generalization edits to `scripts/qa/mobile.mjs`:
  1. Line 3 comment: `// elements, and writes a screenshot per route. Authenticated via .auth/irene.json.` → `// elements, and writes a screenshot per route. Authenticated via .auth/app.json.`
  2. Line 12: `const base = process.env.BASE_URL || 'http://localhost:3001'` → `const base = process.env.BASE_URL || 'http://localhost:3000'`
  3. Line 45: `storageState: routes[0]?.startsWith('/auth') ? undefined : path.resolve('.auth/irene.json'),` → `storageState: routes[0]?.startsWith('/auth') ? undefined : path.resolve('.auth/app.json'),`
- [ ] Step: apply generalization edits to `scripts/qa/contrast.mjs`:
  1. Line 3 usage comment: `// Usage: node scripts/qa/contrast.mjs /salon/1/owner /salon/1/owner/analysis ...` → `// Usage: node scripts/qa/contrast.mjs /dashboard /docs ...`
  2. Line 8: `const base = process.env.BASE_URL || 'http://localhost:3001'` → `const base = process.env.BASE_URL || 'http://localhost:3000'`
  3. Line 9: `const storage = path.resolve('.auth/irene.json')` → `const storage = path.resolve('.auth/app.json')`
- [ ] Step: apply generalization edit to `scripts/qa/sql.mjs` (everything else is verbatim — zero entanglement):
  1. Line 6 usage comment: `//   node scripts/qa/sql.mjs "SELECT count(*) FROM customer"` → `//   node scripts/qa/sql.mjs "SELECT count(*) FROM persons"`
- [ ] Step: verification — Run: `for f in scripts/qa/*.mjs; do node --check "$f" || exit 1; done && echo syntax-ok` → expected: `syntax-ok`, exit 0. Then: `grep -rniE "irene|salon|:3001" scripts/qa/` → expected: no output, exit 1. Then: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: verification (live, needs dev server + `.auth/app.json` — otherwise defer to phase 13's gate): `node scripts/qa/visit.mjs --outdir tmp/qa/gate /dashboard` → expected: JSON array with one object, `"httpStatus": 200`, `"bouncedToAuth": false`, `consoleErrors: []`; PNG written under `tmp/qa/gate/`. Then `node scripts/qa/visit.mjs --no-auth /auth/identify` → expected `"httpStatus": 200`.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add scripts/qa/visit.mjs scripts/qa/interact.mjs scripts/qa/mobile.mjs scripts/qa/contrast.mjs scripts/qa/sql.mjs
  git commit -m "backport(qa): agent-eyes auditor scripts (visit/interact/mobile/contrast/sql)" -m "Parameterized: .auth/app.json, BASE_URL :3000, dark-mode key app.theme.mode, English-first submit regex with pt-BR alternates. drive.mjs and the salon capture/scenario scripts deliberately not ported." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12.5: Findings ledger — `scripts/qa/{add-findings,render-findings}.mjs` + QA charter `.claude/qa/README.md`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/scripts/qa/add-findings.mjs` (verbatim port of `/Users/luca/dev/winter-park/irene/scripts/qa/add-findings.mjs`, 71 lines — verified zero irene/salon references)
- Create: `/Users/luca/dev/winter-park/template/scripts/qa/render-findings.mjs` (verbatim port of `/Users/luca/dev/winter-park/irene/scripts/qa/render-findings.mjs`, 65 lines — verified zero irene/salon references)
- Create: `/Users/luca/dev/winter-park/template/.claude/qa/README.md` (charter TEMPLATE — new content below; irene's charter is a salon work-product, only its structure ports)
- Create: `/Users/luca/dev/winter-park/template/.claude/qa/findings/.gitkeep` (empty file — render-findings writes `INDEX.md`/`FINDINGS.md` here)

Do NOT port irene's run artifacts: `findings.jsonl` (~1MB), `findings/*`, `FINDINGS.md`, `BACKLOG.md`, `REPORT.md`, `coverage.md`, `ROLE-AUDIT-*.md`, `scene-audit.md`.

**Interfaces:**
- Consumes: reviewer JSON contract emitted by `qa-engineer`/`qa-ux` (Task 12.8): `{ route, role, state_reviewed, findings: [{ title, lens, severity, trivial, file?, line?, screenshot?, evidence, repro?, suggested_fix, confidence }], notes }`.
- Produces:
  - `node scripts/qa/add-findings.mjs <reviewer-output.json>...` → appends deduped (route+title) records to `.claude/qa/findings.jsonl`, prints `added=N skipped(dup)=N total=N`.
  - `node scripts/qa/render-findings.mjs` → regenerates `.claude/qa/findings/INDEX.md` + `.claude/qa/findings/FINDINGS.md` from the ledger.
  - `.claude/qa/README.md` — the charter template the QA orchestrator + agents follow (route×role×state matrix, per-route loop, resume semantics).

**Steps:**

- [ ] Step: copy sources —
  ```bash
  cp /Users/luca/dev/winter-park/irene/scripts/qa/add-findings.mjs /Users/luca/dev/winter-park/template/scripts/qa/add-findings.mjs
  cp /Users/luca/dev/winter-park/irene/scripts/qa/render-findings.mjs /Users/luca/dev/winter-park/template/scripts/qa/render-findings.mjs
  mkdir -p /Users/luca/dev/winter-park/template/.claude/qa/findings
  touch /Users/luca/dev/winter-park/template/.claude/qa/findings/.gitkeep
  ```
  No edits to either `.mjs` — both are app-agnostic (ledger paths `.claude/qa/findings.jsonl`, `.claude/qa/findings/` are already the template convention).
- [ ] Step: Write `/Users/luca/dev/winter-park/template/.claude/qa/README.md` with exactly this content:

  ````markdown
  # Autonomous QA Run — Charter (template)

  A self-running QA pass over the whole app. The orchestrator (main Claude session) walks a bounded coverage matrix, using a real browser (Playwright MCP) to *see* the app, and emits findings to a local ledger. It stops only when every matrix cell is `covered` or `blocked`.

  This file is a TEMPLATE: fill §Decisions and the route/role lists for your app before the first run, and keep them updated between runs.

  ## Decisions (lock with the user before the first run)

  - **Mutation policy:** catalog everything; **auto-fix trivial only** (typos, dead imports, obvious copy/i18n) as individual commits on branch `qa/autonomous-run`. Never touch migrations / schema / auth. Substantive findings stay catalog-only.
  - **Findings sink:** local ledger — `.claude/qa/findings.jsonl` (append via `scripts/qa/add-findings.mjs`; markdown views regenerated by `scripts/qa/render-findings.mjs` into `.claude/qa/findings/`).
  - **Data:** may seed/mutate the **dev DB** (`.env.local` `DATABASE_URL`) freely to force states. Use `scripts/qa/sql.mjs` and `scripts/seed-demo.mjs`. Neutral test data only; restore where reasonable.
  - **Run mechanism:** orchestrated loop in the main session. Browser passes serialize (one isolated browser); the two review lenses run in parallel per route.
  - **Roles:** enumerate your app's role surfaces. The template scaffold seeds: `public/auth` (logged out), `member` (any signed-in user → `/dashboard`, `/workspace/<id>`), `admin` (platform admin). Mint a role's session via `E2E_USER_EMAIL=<seed email> node scripts/playwright/auth-setup.mjs` (seed emails: `owner@demo.invalid`, `member@demo.invalid`, `admin@demo.invalid`).

  ## The coverage matrix (route × role × state)

  QA coverage is a bounded matrix, not a vibe:

  - **Routes** — every entry in the app's route tree (walk `app/**/page.tsx`; keep the list in `coverage.md` next to this file).
  - **Roles** — every access level that changes what a route renders.
  - **States** — per route, the applicable subset of: `populated · empty · loading · error · interaction` (form submit / validation / multi-step). Force states through the DB (`sql.mjs`) — don't wait for them to occur naturally.

  Mark each cell `[ ]` todo · `[~]` in progress · `[x]` done · `[b]` blocked(reason) in `coverage.md`. A route is DONE when all its applicable cells are `[x]`/`[b]`.

  ## Agents

  - `browser-verifier-mcp` — the eyes. Drives Playwright MCP, walks a route across states, captures screenshots → `tmp/qa/<role>/<route-slug>/<state>.png`, console errors, DOM facts. Returns a concise observation report.
  - `qa-engineer` — engineering lens (bugs, errors, perf, dead code, framework-invariant violations). Reads code + observations.
  - `qa-ux` — user lens (clarity, copy, i18n, visual consistency, a11y, friction, ideas). Reasons over screenshots.

  ## Per-route loop

  1. Orchestrator gathers DB truth for the route (`scripts/qa/sql.mjs`), seeds states if needed.
  2. Dispatch `browser-verifier-mcp` → observations + screenshots (serial; single browser).
  3. Dispatch `qa-engineer` + `qa-ux` in parallel over those observations.
  4. Orchestrator triages: save each reviewer's JSON to a file, `node scripts/qa/add-findings.mjs <file>...` (dedupes on route+title), `node scripts/qa/render-findings.mjs`, mark the cell in `coverage.md`.
  5. Auto-fix any `trivial: true` finding → one commit `qa(fix): <title> [#NNNN]`; flip finding status to `fixed`.
  6. Next cell.

  ## Ledger format

  `.claude/qa/findings.jsonl` — one JSON object per line (append-only; `add-findings.mjs` assigns ids). Fields:

  ```json
  {"id": 1, "title": "…", "lens": "engineering", "severity": "critical|high|medium|low|idea", "status": "open|fixed|wontfix", "trivial": false, "role": "member", "route": "/dashboard", "state": "populated", "file": "app/…/X.tsx", "line": 42, "screenshot": "tmp/qa/member/dashboard/populated.png", "evidence": "…", "repro": "…", "suggested_fix": "…", "confidence": "high", "created": "ISO-8601"}
  ```

  ## Resume

  `coverage.md` is the single source of truth for "what's left." On resume, read it, find the first non-`[x]`/`[b]` cell, continue. Findings are append-only; the markdown views are regenerated from the ledger.

  ## Prereqs (must hold during the run)

  - Dev server on `http://localhost:3000`.
  - Demo users seeded: `node scripts/seed-demo.mjs`.
  - Auth state minted at `.auth/app.json` (`node scripts/playwright/auth-setup.mjs`) + Playwright MCP connected (`.mcp.json`).

  ## Final output

  When the matrix is exhausted: a synthesis report at `.claude/qa/REPORT.md` — themes, top issues by severity, the auto-fix log, and a suggested roadmap.
  ````

- [ ] Step: verification — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template
  node --check scripts/qa/add-findings.mjs && node --check scripts/qa/render-findings.mjs
  printf '{"route":"/dashboard","role":"member","state_reviewed":"populated","lens":"engineering","findings":[{"title":"Gate check finding","severity":"low","trivial":true,"evidence":"gate"}]}' > /tmp/qa-gate-finding.json
  node scripts/qa/add-findings.mjs /tmp/qa-gate-finding.json
  node scripts/qa/render-findings.mjs
  grep -c "Gate check finding" .claude/qa/findings/INDEX.md
  ```
  → expected: `added=1 skipped(dup)=0 total=1`; `rendered 1 findings -> INDEX.md + FINDINGS.md`; final grep prints `1`. Then CLEAN THE GATE ARTIFACTS (the shipped template must carry an empty ledger):
  ```bash
  rm -f .claude/qa/findings.jsonl .claude/qa/findings/INDEX.md .claude/qa/findings/FINDINGS.md /tmp/qa-gate-finding.json
  ```
  Then: `grep -rniE "irene|salon|:3001" scripts/qa/add-findings.mjs scripts/qa/render-findings.mjs .claude/qa/` → expected: no output, exit 1. Then: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add scripts/qa/add-findings.mjs scripts/qa/render-findings.mjs .claude/qa/README.md .claude/qa/findings/.gitkeep
  git commit -m "backport(qa): findings ledger (add/render) + autonomous-QA charter template" -m "Ledger scripts verbatim (already app-agnostic). Charter generalized: route×role×state matrix, template seed roles, per-route two-lens loop, resume semantics. Irene run artifacts not ported." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12.6: Navigation map skeleton — `.claude/agents/app-navigation.md`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/.claude/agents/app-navigation.md` (NEW skeleton — irene's 214-line map is ~90% salon route/bug ledger; only Environment, auth-injection, controlled-input trick, generic pitfalls and the self-update convention port)

**Interfaces:**
- Consumes: Task 12.1 seed users; Task 12.2 auth-setup + `.auth/app.json`; Task 12.3 `.mcp.json`; template routes (see "What already exists"); `sessions` schema (phase 5).
- Produces: `.claude/agents/app-navigation.md` — the shared knowledge base every browser agent (Tasks 12.7/12.8) and skill (12.9/12.10) references by path. Section contract other files rely on: `## Environment`, `## Auth injection`, `## Routes`, `## Design-system signatures`, `## Controlled-input fill trick`, `## Common pitfalls`, `## Self-update instruction`.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/.claude/agents/app-navigation.md` with exactly this content:

  ````markdown
  # App Navigation Map

  Living reference for the browser-verification agents (`browser-verifier-mcp`, `browser-verifier`) and QA reviewers. Documents routes, key selectors, and verification patterns. **Update this file whenever you discover something new about how a route renders or behaves** — the next run starts from your notes. This skeleton ships with the template; it grows with the app.

  ## Environment

  - **Dev server:** `http://localhost:3000` (`npm run dev` — Turbopack)
  - **Seed users** (from `node scripts/seed-demo.mjs`, all sentinel-scoped to `@demo.invalid`):
    - `owner@demo.invalid` — workspace role `owner` in the demo workspace
    - `member@demo.invalid` — workspace role `member`
    - `admin@demo.invalid` — platform role `admin` (no workspace membership)
  - **Demo workspace:** slug `demo-workspace` (id printed by the seed run)

  ## Auth injection

  Most routes are behind auth. Guarded layouts check a `session_token` cookie (JWT, HS256, 30d, signed with `AUTH_SECRET`) **plus** a matching `sessions` row whose `token` equals the cookie — `lib/auth/session.ts` checks both. **Inject auth; never drive the OTP flow from a verification agent** — it's slow and fragile.

  ### Recipe (one path for Playwright MCP and cmux)

  ```bash
  # 1) Mint a session + storageState (defaults to owner@demo.invalid; override
  #    with E2E_USER_EMAIL=<seed email> or E2E_USER_ID=<id>)
  node scripts/playwright/auth-setup.mjs

  # Playwright MCP: done — the server boots with .auth/app.json (see .mcp.json).
  # If you re-mint while the MCP is already connected, reconnect it (/mcp) so it
  # re-reads the state at boot.

  # cmux: extract the cookie from the saved state and set it on the surface
  TOKEN=$(node -e 'const s=require("./.auth/app.json");console.log(s.cookies.find(c=>c.name==="session_token").value)')
  cmux browser --surface surface:N cookies set \
    --name session_token --value "$TOKEN" \
    --url http://localhost:3000 --path /

  # 2) Navigate
  cmux browser --surface surface:N navigate 'http://localhost:3000/dashboard'
  ```

  The sessions row schema (verify against `db/schema/sessions.ts` if columns drift): `userId`, `token` (unique), `expiresAt`, `forceDeactivation` (defaults false), timestamps (default now).

  ## Routes

  > Seed list from the template scaffold. As the app grows, add one row per route with the page name and the key content/selectors an agent needs to verify it.

  ### Public / unauthenticated

  | Route | Page | Key Content |
  |-------|------|-------------|
  | `/` | Landing | Template landing page. |
  | `/auth/identify` | Identifier entry | Form with identifier input + submit; entry to the OTP flow. |
  | `/auth/verify` | OTP verify | Code input; reached from identify. |
  | `/auth/register` | Registration | Profile fields for first-time users. |
  | `/invite/[token]` | Invite accept | Public with a valid token; provisions membership + signs in. |
  | `/docs` · `/docs/<slug>` | Docs site | Rendered from `docs/*.md` (session-gated in production builds). |

  ### Authenticated

  | Route | Page | Key Content |
  |-------|------|-------------|
  | `/dashboard` | Dashboard | Session-guarded home; bounces to `/auth/identify` logged out. Default `E2E_VERIFY_PATH`. |
  | `/onboarding` | Onboarding | Landing for users with 0 workspace memberships. |
  | `/workspace/[workspaceId]` | Workspace home | Membership-guarded (owner/member) tenant surface. |

  ## Design-system signatures

  > Placeholder. When the app settles on visual primitives (cards, badges, amount/status components), document their DOM signatures here with one cheap `eval` assertion each, so verifier/`qa-ux` agents can check visual consistency without screenshots. Example shape:
  >
  > - `<Card>` surface — `section.rounded.border` with `bg-card` → `eval`: `document.querySelectorAll('section.rounded.border').length`

  ## Controlled-input fill trick

  `fill`/`type` (cmux or Playwright) only set the DOM `value` — they do NOT trigger React's `onChange` for controlled `<input value={state} …>` patterns, so React state never updates and the submit button stays disabled. Use the React-aware setter:

  ```js
  const inp = document.querySelector('#some-input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'Test value')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  ```

  Same trick on `<select>` with `HTMLSelectElement.prototype` and `dispatchEvent(new Event('change', { bubbles: true }))`.

  Uncontrolled inputs (`defaultValue={…}` only — the template's preferred form pattern, see `docs/forms.md`) accept plain `fill` directly. Inspect the JSX first if unsure.

  ## Common pitfalls

  - **Streaming SSR wedge** — after multiple HMR cycles, a page can hang on `app/loading.tsx`. Symptom: `eval 'document.querySelectorAll("button").length'` → `0` with the loading overlay still in the DOM. Recovery: hard reload (`eval 'location.reload(true)'`); if it persists, ask the dispatching agent to restart the dev server.
  - **`use cache` + `cookies()`** — if the console shows `Route X used cookies() inside "use cache"`, surface it to the dispatching agent: it's an app bug (dynamic data read inside a cache scope), not a harness problem.

  ## Self-update instruction

  When you learn something durable about a route (a selector, a quirk, a state that needs seeding, a bug that keeps biting), **edit this file in the same run** — add or update the route row / pitfall. Keep entries terse and factual. Agent-specific memory goes to `.claude/agent-memory/<agent>/` instead.
  ````

- [ ] Step: verification — Run: `grep -rniE "irene|salon|:3001|\.auth/irene" /Users/luca/dev/winter-park/template/.claude/agents/app-navigation.md` → expected: no output, exit 1. Then: `grep -c '^## ' .claude/agents/app-navigation.md` → expected: `7` (the seven section headings agents rely on). Then: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add .claude/agents/app-navigation.md
  git commit -m "backport(qa): app-navigation.md living-map skeleton (env, auth injection, React setter trick, self-update)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12.7: Browser-verifier agents — `browser-verifier-mcp.md` + legacy `browser-verifier.md` + agent-memory dirs

**Files:**
- Create: `/Users/luca/dev/winter-park/template/.claude/agents/browser-verifier-mcp.md` (port of `/Users/luca/dev/winter-park/irene/.claude/agents/browser-verifier-mcp.md`, 70 lines)
- Create: `/Users/luca/dev/winter-park/template/.claude/agents/browser-verifier.md` (port of `/Users/luca/dev/winter-park/irene/.claude/agents/browser-verifier.md`, 167 lines — kept: this environment is cmux-first)
- Create: `/Users/luca/dev/winter-park/template/.claude/agent-memory/browser-verifier-mcp/.gitkeep`
- Create: `/Users/luca/dev/winter-park/template/.claude/agent-memory/browser-verifier/.gitkeep`

**Interfaces:**
- Consumes: `.claude/agents/app-navigation.md` (Task 12.6 — both agents read it first); `.mcp.json` playwright server (12.3); `scripts/playwright/auth-setup.mjs` (12.2); `verify-in-browser` skill (12.9 — referenced by name; lands later in this phase, same commit train).
- Produces: dispatchable agents `browser-verifier-mcp` (Playwright MCP eyes; the QA charter's observer) and `browser-verifier` (cmux legacy alternative), both with `memory: project` frontmatter + Self-improvement sections writing to `.claude/agent-memory/<agent>/` (the agent-memory convention). Irene memory *content* does NOT port.

**Steps:**

- [ ] Step: copy sources —
  ```bash
  cp /Users/luca/dev/winter-park/irene/.claude/agents/browser-verifier-mcp.md /Users/luca/dev/winter-park/template/.claude/agents/browser-verifier-mcp.md
  cp /Users/luca/dev/winter-park/irene/.claude/agents/browser-verifier.md /Users/luca/dev/winter-park/template/.claude/agents/browser-verifier.md
  mkdir -p /Users/luca/dev/winter-park/template/.claude/agent-memory/browser-verifier-mcp /Users/luca/dev/winter-park/template/.claude/agent-memory/browser-verifier
  touch /Users/luca/dev/winter-park/template/.claude/agent-memory/browser-verifier-mcp/.gitkeep /Users/luca/dev/winter-park/template/.claude/agent-memory/browser-verifier/.gitkeep
  ```
- [ ] Step: apply generalization edits to `.claude/agents/browser-verifier-mcp.md` (line refs = irene source; keep frontmatter keys `model: sonnet`, `color: green`, `memory: project` unchanged):
  1. Line 3 (frontmatter `description`), three edits inside the string: `Use this agent to verify the Irene UI in a real browser` → `Use this agent to verify the app UI in a real browser`; `Context: A customer-detail section was just refactored.` → `Context: A detail section was just refactored.`; `user: \"Verify the customer detail page still renders all sections after the refactor\"` → `user: \"Verify the detail page still renders all sections after the refactor\"`; `assistant: \"I'll use the browser-verifier-mcp agent to open the page via Playwright MCP and walk every section.\"` stays; `user: \"Walk every owner route and confirm nothing broke\"` → `user: \"Walk every authed route and confirm nothing broke\"`
  2. Line 11: `You verify the Irene salon-management UI by driving a real browser via the **\`playwright\` MCP server**.` → `You verify this app's UI by driving a real browser via the **\`playwright\` MCP server**.`
  3. Line 20: `- **Target:** \`http://localhost:3001\` (override only if the dispatcher says so)` → `- **Target:** \`http://localhost:3000\` (override only if the dispatcher says so)`
  4. Line 27: `curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:3001/auth/identify` → `curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:3000/auth/identify`
  5. Line 28: `the MCP browser starts logged in via \`.auth/irene.json\`.` → `the MCP browser starts logged in via \`.auth/app.json\`.`
  6. Line 35: `Read \`url\` after redirecting actions (e.g. customer-create → detail page).` → `Read \`url\` after redirecting actions (e.g. create → detail page).`
  7. Line 47: `**URL:** http://localhost:3001/...` → `**URL:** http://localhost:3000/...`
  8. Line 52: `- [PASS] 6 sections rendered on customer detail (detail, highlights, bundles, treemap, timeline, visits-by-dow)` → `- [PASS] All expected sections rendered on the detail page (count matches the navigation map)`
- [ ] Step: apply generalization edits to `.claude/agents/browser-verifier.md` (keep frontmatter `model: haiku`, `color: green`, `memory: project`):
  1. Line 3 (frontmatter `description`): `Context: A customer-detail section was just refactored to use the new design primitives.` → `Context: A detail section was just refactored to use the new design primitives.`; `user: \"Verify the customer detail page still renders all sections after the refactor\"` → `user: \"Verify the detail page still renders all sections after the refactor\"`; `Context: Visual regression check across the whole owner surface after a token migration.` → `Context: Visual regression check across the whole authed surface after a token migration.`
  2. Line 11: `You verify UI by interacting with the Irene salon-management app in a real browser using cmux.` → `You verify UI by interacting with this app in a real browser using cmux.`
  3. Line 16: `- **Target:** \`http://localhost:3001\` (Next.js dev server with Turbopack)` → `- **Target:** \`http://localhost:3000\` (Next.js dev server with Turbopack)`
  4. Line 53: `cmux browser open 'http://localhost:3001' --workspace workspace:113` → `cmux browser open 'http://localhost:3000' --workspace workspace:<id>`
  5. Line 61: `Do this BEFORE navigating to any owner/attendant/admin route.` → `Do this BEFORE navigating to any session-guarded route.`
  6. Line 105: `cmux browser --surface surface:N click '[href*="/customers/1"]'` → `cmux browser --surface surface:N click '[href*="/dashboard"]'`
  7. Lines 129–137 (the Report Format example block) — replace:
     ```
     **URL:** http://localhost:3001/...
     **Status:** PASS / FAIL / PARTIAL

     ### Checks
     - [PASS] Page hydrates within 8s, no console errors
     - [PASS] CustomerTimeline header eyebrow reads "Linha do tempo · Últimos 30 dias"
     - [PASS] 25 timeline rows rendered (matches data)
     - [FAIL] Money rail debt amount missing on row 3 — expected "DEVE 40,00", got empty
     - [PASS] StatusBadge "AGENDADO" renders on upcoming appointment row
     ```
     →
     ```
     **URL:** http://localhost:3000/...
     **Status:** PASS / FAIL / PARTIAL

     ### Checks
     - [PASS] Page hydrates within 8s, no console errors
     - [PASS] Dashboard heading renders with the expected title
     - [PASS] 25 list rows rendered (matches DB truth)
     - [FAIL] Expected an empty-state CTA, got a blank section
     ```
- [ ] Step: verification — Run: `grep -rniE "irene|salon|:3001|\.auth/irene|workspace:113" .claude/agents/browser-verifier-mcp.md .claude/agents/browser-verifier.md` → expected: no output, exit 1. Then: `grep -c "memory: project" .claude/agents/browser-verifier-mcp.md .claude/agents/browser-verifier.md` → expected: `1` for each file. Then: `grep -c "Self-improvement\|Self-Improvement\|app-navigation.md" .claude/agents/browser-verifier-mcp.md` → expected ≥ 2 (map reference + self-improvement kept). Then: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add .claude/agents/browser-verifier-mcp.md .claude/agents/browser-verifier.md .claude/agent-memory/browser-verifier-mcp/.gitkeep .claude/agent-memory/browser-verifier/.gitkeep
  git commit -m "backport(qa): browser-verifier agents (Playwright MCP + legacy cmux) + agent-memory dirs" -m "De-irene'd: port 3000, .auth/app.json, template routes, generic report examples. memory: project + Self-improvement convention kept; irene memory content not ported." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12.8: QA reviewer agents — `qa-engineer.md` + `qa-ux.md` + agent-memory dirs

**Files:**
- Create: `/Users/luca/dev/winter-park/template/.claude/agents/qa-engineer.md` (port of `/Users/luca/dev/winter-park/irene/.claude/agents/qa-engineer.md`, 56 lines)
- Create: `/Users/luca/dev/winter-park/template/.claude/agents/qa-ux.md` (port of `/Users/luca/dev/winter-park/irene/.claude/agents/qa-ux.md`, 56 lines)
- Create: `/Users/luca/dev/winter-park/template/.claude/agent-memory/qa-engineer/.gitkeep`
- Create: `/Users/luca/dev/winter-park/template/.claude/agent-memory/qa-ux/.gitkeep`

**Interfaces:**
- Consumes: observation reports from `browser-verifier-mcp` (12.7); template `CLAUDE.md` invariants (the qa-engineer invariant list mirrors them: raw-URL/exits, actions never `redirect()`, hooks only in hook files, cache registry, no `Effect.gen` — all template-canonical after phases 3/11); `.claude/agents/app-navigation.md` "Design-system signatures" (12.6).
- Produces: dispatchable `qa-engineer` + `qa-ux` agents returning the findings-JSON contract consumed by `scripts/qa/add-findings.mjs` (12.5): `{ route, role, state_reviewed, findings: [{ title, lens, severity, trivial, file?, line?, screenshot?, evidence, repro?, suggested_fix, confidence }], notes }`. Both keep `memory: project` + agent-memory dirs.

**Steps:**

- [ ] Step: copy sources —
  ```bash
  cp /Users/luca/dev/winter-park/irene/.claude/agents/qa-engineer.md /Users/luca/dev/winter-park/template/.claude/agents/qa-engineer.md
  cp /Users/luca/dev/winter-park/irene/.claude/agents/qa-ux.md /Users/luca/dev/winter-park/template/.claude/agents/qa-ux.md
  mkdir -p /Users/luca/dev/winter-park/template/.claude/agent-memory/qa-engineer /Users/luca/dev/winter-park/template/.claude/agent-memory/qa-ux
  touch /Users/luca/dev/winter-park/template/.claude/agent-memory/qa-engineer/.gitkeep /Users/luca/dev/winter-park/template/.claude/agent-memory/qa-ux/.gitkeep
  ```
- [ ] Step: apply generalization edits to `.claude/agents/qa-engineer.md` (line refs = irene source; frontmatter `model: sonnet`, `color: red`, `memory: project` stay):
  1. Line 3 (frontmatter `description`): `Engineering-lens QA reviewer for the Irene app.` → `Engineering-lens QA reviewer for this app.`
  2. Line 15: `incorrect calculations (esp. money/commission math — see \`MEMORY.md\` commission rules);` → `incorrect calculations (especially money and date math);`
  3. Line 34 (example JSON): `"route": "/salon/1/owner/customers/1",` → `"route": "/dashboard",`
  4. Line 35 (example JSON): `"role": "owner",` → `"role": "member",`
  (Line 18's framework-invariant list ports verbatim — every named invariant is template-canonical CLAUDE.md content after the Effect/tokens/i18n phases: `route.exits.*`, no `redirect()` in actions, hooks only in hook files, cache registry, no `Effect.gen`, `'use client'` boundary pushed to leaves.)
- [ ] Step: add a Self-improvement section to `qa-engineer.md` (irene's file relies on the shared convention but has no explicit section — the template ships the convention explicitly). Append at the end of the file:
  ```markdown

  ## Self-improvement

  If you discover a durable code-level quirk (a recurring anti-pattern, a file that keeps regressing, a check worth repeating), note it in `.claude/agent-memory/qa-engineer/<topic>.md` (create the folder if needed). Route/selector knowledge goes to `.claude/agents/app-navigation.md` instead. Update existing notes rather than creating new files; keep it minimal.
  ```
- [ ] Step: apply generalization edits to `.claude/agents/qa-ux.md` (frontmatter `model: sonnet`, `color: blue`, `memory: project` stay):
  1. Line 3 (frontmatter `description`): `Customer/user-lens QA reviewer for the Irene salon app.` → `End-user-lens QA reviewer for this app.`; `proposes UX improvements and new feature ideas from a salon-owner/customer's point of view.` → `proposes UX improvements and new feature ideas from the end user's point of view.`
  2. Line 11: `You evaluate **one route at a time** as the people who actually use it would: the **salon owner** running their business, and the **customer** whose data/visits/money it represents.` → `You evaluate **one route at a time** as the people who actually use it would — the app's real personas (for the template scaffold: a **workspace owner** running their account and a **member** working inside it; redefine per app).`
  3. Line 16: `untranslated or mixed-language strings (app is pt-BR primarily — flag English leaking into UI or vice-versa);` → `untranslated or mixed-language strings (the template is English-first with pt-BR as the second seed locale — flag strings leaking from another locale);`
  4. Line 17: `Does this screen match the design family (cards, eyebrows, mono numbers, status labels, money rails) described in \`.claude/agents/app-navigation.md\`?` → `Does this screen match the design family documented under "Design-system signatures" in \`.claude/agents/app-navigation.md\`?`; `leftover legacy styling (e.g. debt as a pill instead of \`<DebtAmount>\`)` → `leftover legacy styling that predates the current token system`
  5. Line 22: `From an owner's POV, what's missing that would make this screen more useful?` → `From the user's POV, what's missing that would make this screen more useful?`
  6. Line 36 (example JSON): `"route": "/salon/1/owner",` → `"route": "/dashboard",`
  7. Line 37 (example JSON): `"role": "owner",` → `"role": "member",`
  8. Line 45 (example JSON): `"screenshot": "tmp/qa/owner/dashboard/populated.png",` → `"screenshot": "tmp/qa/member/dashboard/populated.png",`
- [ ] Step: add a Self-improvement section to `qa-ux.md` (same rationale). Append at the end of the file:
  ```markdown

  ## Self-improvement

  If you discover a durable UX convention or copy rule for this app (terminology decisions, tone, persona insights), note it in `.claude/agent-memory/qa-ux/<topic>.md` (create the folder if needed). Design-system DOM signatures go to `.claude/agents/app-navigation.md` instead. Update existing notes rather than creating new files; keep it minimal.
  ```
- [ ] Step: verification — Run: `grep -rniE "irene|salon|:3001|DebtAmount|commission" .claude/agents/qa-engineer.md .claude/agents/qa-ux.md` → expected: no output, exit 1. Then: `grep -c "memory: project" .claude/agents/qa-engineer.md .claude/agents/qa-ux.md` → expected: `1` each. Then: `grep -c '"findings"' .claude/agents/qa-engineer.md` → expected ≥ 1 (JSON contract intact). Then: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add .claude/agents/qa-engineer.md .claude/agents/qa-ux.md .claude/agent-memory/qa-engineer/.gitkeep .claude/agent-memory/qa-ux/.gitkeep
  git commit -m "backport(qa): qa-engineer + qa-ux reviewer agents (salon nouns -> placeholders, English-first i18n lens)" -m "Findings JSON contract unchanged (consumed by scripts/qa/add-findings.mjs). Self-improvement sections + agent-memory dirs added per the agent-memory convention." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12.9: Skill — `.claude/skills/verify-in-browser/SKILL.md`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/.claude/skills/verify-in-browser/SKILL.md` (rewrite of `/Users/luca/dev/winter-park/irene/.claude/skills/verify-in-browser/SKILL.md` — full content below; the irene file is short and irene-saturated, so a full Write beats an edit list)

**Interfaces:**
- Consumes: `scripts/playwright/auth-setup.mjs` + `smoke.mjs` (12.2); `.mcp.json` (12.3); `scripts/seed-demo.mjs` (12.1); `.claude/agents/app-navigation.md` (12.6).
- Produces: the `verify-in-browser` skill — the Playwright-MCP live-verification protocol referenced by `browser-verifier-mcp` (12.7) and the QA charter (12.5).

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/.claude/skills/verify-in-browser/SKILL.md` with exactly this content (structure and hard-won caveats — `--isolated`, boot-time state read, React setter, HMR wedge — carried over from irene verbatim; identifiers swapped to template values):

  ````markdown
  ---
  name: verify-in-browser
  description: Use when visually verifying the app UI in a real browser via Playwright MCP, confirming a route/feature renders and works, or checking a flow after implementing it. Drives the running app on localhost, already authenticated — an alternative to the cmux-based browser-verifier.
  ---

  # Browser verification (Playwright MCP)

  Drives the running app in a real browser via **Playwright MCP** to confirm what you implemented actually works — open a page, click, fill, assert the DOM. This is **live verification during development**, not a regression suite (that's `e2e/`).

  This is the Playwright-MCP path. The cmux-based `browser-verifier` agent + the `e2e-via-cmux` skill remain as the cmux alternative; the route map and notes in `.claude/agents/app-navigation.md` apply to both.

  ## How it works

  App auth = a `session_token` JWT cookie (HS256, 30d, signed with `AUTH_SECRET`) **plus** a matching row in the `sessions` table (the guard in `lib/auth/session.ts` checks both). Driving the OTP flow on every verification is slow, so instead:

  1. `scripts/playwright/auth-setup.mjs` mints the JWT, INSERTs the sessions row, and bakes the cookie into a Playwright `storageState` at `.auth/app.json` — **once**.
  2. The Playwright MCP server (`.mcp.json`) boots with `--isolated --storage-state=.auth/app.json`, so **the agent's browser starts already logged in**. You just navigate and assert.

  > **Critical:** `@playwright/mcp`'s `--storage-state` is only honored **with `--isolated`**. Without `--isolated` the MCP uses a persistent on-disk profile and *ignores* the saved state — the browser keeps landing on `/auth`. The two flags travel together in `.mcp.json`.

  ## Prerequisites (once per machine)

  ```bash
  cd scripts/playwright && npm install && npx playwright install chromium
  ```

  ## Pre-flight (every verification)

  1. **App up?** The target server must be running (defaults to `:3000`):
     ```bash
     curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:3000/auth/identify   # expect 200
     ```
     If it's down, ask the dispatcher to start it (`npm run dev`). Don't start it yourself.
  2. **Seed user exists?** `auth-setup` targets `owner@demo.invalid` by default (override with `E2E_USER_EMAIL` / `E2E_USER_ID`) — run `node scripts/seed-demo.mjs` once against the DB `DATABASE_URL` points at, and that DB must be the one the target server reads.
  3. **Auth state valid?** If `.auth/app.json` is missing or the MCP lands on `/auth`, regenerate:
     ```bash
     node scripts/playwright/auth-setup.mjs
     ```
     Prove the state works without the MCP: `node scripts/playwright/smoke.mjs`.

     > The MCP reads `--storage-state` **only at boot**. If you regenerate `.auth/app.json` while the server is already connected, run `/mcp` → reconnect `playwright` (or restart Claude Code) so it re-reads the file. Rule of thumb: ensure the file exists **before** connecting the MCP.

  ## Driving (Playwright MCP tools)

  > If the `playwright` MCP server doesn't appear, it was added in `.mcp.json` — restart Claude Code to load it.

  Standard loop: **navigate → snapshot → act → assert**.

  - `browser_navigate("http://localhost:3000/dashboard")`
  - `browser_snapshot()` — accessibility tree (cheap; prefer over screenshot)
  - `browser_click(ref)` / `browser_type(ref, "text")` / `browser_fill_form(...)`
  - `browser_evaluate(() => ...)` — cheap DOM assertions (counts, text, classes)
  - `browser_take_screenshot()` — only when a visual check is genuinely needed
  - `browser_console_messages()` — surface runtime errors

  ## React caveat

  This is Next.js + React. For **controlled** inputs (`<input value={state} …>`), Playwright's `fill`/`type` may not trigger React's `onChange`, leaving the next button disabled. Use the React-aware setter via `browser_evaluate` — the exact sequence is in `.claude/agents/app-navigation.md` ("Controlled-input fill trick"). Uncontrolled inputs (`defaultValue` only — the template's preferred form pattern) accept `fill`/`type` directly.

  Allow for hydration: wait for content before interacting. After many HMR cycles a page can wedge on `app/loading.tsx` — recover with a hard reload (`browser_evaluate(() => location.reload())`); if it persists, ask the dispatcher to restart the dev server.

  ## Useful routes

  See `.claude/agents/app-navigation.md` for the map. Quick picks: `/dashboard` (session-guarded home), `/auth/identify` (public), `/workspace/<id>` (membership-guarded).

  ## Protocol

  1. Navigate to the route the change affects.
  2. Assert expected state (text, element count, visibility) via `browser_snapshot` / `browser_evaluate`.
  3. Interact if the flow requires it; assert post-action state. Read `url` after actions that redirect (e.g. create → detail).
  4. Screenshot only when visual confirmation is needed.
  5. Check `browser_console_messages()` for errors.
  6. Report **PASS / FAIL / PARTIAL**, specific about what you checked.

  ## Cleanup

  Close any tabs/surfaces you opened before reporting.

  ## Content rules

  Never inject jokes or personality into app inputs. Use neutral test text ("Test user", "test@example.com"). Treat the dev DB as shared — don't leave junk behind.
  ````

- [ ] Step: verification — Run: `grep -rniE "irene|salon|:3001|\.auth/irene" .claude/skills/verify-in-browser/` → expected: no output, exit 1. Then: `grep -c "isolated" .claude/skills/verify-in-browser/SKILL.md` → expected ≥ 3 (the critical `--isolated` caveat survived). Then: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add .claude/skills/verify-in-browser
  git commit -m "backport(qa): verify-in-browser skill (Playwright MCP, pre-authed via .auth/app.json)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12.10: Skill — `.claude/skills/e2e-via-cmux/SKILL.md` (kept — this environment is cmux-first)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/.claude/skills/e2e-via-cmux/SKILL.md` (port of `/Users/luca/dev/winter-park/irene/.claude/skills/e2e-via-cmux/SKILL.md`, 209 lines)

**Interfaces:**
- Consumes: `scripts/playwright/auth-setup.mjs` + `.auth/app.json` (12.2); `scripts/qa/sql.mjs` (12.4); `sessions` schema (phase 5); template `e2e/helpers/cookies.ts` (session-cookie injection helper, template baseline).
- Produces: the `e2e-via-cmux` skill — manual E2E via cmux browser panes, carrying the React-controlled-input, Next 16 streaming-SSR/HMR, and DB-truth lessons.

**Steps:**

- [ ] Step: copy source — `cp /Users/luca/dev/winter-park/irene/.claude/skills/e2e-via-cmux/SKILL.md /Users/luca/dev/winter-park/template/.claude/skills/e2e-via-cmux/SKILL.md` (create the dir first: `mkdir -p /Users/luca/dev/winter-park/template/.claude/skills/e2e-via-cmux`)
- [ ] Step: apply generalization edits (line refs = irene source):
  1. Line 18: ` bun run dev   # run_in_background: true` → ` npm run dev   # run_in_background: true`
  2. Lines 22–25 (the auth-injection bullet list under "3. Inject an auth session — don't drive OTP through the UI:") — replace:
     ```
     - Mint a JWT with `lib/auth/jwt.ts`'s same secret (`AUTH_SECRET` from `.env`).
     - INSERT a matching `session` row (`user_id`, `jwt_token`, `expires_at`, `type='web'`, `force_deactivation=false`).
     - Set the `session_token` cookie:
     ```
     →
     ```
     - Easiest: `node scripts/playwright/auth-setup.mjs` (mints the JWT, INSERTs the `sessions` row, saves `.auth/app.json` — defaults to `owner@demo.invalid` from `scripts/seed-demo.mjs`), then extract the cookie value:
       `TOKEN=$(node -e 'const s=require("./.auth/app.json");console.log(s.cookies.find(c=>c.name==="session_token").value)')`
     - Manual alternative: mint a JWT mirroring `lib/auth/jwt.ts` (slim payload `{ userId }`, `AUTH_SECRET`) and INSERT a matching `sessions` row (`user_id`, `token`, `expires_at`).
     - Set the `session_token` cookie:
     ```
     (The `cmux browser ... cookies set` block that follows already targets `http://localhost:3000` in the irene source — keep it.)
  3. DELETE the whole section lines 68–82: heading `### Step navigation in AnimatedStep flows` through the closing fence after `[...document.querySelectorAll("button")].find(b => b.textContent.includes("Show details"))?.click()` — it is irene's salon POS SummaryBar flow (salon-specific; the generic lesson "prefer stable text-matched buttons over positional step indicators" is not worth a section without the concrete flow).
  4. Line 99 (DB-truth example): `psql $DATABASE_URL -c "SELECT id, total_amount, status FROM transaction WHERE salon_id=1 ORDER BY id DESC LIMIT 1;"` → `node scripts/qa/sql.mjs "SELECT id, email, name FROM persons ORDER BY id DESC LIMIT 5"`
  5. Line 107: `**Inspect joins**: don't just check the parent row — verify \`transaction_payment\`, \`transaction_product\`, etc.` → `**Inspect joins**: don't just check the parent row — verify the child rows too (e.g. a signup should create \`persons\` + \`users\` + a \`sessions\` row).`
  6. Lines 173–177 (inside "## Schema drift"): DELETE the historical list —
     ```
     Drift seen in this codebase historically:

     - `transaction_product`: schema had `name`, DB had `product_id`/`seller_id`/`seller_role`
     - `product`: schema had `description`, DB didn't (or vice versa)
     ```
     (keep the surrounding section: the symptom list, the `psql $DATABASE_URL -c "\d table_name"` cross-check, and the "Reconcile **toward the DB**" rule).
  7. Line 195: `(project already has \`e2e/helpers/auth.ts\` with session injection)` → `(the project's \`e2e/\` suite already has session-cookie helpers — see \`e2e/helpers/cookies.ts\`)`
- [ ] Step: verification — Run: `grep -rniE "irene|salon|:3001|jwt_token|type='web'|AnimatedStep|SummaryBar|transaction_product|bun run" .claude/skills/e2e-via-cmux/SKILL.md` → expected: no output, exit 1. Then: `grep -c "HTMLInputElement.prototype" .claude/skills/e2e-via-cmux/SKILL.md` → expected: `1` (React setter trick intact). Then: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add .claude/skills/e2e-via-cmux
  git commit -m "backport(qa): e2e-via-cmux skill (cmux-first manual E2E; template schema + auth-setup recipe)" -m "Dropped: salon POS step-navigation section, historical schema-drift ledger. Kept: React setter trick, Next 16 streaming/HMR gotchas, DB-truth protocol." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12.11: Skill — `.claude/skills/autonomous-build/{SKILL.md,orchestration.md,pitfalls.md}`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/.claude/skills/autonomous-build/SKILL.md` (port of `/Users/luca/dev/winter-park/irene/.claude/skills/autonomous-build/SKILL.md`, 53 lines)
- Create: `/Users/luca/dev/winter-park/template/.claude/skills/autonomous-build/orchestration.md` (port of irene's, 43 lines — near verbatim)
- Create: `/Users/luca/dev/winter-park/template/.claude/skills/autonomous-build/pitfalls.md` (rewrite of irene's, 37 lines — framework-generic entries only; full content below)

**Interfaces:**
- Consumes: `scripts/qa/visit.mjs` + `scripts/qa/sql.mjs` (12.4); `scripts/playwright/auth-setup.mjs` (12.2); `scripts/seed-demo.mjs` (12.1); phase 1 baseline-regen + `scripts/migrate.mjs` convention; `docs/design-tokens.md` (phase 2); `lib/effect/run-action.ts` `ActionResult` failure shape `{ success:false, error, kind, fieldErrors? }` (also the `BoundaryFailure` passed to `mapResult`'s `custom` hook); `lib/effect/boundary.ts` `mapResult` flattens it to `{ success:false, error }` (`FlatActionResult`) (phase 3); `lib/i18n/messages.ts` en/pt-BR TS enforcement (phase 4); Button `block`-default (phase 8).
- Produces: the `autonomous-build` skill (build→verify→commit loop + fleet orchestration + pitfalls ledger) for long autonomous runs on template-derived apps.

**Steps:**

- [ ] Step: copy sources —
  ```bash
  mkdir -p /Users/luca/dev/winter-park/template/.claude/skills/autonomous-build
  cp /Users/luca/dev/winter-park/irene/.claude/skills/autonomous-build/SKILL.md /Users/luca/dev/winter-park/template/.claude/skills/autonomous-build/SKILL.md
  cp /Users/luca/dev/winter-park/irene/.claude/skills/autonomous-build/orchestration.md /Users/luca/dev/winter-park/template/.claude/skills/autonomous-build/orchestration.md
  ```
  (pitfalls.md is a full rewrite — written below, not copied.)
- [ ] Step: apply generalization edits to `SKILL.md` (line refs = irene source):
  1. Line 6: `# Autonomous build (Irene)` → `# Autonomous build`
  2. Line 26: `` `npx tsc --noEmit 2>&1 | grep -v "import-from-source" | head` (filter only the known pre-existing ignore). `` → `` `npx tsc --noEmit` — the template baseline is clean; expect zero errors. ``
  3. Line 27: `` `node scripts/qa/visit.mjs --outdir tmp/qa/x /route...` `` stays (script ported in 12.4); no edit.
  4. Line 31 (the "Auth for verification" bullet) — replace:
     ```
     - **Auth for verification** — `E2E_USER_ID=<id> node scripts/playwright/auth-setup.mjs` mints a session into `.auth/irene.json` (owner=2, attendant=4, professional=5/7). `visit.mjs` uses it; `--no-auth` for public routes. Restore owner (E2E_USER_ID=2) when done.
     ```
     →
     ```
     - **Auth for verification** — `node scripts/playwright/auth-setup.mjs` mints a session into `.auth/app.json` (default target `owner@demo.invalid` from `scripts/seed-demo.mjs`; override with `E2E_USER_EMAIL`/`E2E_USER_ID`). `visit.mjs` uses it; `--no-auth` for public routes. Re-mint the default user when done verifying as someone else.
     ```
  5. Lines 47–53 (the whole `## Repo-specific truths` section) — replace with:
     ```markdown
     ## Repo-specific truths

     - Migrations: single regenerated baseline. Schema change → `rm -rf drizzle && npx drizzle-kit generate --name baseline`; `scripts/migrate.mjs` applies `./drizzle` forward-only at build (see `docs/schema.md`). See pitfalls.
     - Architecture is fixed: Flow Framework + Effect + RouteRegistry/CacheRegistry. Read `CLAUDE.md` and the relevant `docs/*.md` before building. Never change architecture during a feature/redesign sweep.
     - Visual work follows `docs/design-tokens.md` (tokens only — never raw hues).
     - Dev server is `:3000`. Don't start it yourself if it's already up; ask the user to run interactive commands via `! <cmd>`.
     ```
- [ ] Step: apply generalization edit to `orchestration.md` (single entanglement — the rest is generic fleet methodology):
  1. Line 3: `Lessons from migrating ~56 files and redesigning the whole app in this repo.` → `Lessons from ~56-file migration and whole-app redesign fleets on apps built from this template.`
  (Line 17's forbidden-shared-files list — `lib/i18n/messages.ts`, `components/ui/*`, `app/globals.css`, `tailwind.config.ts` — ports verbatim: all four are template shared files after phases 2/4/8.)
- [ ] Step: Write `/Users/luca/dev/winter-park/template/.claude/skills/autonomous-build/pitfalls.md` with exactly this content.
  **Dropped irene entries (enumerated — do NOT port):**
  (a) "`db:generate` is broken (stale `drizzle/meta`)" + the hand-written-migration/journal recipe — irene-only repo truth; contradicts the template's regenerated-baseline story (replaced by the baseline entry below);
  (b) the salon data-model entry ("a `salon_member` with role `professional` is not the same as a `professional` table row…") — salon-specific;
  (c) the 3-locale "(en / pt-BR / es)" i18n rule — template seeds 2 locales (adjusted below);
  (d) the `mapResult` sub-sentence "The `forbidden` copy key also catches `Unauthenticated`." — irene message-catalog specific;
  (e) the legacy-token mapping advice "Map to `bg-background` / `bg-card` / `bg-secondary` / `text-muted-foreground` / the accent tokens. (See `_design-system.md`.)" — re-pointed at `docs/design-tokens.md` with the template's triad/tone vocabulary.

  ````markdown
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
  ````

- [ ] Step: verification — Run: `grep -rniE "irene|salon|:3001|import-from-source|db:generate is broken|_design-system|_architecture-cheatsheet|professional" .claude/skills/autonomous-build/` → expected: no output, exit 1. Then: `grep -c "PLAN → BUILD → VERIFY" .claude/skills/autonomous-build/SKILL.md` → expected: `1` (loop intact). Then: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add .claude/skills/autonomous-build
  git commit -m "backport(qa): autonomous-build skill (loop + fleet orchestration + framework-generic pitfalls)" -m "Pitfalls dropped: irene db:generate workaround, salon data-model entry, es-locale rule, irene copy-key note. Added: template baseline-regen migration truth. Repo truths re-pointed at CLAUDE.md/docs, port 3000." -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12.12: Phase gate — cross-file consistency sweep (no new files)

**Files:** none created/modified (fix-forward only if a check fails).

**Interfaces:**
- Consumes: everything this phase produced.
- Produces: a verified, internally consistent QA suite; phase 13 takes over the live-run gate (seed → auth-setup → smoke → visit on a running server).

**Steps:**

- [ ] Step: de-irene sweep across the whole phase surface — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template
  grep -rniE "irene|salon|:3001|\.auth/irene" scripts/qa scripts/playwright scripts/seed-demo.mjs .mcp.json .claude/qa .claude/agents/app-navigation.md .claude/agents/browser-verifier-mcp.md .claude/agents/browser-verifier.md .claude/agents/qa-engineer.md .claude/agents/qa-ux.md .claude/skills/verify-in-browser .claude/skills/e2e-via-cmux .claude/skills/autonomous-build
  ```
  → expected: no output, exit 1.
- [ ] Step: identifier-consistency sweep — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template
  grep -rl "\.auth/app\.json" scripts/qa scripts/playwright .mcp.json .claude | sort
  grep -rn "app\.theme\.mode" scripts/qa/visit.mjs
  grep -rn "owner@demo.invalid" scripts/playwright/auth-setup.mjs scripts/seed-demo.mjs .claude/qa/README.md
  ```
  → expected: first grep lists ≥ 8 files (visit/interact/mobile/contrast, auth-setup/smoke, .mcp.json, and the agent/skill/charter docs); second and third greps each print ≥ 1 match. Any file missing from the first list is a bug — fix it to `.auth/app.json` before committing anything further.
- [ ] Step: syntax sweep — Run: `for f in scripts/seed-demo.mjs scripts/playwright/*.mjs scripts/qa/*.mjs; do node --check "$f" || exit 1; done && echo all-ok` → expected: `all-ok`, exit 0.
- [ ] Step: full gate — Run: `npx tsc --noEmit` → expected: exit 0. Run: `npx vitest run` → expected: exit 0 (phase 1's schema-invariants test still green; this phase added no tests). Run: `git status --porcelain` → expected: empty (everything committed by tasks 12.1–12.11).
- [ ] Step: live-run gate (only if a dev server + seeded scratch DB are available; otherwise phase 13 owns this) —
  ```bash
  cd /Users/luca/dev/winter-park/template
  node scripts/seed-demo.mjs
  node scripts/playwright/auth-setup.mjs
  node scripts/playwright/smoke.mjs
  node scripts/qa/visit.mjs --outdir tmp/qa/gate /dashboard /auth/identify
  ```
  → expected: all exit 0; smoke prints `OK — authenticated via saved state.`; visit JSON shows `/dashboard` with `httpStatus: 200`, `bouncedToAuth: false`. No commit for this step (artifacts are gitignored).
- [ ] Step: no commit needed if all checks pass (tasks committed individually). If any fix was required, commit it as:
  ```bash
  git add -A && git commit -m "backport(qa): phase 12 gate fixes (identifier consistency)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
