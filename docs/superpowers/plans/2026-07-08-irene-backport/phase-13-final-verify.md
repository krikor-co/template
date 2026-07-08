# Phase 13: Final Verification Gate — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Prove the whole backport is green end-to-end — types, lint, unit tests, production build + migration runner against a scratch Postgres, Storybook, seeded auth smoke, WCAG contrast, a manual browser pass of the full OTP login flow — then sweep for dead irene references, close the docs/CLAUDE.md accuracy loop, and land the final summary commit.

**Depends on phases:** all (1–12).

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE repo `/Users/luca/dev/winter-park/irene` is read-only reference — this phase never reads it except to compare a suspected regression.
- Identifiers that must hold everywhere by now: cookies `app.locale` / `app.tz`; auth cookies via `AUTH_*_COOKIE` constants in `lib/auth/identifier.ts`; localStorage theme key `app.theme.mode`; OTel serviceName from `OTEL_SERVICE_NAME`; dev port **3000**; Playwright storageState **`.auth/app.json`**; `E2E_VERIFY_PATH` default **`/dashboard`**; `DEFAULT_LOCALE 'en'`; `SUPPORTED_LOCALES ['en','pt-BR']`.
- Migration story: exactly one baseline migration in `./drizzle` (`drizzle/0000_baseline.sql` per phase 1's regen convention `rm -rf drizzle && npx drizzle-kit generate --name baseline`); runner `scripts/migrate.mjs` reads `./drizzle`, hydrates `DATABASE_URL` from `.env.local`/`.env` only when unset (explicit env always wins), exits 0 with a warning when no `DATABASE_URL`; `npm run build` = `node scripts/migrate.mjs && next build`.
- Design tokens: triads `--<slot>` / `--<slot>-soft` / `--<slot>-deep` / `--<slot>-foreground` for `brand|accent|info|success|warning|destructive`; tones `tone-urgent|attention|positive|info|neutral`; `shadow-card`/`shadow-card-lg`; HARD WCAG rule: text on a `-soft` surface uses `-deep` (≥ 4.5:1 body, ≥ 3:1 large).
- Copy: English defaults, no hardcoded pt-BR in code defaults.
- Verification gate: every task here IS the gate. Commits: every task ends with a git commit; pure-verification tasks record their result with `git commit --allow-empty`. All commit messages carry the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Failure protocol (applies to every step below):** when an expected output does not match, STOP the gate, use superpowers:systematic-debugging, identify the owning phase, apply the fix in the template, verify with that phase's own verification command, commit it as `fix(<area>): <what> [phase-13 gate]` + trailer, then re-run the failed gate step from its start. Never mark a gate step done on partial output.

## Shared gate environment (used by Tasks 13.1–13.6)

All runtime gates run against a **scratch Postgres** and a fixed env file at `/tmp/backport-gate/env.sh`. Nothing in `/tmp/backport-gate/` is ever committed. The scratch DB must be **empty** before Task 13.1 (the baseline SQL is not idempotent against a half-synced schema).

---

### Task 13.1: Scratch Postgres + migration-runner gate

**Files:** none created in the repo (env file + logs live in `/tmp/backport-gate/`). No repo modifications expected.

**Interfaces:**
- Consumes: `scripts/migrate.mjs` (phase 1 — node script, no args; env `DATABASE_URL`; applies unapplied `drizzle/*.sql` in filename order with `_migrations` bookkeeping; prints `[migrate] applied <file>` / `[migrate] done — <n> new, <t> total.`); `drizzle/0000_baseline.sql` (final baseline after phases 1/3/5/6/9/10 regens); `scripts/qa/sql.mjs` (phase 12 — `node scripts/qa/sql.mjs "<SQL>"`, prints `{ command, rowCount, rows }` JSON, reads `DATABASE_URL` from env first).
- Produces: running scratch DB `postgresql://scratch:scratch@localhost:54329/template_scratch` + `/tmp/backport-gate/env.sh`, consumed by Tasks 13.2–13.6.

**Steps:**

- [ ] Step: provision scratch Postgres — **docker recipe (primary)**:
  ```bash
  docker rm -f tpl-scratch-pg 2>/dev/null || true
  docker run --name tpl-scratch-pg \
    -e POSTGRES_USER=scratch -e POSTGRES_PASSWORD=scratch -e POSTGRES_DB=template_scratch \
    -p 54329:5432 -d postgres:16-alpine
  until docker exec tpl-scratch-pg pg_isready -U scratch -d template_scratch >/dev/null 2>&1; do sleep 1; done; echo READY
  ```
  → expected: final line `READY`.
  **Neon-branch recipe (alternative if docker is unavailable):** create a disposable branch and use its connection string as `DATABASE_URL` — `neonctl branches create --project-id <PROJECT_ID> --name backport-scratch` then `neonctl connection-string backport-scratch --project-id <PROJECT_ID>` (or the Neon MCP tools `create_branch` + `get_connection_string`). The branch's database must be **empty** — if the parent branch has tables, run `CREATE DATABASE template_scratch;` on the branch and append `/template_scratch` to the connection string. Requirement either way: empty, reachable, disposable Postgres 16+.
- [ ] Step: write the gate env file (fixed values — scratch-only secret, never reused elsewhere):
  ```bash
  mkdir -p /tmp/backport-gate
  cat > /tmp/backport-gate/env.sh <<'EOF'
  export DATABASE_URL='postgresql://scratch:scratch@localhost:54329/template_scratch'
  export AUTH_SECRET='backport-gate-scratch-secret-0123456789abcdef0123456789abcdef'
  export NEXT_PUBLIC_APP_URL='http://localhost:3000'
  export BASE_URL='http://localhost:3000'
  EOF
  ```
  (If using the Neon recipe, replace the `DATABASE_URL` line with the branch connection string.) → expected: file exists; `bash -n /tmp/backport-gate/env.sh` exits 0.
- [ ] Step: baseline shape check — Run: `ls /Users/luca/dev/winter-park/template/drizzle/*.sql` → expected: **exactly one** file, `drizzle/0000_baseline.sql`. More than one file or a different name means a schema-touching phase (1/3/5/6/9/10) skipped the regen convention — route back per the failure protocol.
- [ ] Step: apply migrations to the scratch DB — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && node scripts/migrate.mjs
  ```
  → expected: exit 0, output contains `[migrate] applied 0000_baseline.sql` and `[migrate] done — 1 new, 1 total.`
- [ ] Step: idempotence re-run — Run the same command again → expected: exit 0, output contains `[migrate] done — 0 new, 1 total.` (no re-apply).
- [ ] Step: schema truth check — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && \
  node scripts/qa/sql.mjs "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  ```
  → expected: rows include at minimum `_migrations`, `audit_log`, `feature_flag`, `otp_codes`, `persons`, `rate_limits`, `sessions`, `trace_span`, `users`, `workspace_members`, `workspace_pulse`, `workspaces` (+ `ai_call_log` if phase 10's AI port landed it; + billing tables if the phase-10 Stripe review passed). Any pinned table missing → failure protocol against the owning phase.
- [ ] Step: sessions regression check (spec: irene regressions must NOT port) — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && \
  node scripts/qa/sql.mjs "SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'sessions'::regclass ORDER BY conname"
  ```
  → expected: one `UNIQUE` constraint containing `(jwt_token)` AND one `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`. Either missing → failure protocol (phase 1/5).
- [ ] Step: commit gate record —
  ```
  cd /Users/luca/dev/winter-park/template
  git commit --allow-empty -m "chore(verify): 13.1 scratch-db migration gate green (baseline apply + idempotent re-run + schema truth)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 13.2: Static gate — tsc, ESLint, vitest

**Files:** none modified (fixes, if any, route back to owning phases per the failure protocol).

**Interfaces:**
- Consumes: `npm test` = `vitest run` (phase 1); `npm run lint` = `eslint .` (template baseline); the full ported codebase.
- Produces: static-gate green record consumed by Task 13.10's summary.

**Steps:**

- [ ] Step: types — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0, zero output. No error-filtering (`grep -v`) is permitted — irene's `import-from-source` filter must NOT exist here.
- [ ] Step: lint — Run: `cd /Users/luca/dev/winter-park/template && npm run lint` → expected: exit 0, no errors and no warnings printed.
- [ ] Step: unit tests — Run: `cd /Users/luca/dev/winter-park/template && npm test` → expected: exit 0, `0 failed`, and the suite includes at least the ported test files (`lib/time/zoned.test.ts` from phase 7 plus every `*.test.ts` phases 3–12 added). `--passWithNoTests` must NOT be needed — if vitest reports "No test files found", phases 3/7 did not land their tests → failure protocol.
- [ ] Step: commit gate record —
  ```
  cd /Users/luca/dev/winter-park/template
  git commit --allow-empty -m "chore(verify): 13.2 static gate green (tsc clean, eslint clean, vitest all pass)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 13.3: Production build (migrate + next build) and Storybook build

**Files:** none modified. Build artifacts (`.next/`, `storybook-static/`) are gitignored.

**Interfaces:**
- Consumes: `npm run build` = `node scripts/migrate.mjs && next build` (phase 1); `npm run build-storybook` = `storybook build` (template baseline); scratch DB from 13.1 (already migrated → runner must report 0 new).
- Produces: build-gate green record; `storybook-static/` for optional local inspection.

**Steps:**

- [ ] Step: production build against the scratch DB — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && npm run build
  ```
  → expected: exit 0; output begins with the runner (`[migrate] done — 0 new, 1 total.` — proves build-integrated migrations) followed by a successful Next.js production build (`✓ Compiled successfully` / route table printed, zero build errors). Prerender errors that mention a DB table → schema/query mismatch, failure protocol against the owning phase.
- [ ] Step: runner skip-mode check (build must never block on a missing DB) — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template && env -u DATABASE_URL node scripts/migrate.mjs
  ```
  → expected: exit 0 with the skip warning (`DATABASE_URL not set — skipping migrations`), **provided** no `.env.local`/`.env` supplies one (the runner hydrates from those when env is unset; if a dev `.env.local` exists, this step instead applies/no-ops against that dev DB — accept exit 0 and note it).
- [ ] Step: Storybook build — Run: `cd /Users/luca/dev/winter-park/template && npm run build-storybook` → expected: exit 0, `storybook-static/index.html` exists (`test -f storybook-static/index.html && echo OK` → `OK`). Story errors referencing old class names (`shadow-bento`, `label-mono`, `display-serif`, `kicker-mono`) → phase 2/8 rename missed → failure protocol.
- [ ] Step: repo hygiene — Run: `cd /Users/luca/dev/winter-park/template && git status --short` → expected: empty output (all build artifacts ignored). Any untracked artifact → add the missing ignore rule to `.gitignore`, commit as `fix(gitignore): ignore <artifact> [phase-13 gate]` + trailer.
- [ ] Step: commit gate record —
  ```
  cd /Users/luca/dev/winter-park/template
  git commit --allow-empty -m "chore(verify): 13.3 build gate green (migrate+next build on scratch db, storybook build)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 13.4: Seed-demo + Playwright auth-setup + smoke (authed /dashboard, zero console errors)

**Files:** none modified in the repo. Writes `/tmp/backport-gate/dev.log`, `/tmp/backport-gate/qa/*.png`, `.auth/app.json` (gitignored).

**Interfaces:**
- Consumes: `scripts/seed-demo.mjs` (phase 12 — idempotent, sentinel-scoped `@demo.invalid`, seeds auth + workspace tables incl. at least one user with a workspace membership; env `DATABASE_URL`); `scripts/playwright/auth-setup.mjs` (phase 12 — env `AUTH_SECRET`, `DATABASE_URL`, `BASE_URL` default `http://localhost:3000`, `E2E_USER_ID`, `E2E_VERIFY_PATH` default `/dashboard`; mints JWT + `sessions` row, saves `.auth/app.json`); `scripts/playwright/smoke.mjs` (phase 12 — opens `E2E_VERIFY_PATH`, exits 0 on authed); `scripts/qa/visit.mjs` (phase 12 — `node scripts/qa/visit.mjs [--dark] [--no-auth] [--width N] [--outdir D] <path>...`, JSON per route with `httpStatus`, `bouncedToAuth`, `consoleErrors`, `pageErrors`, `failedRequests`; `--dark` sets localStorage `app.theme.mode` and adds the `dark` class post-load); `npm run dev` (port 3000).
- Produces: running dev server (PID recorded in `/tmp/backport-gate/dev.pid`) + minted `.auth/app.json` + `DEMO_EMAIL`/`E2E_USER_ID` recorded in `/tmp/backport-gate/demo.env` — consumed by Tasks 13.5 and 13.6.

**Steps:**

- [ ] Step: seed — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && node scripts/seed-demo.mjs
  ```
  → expected: exit 0, summary of seeded rows. Run it a **second time** → expected: exit 0 (sentinel-scoped idempotence — no duplicate-key errors).
- [ ] Step: capture the demo identity — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && \
  node scripts/qa/sql.mjs "SELECT u.id, p.email FROM users u JOIN persons p ON p.id = u.person_id WHERE p.email LIKE '%@demo.invalid' ORDER BY u.id LIMIT 1"
  ```
  → expected: `rowCount: 1`. Write the values to the gate env:
  ```bash
  cat > /tmp/backport-gate/demo.env <<EOF
  export E2E_USER_ID=<id from the row>
  export DEMO_EMAIL='<email from the row>'
  EOF
  ```
- [ ] Step: membership truth (post-login dispatcher precondition) — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && source /tmp/backport-gate/demo.env && \
  node scripts/qa/sql.mjs "SELECT count(*) AS n FROM workspace_members WHERE user_id = ${E2E_USER_ID}"
  ```
  → expected: `n` ≥ 1 (the demo user must land on a role home, not onboarding). `n = 0` → seed-demo defect, failure protocol (phase 12).
- [ ] Step: ensure Playwright chromium is installed — Run: `cd /Users/luca/dev/winter-park/template && npx playwright install chromium` → expected: exit 0 (no-op if already installed). If `import 'playwright'` fails at any later step with MODULE_NOT_FOUND, phase 12 missed the dependency → failure protocol.
- [ ] Step: start the dev server on port 3000 with the gate env — first `lsof -ti :3000` → expected empty (kill any stray process otherwise), then:
  ```bash
  cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && \
  nohup npm run dev > /tmp/backport-gate/dev.log 2>&1 & echo $! > /tmp/backport-gate/dev.pid
  for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:3000 && break; sleep 1; done
  curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/auth/identify
  ```
  (agentic workers: prefer `run_in_background` over `nohup`) → expected: final line `200`.
- [ ] Step: mint the authed storageState — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && source /tmp/backport-gate/demo.env && \
  node scripts/playwright/auth-setup.mjs
  ```
  → expected: exit 0, output ends with the "authenticated state saved" line and the path `.auth/app.json`; the verify navigation targeted `/dashboard` (the `E2E_VERIFY_PATH` default) and did NOT bounce to `/auth`.
- [ ] Step: smoke — Run: `cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && node scripts/playwright/smoke.mjs` → expected: exit 0, `OK — authenticated via saved state.`
- [ ] Step: /dashboard zero-console-error gate (light) — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && \
  node scripts/qa/visit.mjs --outdir /tmp/backport-gate/qa /dashboard
  ```
  → expected JSON (single element): `"httpStatus": 200`, `"bouncedToAuth": false`, `"consoleErrors": []`, `"pageErrors": []`, `"failedRequests": []`, `"navError": null`. ANY console error is a gate failure — no allowlist.
- [ ] Step: /dashboard zero-console-error gate (dark) — Run the same with `--dark`:
  ```bash
  node scripts/qa/visit.mjs --dark --outdir /tmp/backport-gate/qa /dashboard
  ```
  → expected: same clean JSON.
- [ ] Step: read the evidence — Read `/tmp/backport-gate/qa/dashboard.png` and `/tmp/backport-gate/qa/dashboard-dark.png` (Read tool renders PNGs) → expected: a rendered, styled dashboard in both themes (not an error page, not an unstyled flash, dark actually dark).
- [ ] Step: commit gate record —
  ```
  cd /Users/luca/dev/winter-park/template
  git commit --allow-empty -m "chore(verify): 13.4 auth harness gate green (seed-demo idempotent, auth-setup, smoke, /dashboard 200 + zero console errors light+dark)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 13.5: WCAG contrast audit of the neutral palette (soft/deep pairs)

**Files:** Modify (only if failures found): `/Users/luca/dev/winter-park/template/app/globals.css` (token HSL values from phase 2 — triad `--<slot>-soft`/`--<slot>-deep` and tone `--tone-*-soft`/`--tone-*-deep` pairs).

**Interfaces:**
- Consumes: `scripts/qa/contrast.mjs` (phase 12 — `node scripts/qa/contrast.mjs </route> ...`; env `BASE_URL`; uses `.auth/app.json` unless the first route starts with `/auth`; prints `=== <route> — <n> fails ===` and one line per failing element with ratio/need/px/fg/bg/class); running dev server + `.auth/app.json` from 13.4; phase 2's palette in `app/globals.css`.
- Produces: contrast-gate green record; any palette corrections committed to `app/globals.css`.

**Steps:**

- [ ] Step: audit the unauthenticated auth surfaces (fresh context — first route starts with `/auth`) — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template && source /tmp/backport-gate/env.sh && \
  node scripts/qa/contrast.mjs /auth/identify /auth/verify /auth/register
  ```
  → expected: `— 0 fails` for every route.
- [ ] Step: audit the authenticated surfaces — Run:
  ```bash
  node scripts/qa/contrast.mjs /dashboard /
  ```
  (same shell, env still sourced) → expected: `— 0 fails` for both routes.
- [ ] Step: triage any failure — for each printed fail line:
  - class list contains a token class (`tone-*`, `*-soft`, `*-deep`, `bg-brand*`, `text-*-deep`, `.tone-surface-*`) → **blocker**: the phase-2 neutral palette violates its own hard rule. Fix by adjusting the offending CSS var in `app/globals.css` (darken the `-deep` ink or lighten the `-soft` surface: move the HSL lightness in ≤5% steps) until the re-run reports `0 fails`. Do not touch component classNames — the rule is enforced in token values.
  - failure also reproduces on `main` (`git show main:app/globals.css | grep -- '--<var>'` shows the identical value and the element exists pre-backport) → pre-existing template debt: record the fail line for the 13.10 summary body instead of fixing here.
- [ ] Step: verification after any fix — re-run both audit commands above → expected: `— 0 fails` on all five routes; then `npx tsc --noEmit` → exit 0 (unchanged, cheap safety).
- [ ] Step: commit —
  - if `app/globals.css` changed:
    ```
    cd /Users/luca/dev/winter-park/template
    git add app/globals.css
    git commit -m "fix(tokens): correct soft/deep contrast pairs flagged by qa/contrast gate [phase-13 gate]

    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
    ```
  - always, gate record:
    ```
    git commit --allow-empty -m "chore(verify): 13.5 contrast gate green (0 WCAG fails on /auth/*, /, /dashboard)

    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
    ```

---

### Task 13.6: Manual browser pass — identify → OTP (console-printed) → verify → dashboard (cmux), then teardown

**Files:** none modified. Uses the dev server + scratch DB from 13.4.

**Interfaces:**
- Consumes: dev server on `http://localhost:3000` logging to `/tmp/backport-gate/dev.log`; `DEMO_EMAIL` from `/tmp/backport-gate/demo.env`; phase 5's identify→verify flow (field name `identifier`, dev-mode OTP printed to the server console, segmented OtpInput) and phase 6's post-login dispatcher (1 membership → role home `/dashboard`); the **cmux-browser-automation skill** (`cmux browser` CLI — never Playwright for this task; this is deliberately a second, independent pair of eyes).
- Produces: manual-flow gate record; scratch infra torn down.

**Steps:**

- [ ] Step: invoke the `cmux-browser-automation` skill (BLOCKING — load it before driving the browser), then open `http://localhost:3000/auth/identify` → expected: identify page renders with **English** copy (phase 4 i18n defaults) and an input named `identifier`.
- [ ] Step: fill `identifier` with `$DEMO_EMAIL` (value from `/tmp/backport-gate/demo.env`) and submit the form → expected: navigation to `/auth/verify` (existing user goes to verify, not register).
- [ ] Step: read the console-printed dev OTP — Run: `grep -inE 'otp|code' /tmp/backport-gate/dev.log | tail -5` → expected: a line from phase 5's dev-mode OTP print containing a 6-digit code for `$DEMO_EMAIL`; take the most recent 6-digit code. No such line → phase 5's dev OTP print is missing → failure protocol.
- [ ] Step: enter the 6 digits into the segmented OtpInput (it autofocuses; type the six digits sequentially) and submit if not auto-submitted → expected: authenticated redirect; final URL path is `/dashboard` (single-membership demo user → role home). Landing on onboarding/picker instead → dispatcher or seed defect → failure protocol (phase 6 / 12).
- [ ] Step: read the browser console via cmux on the landed dashboard → expected: **zero** console errors (warnings noted but not blocking). Take a screenshot and read it → rendered dashboard identical in substance to 13.4's Playwright capture.
- [ ] Step: teardown the gate runtime —
  ```bash
  kill "$(cat /tmp/backport-gate/dev.pid)" 2>/dev/null || true
  lsof -ti :3000 | xargs kill 2>/dev/null || true
  docker rm -f tpl-scratch-pg 2>/dev/null || true   # neon alternative: delete the scratch branch
  rm -rf /Users/luca/dev/winter-park/template/tmp    # QA scratch artifacts, if any script wrote repo-relative
  ```
  → expected: `lsof -ti :3000` empty; `git -C /Users/luca/dev/winter-park/template status --short` shows no `tmp/` entries.
- [ ] Step: commit gate record —
  ```
  cd /Users/luca/dev/winter-park/template
  git commit --allow-empty -m "chore(verify): 13.6 manual browser gate green (identify -> console OTP -> verify -> /dashboard, zero console errors, via cmux)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 13.7: .env.example completeness vs every `process.env` reference

**Files:**
- Modify (only if gaps found): `/Users/luca/dev/winter-park/template/.env.example` (phase 1's grouped runbook, appended by phase 3 with `OTEL_SERVICE_NAME`).

**Interfaces:**
- Consumes: phase 1's `.env.example` runbook format (grouped by integration, inline setup comments, `VAR=` lines at column 0).
- Produces: complete `.env.example`; the allowlist below is the documented set of intentionally-undocumented vars.

**Steps:**

- [ ] Step: extract every env var the code reads (the grep recipe — dot and bracket access):
  ```bash
  cd /Users/luca/dev/winter-park/template
  mkdir -p /tmp/backport-gate
  { grep -rhoE 'process\.env\.[A-Z][A-Z0-9_]*' \
      app components lib db scripts e2e tools middleware.ts next.config.ts \
      drizzle.config.ts instrumentation.ts vitest.config.ts playwright.config.ts .storybook \
      2>/dev/null | sed 's/^process\.env\.//' ; \
    grep -rhoE "process\.env\[['\"][A-Z][A-Z0-9_]*['\"]\]" \
      app components lib db scripts 2>/dev/null | grep -oE '[A-Z][A-Z0-9_]*' ; } \
    | sort -u > /tmp/backport-gate/env-used.txt
  grep -oE '^[A-Z][A-Z0-9_]*' .env.example | sort -u > /tmp/backport-gate/env-doc.txt
  ```
  → expected: both files non-empty (`env-doc.txt` has ≥ 17 lines: phase 1's 16 vars + `OTEL_SERVICE_NAME` from phase 3).
- [ ] Step: write the allowlist (vars that are framework/runtime/test-harness — never documented in `.env.example`):
  ```bash
  cat > /tmp/backport-gate/env-allow.txt <<'EOF'
  BASE_URL
  CI
  E2E_USER_EMAIL
  E2E_USER_ID
  E2E_VERIFY_PATH
  NEXT_PHASE
  NEXT_RUNTIME
  NODE_ENV
  PORT
  VERCEL
  VERCEL_ENV
  VERCEL_URL
  EOF
  ```
- [ ] Step: completeness diff — Run:
  ```bash
  comm -23 /tmp/backport-gate/env-used.txt /tmp/backport-gate/env-doc.txt | grep -vxFf /tmp/backport-gate/env-allow.txt
  ```
  → expected: **empty**. The two known `process.env` reads outside `.env.example` are `APP_BASE_DOMAIN` (phase 6's host resolver reads it; phase 6 does not touch `.env.example`) and `E2E_USER_EMAIL` (phase 12's `scripts/playwright/auth-setup.mjs` reads it) — `E2E_USER_EMAIL` is test-harness-only and already covered by the allowlist above, so it must NOT appear in this diff and must NOT be appended to `.env.example`. If `APP_BASE_DOMAIN` appears, append to `.env.example` (end of the feature-gated section):
  ```

  # ── Multi-tenancy host resolution (feature-gated) ────────────────────
  # Base domain for subdomain→workspace resolution in middleware.ts
  # (acme.<APP_BASE_DOMAIN> → workspace "acme"). Defaults to "localhost",
  # so <slug>.localhost:3000 works in dev with no config.
  APP_BASE_DOMAIN=
  ```
  Any other var found: append it to `.env.example` inside its integration's existing group (create a group header in the same `# ── <Name> ──` style if none fits) with a one-line comment saying which module reads it and whether it is feature-gated. Truly internal vars (test-only, CI-only) go into the allowlist above instead — but then must be named in this plan step's commit body.
- [ ] Step: reverse diff (documented but never read) — Run: `comm -13 /tmp/backport-gate/env-used.txt /tmp/backport-gate/env-doc.txt` → expected: empty. Each hit means a phase documented a var but never ported the consuming code (e.g. `VERCEL_TEAM_ID` without `lib/vercel/domains.ts`) — verify the owning phase landed its code; if the code was consciously not ported (e.g. Stripe review failed), delete the var's block from `.env.example`.
- [ ] Step: verification — re-run both `comm` commands → expected: both empty. Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  - if `.env.example` changed:
    ```
    cd /Users/luca/dev/winter-park/template
    git add .env.example
    git commit -m "docs(env): close .env.example gaps found by process.env completeness sweep

    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
    ```
  - otherwise gate record: `git commit --allow-empty -m "chore(verify): 13.7 .env.example completeness gate green" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"`

---

### Task 13.8: Dead-reference sweep (salon / irene / terracotta / sage / bento / 3001)

**Files:** Modify: any file a true hit lands in (fix in place per the pinned naming constraints). Expected: none.

**Interfaces:**
- Consumes: pinned replacements — salon→workspace, `irene.locale`→`app.locale`, `irene.theme.mode`→`app.theme.mode`, terracotta/sage→neutral token slots, `shadow-bento`→`shadow-card`, port 3001→3000, `.auth/irene.json`→`.auth/app.json`.
- Produces: a template with zero irene-isms outside `docs/superpowers/`.

**Steps:**

- [ ] Step: the sweep — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template
  grep -rniE '\bsalon|\birene|terracotta|\bsage\b|\bbento\b|\b3001\b|fraunces|jetbrains' . \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
    --exclude-dir=storybook-static --exclude-dir=superpowers --exclude-dir=.auth \
    --exclude-dir=.playwright-mcp --exclude-dir=tmp --exclude-dir=test-results \
    --exclude-dir=playwright-report --exclude=package-lock.json
  ```
  → expected: **no output, exit 1**. (`--exclude-dir=superpowers` is what grants `docs/superpowers/` its exemption — plans/specs legitimately name irene. `\b` guards keep `message`/`usage` from matching `sage`, and hex/id substrings from matching `3001`.)
- [ ] Step: triage — for every hit: it is a true dead reference unless it is (a) inside `docs/superpowers/` (impossible given the exclude — re-check your cwd), or (b) a provably coincidental substring inside a generated artifact (`drizzle/meta/*.json` hash ids — verify by eye). Fix every true hit in place with the pinned replacement above; a hit with no pinned replacement (e.g. prose mentioning irene in a doc) is rewritten to template-generic wording. Enumerate each fixed `file:line old→new` in the commit body.
- [ ] Step: residue sweep for retired irene mechanisms — Run:
  ```bash
  grep -rn "EFFECT_DISABLE\|shadow-bento\|label-mono\|display-serif\|kicker-mono\|session_token" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=storybook-static \
    --exclude-dir=superpowers --exclude=package-lock.json .
  ```
  → expected: no output for the first five patterns; `session_token` hits are acceptable **only** if that is the value the phase-5 `AUTH_*_COOKIE` constant exports (a hit inside `lib/auth/identifier.ts` defining the constant is fine; raw string literals elsewhere are not — replace with the constant import).
- [ ] Step: verification after any fix — Run: `npx tsc --noEmit` → exit 0; `npm test` → 0 failed; re-run both sweep greps → no output.
- [ ] Step: commit —
  - if files changed:
    ```
    cd /Users/luca/dev/winter-park/template
    git add -A
    git commit -m "fix(sweep): remove dead irene references caught by final grep sweep

    <file:line old→new list>

    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
    ```
  - otherwise gate record: `git commit --allow-empty -m "chore(verify): 13.8 dead-reference sweep green (zero irene-isms outside docs/superpowers)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"`

---

### Task 13.9: CLAUDE.md + docs index accuracy pass

**Files:**
- Modify (only where the checks below find drift): `/Users/luca/dev/winter-park/template/CLAUDE.md` (doc table, invariants, skills block), `/Users/luca/dev/winter-park/template/docs/overview.md` (reading order — anchor on its section headings, offsets shifted by phase 1), any `docs/*.md` missing frontmatter.

**Interfaces:**
- Consumes: `lib/docs.ts` contract — the `/docs` site lists every `docs/*.md` (non-recursive, so `docs/superpowers/` is invisible to it) sorted by frontmatter `order` within `category`; each doc needs `---\ntitle: …\norder: …\ncategory: …\n---`.
- Produces: CLAUDE.md doc table ⇄ `docs/*.md` ⇄ `docs/overview.md` all in sync; CLAUDE.md invariants verified against real exports.

**Steps:**

- [ ] Step: doc-table sync check — Run:
  ```bash
  cd /Users/luca/dev/winter-park/template
  ls docs/*.md | xargs -n1 basename | sed 's/\.md$//' | sort > /tmp/backport-gate/docs-have.txt
  grep -oE '\]\(docs/[a-z0-9-]+\.md\)' CLAUDE.md | sed 's|](docs/||; s|\.md)||' | sort -u > /tmp/backport-gate/docs-listed.txt
  comm -3 /tmp/backport-gate/docs-have.txt /tmp/backport-gate/docs-listed.txt
  ```
  → expected: empty. For each doc **present on disk but missing from CLAUDE.md** (new docs from this backport: at least `design-tokens`, `cron`, `capabilities`, `links`, `flow-params`, plus any phase 3/11/12 additions): add a row to CLAUDE.md's doc table, `| [\`<slug>.md\`](docs/<slug>.md) | <frontmatter title> — <one-line summary taken from the doc's first paragraph> |`. For each **listed but missing on disk**: the owning phase failed to write it → failure protocol.
- [ ] Step: frontmatter check (docs site renders every file) — Run:
  ```bash
  for f in docs/*.md; do head -1 "$f" | grep -q '^---$' || echo "MISSING FRONTMATTER: $f"; done
  ```
  → expected: no output. Fix any hit by prepending frontmatter matching its siblings: `---`, `title: <Doc Title>`, `order: <next free number within its category>`, `category: <same category as its nearest sibling doc>`, `---`.
- [ ] Step: overview reading-order check — for every slug in `/tmp/backport-gate/docs-have.txt`, run `grep -c "<slug>" docs/overview.md`; → expected: ≥ 1 for each. Add any missing doc to `docs/overview.md`'s reading-order/table section (anchor on the section heading that lists the docs — do not use line numbers; phase 1 shifted offsets) using the same list/table style as its neighbors.
- [ ] Step: invariant reality check — every name CLAUDE.md's invariants reference must exist in code. Run each and require ≥ 1 hit:
  ```bash
  grep -rn "runAction"            lib/effect/run-action.ts | head -1
  grep -rn "runQuery"             lib/effect/run-query.ts  | head -1
  grep -rn "mapResult"            lib/effect/boundary.ts   | head -1
  grep -rn "withCacheProfile"     lib/ --include='*.ts'    | head -1
  grep -rn "requireWorkspaceRoleE" lib/ app/ --include='*.ts' | head -1
  grep -rn "requireSession"       app/ lib/ --include='*.ts' | head -1
  grep -rn "SubscriptionInactive" lib/effect/errors.ts     | head -1
  grep -rn "export"               lib/theme/tone.ts        | head -1
  grep -rn "AUTH_"                lib/auth/identifier.ts   | head -1
  ```
  → expected: one hit line each. A miss means CLAUDE.md documents a name that does not exist (or a phase renamed without updating CLAUDE.md) — reconcile in favor of the pinned constraint names, editing whichever side diverged, and note it in the commit body.
- [ ] Step: skills/agents listing check — Run: `ls .claude/skills .claude/agents 2>/dev/null` and compare against CLAUDE.md's "Available skills" block and any agent references. Every phase-12 skill (`verify-in-browser`, `autonomous-build`, `e2e-via-cmux`) and agent (`browser-verifier-mcp`, `qa-engineer`, `qa-ux`) that CLAUDE.md or docs reference must exist on disk, and vice versa where CLAUDE.md promises a listing. Fix drift on the CLAUDE.md side (the files on disk are the truth).
- [ ] Step: verification — re-run the doc-table `comm` (empty), the frontmatter loop (silent), and `npx tsc --noEmit` (exit 0).
- [ ] Step: commit —
  - if files changed:
    ```
    cd /Users/luca/dev/winter-park/template
    git add CLAUDE.md docs/
    git commit -m "docs: sync CLAUDE.md doc table, overview reading order, and frontmatter with final backport state

    Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
    ```
  - otherwise gate record: `git commit --allow-empty -m "chore(verify): 13.9 docs/CLAUDE.md accuracy gate green" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"`

---

### Task 13.10: Squash-review checklist + final summary commit

**Files:** none modified (final commit is `--allow-empty` with the gate report in its body).

**Interfaces:**
- Consumes: every gate record from 13.1–13.9; the full branch history `main..backport/irene-2026-07`.
- Produces: final summary commit `chore(backport): irene→template backport complete — final verification gate green` (branch tip). Merge/squash into `main` is explicitly NOT performed here — that decision belongs to the user (see superpowers:finishing-a-development-branch).

**Steps:**

- [ ] Step: closing re-verify (the sweeps in 13.7–13.9 may have touched files after the runtime gates) — Run, in order: `npx tsc --noEmit` → exit 0; `npm test` → 0 failed; `npm run lint` → exit 0; `git status --short` → empty.
- [ ] Step: branch shape review — Run: `git log --oneline main..HEAD | wc -l` → expected: > 0 (record the count N); `git diff --stat main..HEAD | tail -1` → record the summary line; `git log --oneline main..HEAD | grep -cE '^\S+ (feat|fix|chore|docs|test)'` → expected: equals N (every commit uses a conventional prefix).
- [ ] Step: squash-review checklist — verify each item and record PASS/FAIL; any FAIL blocks the summary commit until resolved via the failure protocol:
  - [ ] No unchecked `- [ ]` steps remain in `docs/superpowers/plans/2026-07-08-irene-backport/phase-01` … `phase-12` files (run `grep -ch '^- \[ \]' docs/superpowers/plans/2026-07-08-irene-backport/phase-0*.md docs/superpowers/plans/2026-07-08-irene-backport/phase-1[0-2]*.md | paste -sd+ - | bc` from the repo root; expected 0 — skip this check if the executing workflow does not tick boxes, and note that in the summary).
  - [ ] Gates 13.1–13.9 all have their `chore(verify)`/fix commits in `git log main..HEAD`.
  - [ ] `main` is untouched: `git log --oneline -1 main` shows the same commit as before the backport started.
  - [ ] Working tree clean, no stray `.auth/`, `tmp/`, `*.png` tracked: `git status --short` empty.
  - [ ] Scratch infra gone: `docker ps -a --filter name=tpl-scratch-pg --format '{{.Names}}'` → empty; `lsof -ti :3000` → empty.
- [ ] Step: final summary commit — Run:
  ```
  cd /Users/luca/dev/winter-park/template
  git commit --allow-empty -m "chore(backport): irene→template backport complete — final verification gate green" \
    -m "Gate results:
  - tsc --noEmit: clean
  - eslint: clean
  - vitest run: all green
  - next build (node scripts/migrate.mjs && next build) vs scratch Postgres: pass (baseline apply + idempotent re-run)
  - storybook build: pass
  - seed-demo + playwright auth-setup + smoke: /dashboard authed 200, zero console errors (light + dark)
  - qa/contrast.mjs on /auth/*, /, /dashboard: 0 WCAG fails
  - manual cmux pass: identify -> console OTP -> verify -> /dashboard, zero console errors
  - .env.example completeness: in sync with process.env references
  - dead-reference sweep (salon|irene|terracotta|sage|bento|3001): zero hits outside docs/superpowers/
  - CLAUDE.md + docs index: in sync

  Branch: <N> commits, <diff --stat summary line>.
  Pre-existing (non-backport) findings deferred: <list from 13.5 triage, or 'none'>." \
    -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```
  (Fill `<N>`, the diff-stat line, and the deferred list with the values recorded above.) → expected: commit created on `backport/irene-2026-07`.
- [ ] Step: hand off — report to the user: the branch is verified and ready; recommend squash-merge to `main` given the `chore(verify)` gate records, but do NOT merge, rebase, or push without an explicit user instruction.
