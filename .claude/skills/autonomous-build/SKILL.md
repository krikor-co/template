---
name: autonomous-build
description: Use when running a long autonomous build/refactor/redesign session in this repo (multi-feature builds, mass migrations, whole-app redesigns, overnight runs) — especially when fanning work out to subagents/workflows. Encodes the build→verify→commit loop, independent-verification discipline, fleet orchestration, and the repo's hard-won pitfalls so the same mistakes aren't relearned each time.
---

# Autonomous build

How to run effective autonomous agentic programming here: ship large amounts of *verified* work without babysitting, and without relearning the same traps. Read [`pitfalls.md`](pitfalls.md) before you start and [`orchestration.md`](orchestration.md) before fanning out to a fleet.

## The loop (never skip a step)

```
PLAN → BUILD → VERIFY (independently, with real truth) → COMMIT → repeat
```

1. **PLAN** — keep a durable tracker at `.claude/specs/_<name>-progress.md`. Write the goal, the decisions the user made (convert relative dates to absolute), the task list with `[ ]/[x]`, and gotchas. Update it after **every** verified step — it survives context compaction and is how you resume.
2. **BUILD** — do it yourself, or dispatch agents (see orchestration). Serial when work shares files; parallel when folders are disjoint.
3. **VERIFY** — the part that makes autonomy trustworthy. See below. **Nothing is "done" on an agent's say-so.**
4. **COMMIT** — one verified unit per commit, descriptive body, on a feature branch (never commit unverified work; never push unless asked). Then update the progress doc.

## Verification discipline (the heart of it)

Agents and your own edits both lie by omission. Verify with ground truth, not self-reports:

- **`tsc` is the strongest signal** after any multi-file or agent edit. Run the *full* check — it catches broken imports/props/types across every file at once:
  `npx tsc --noEmit` — the template baseline is clean; expect zero errors.
- **Real eyes, not "it should render"** — `node scripts/qa/visit.mjs --outdir tmp/qa/x /route...` returns HTTP status + console errors and writes screenshots. The bar is **HTTP 200 + 0 console errors**. Then **Read the PNG** and actually look — a page can be 200/0-errors and still be visually broken.
- **DB truth, not UI claims** — after a mutation, assert it persisted: `node scripts/qa/sql.mjs "SELECT ..."`. "The button showed success" ≠ "the row changed." Drive the real flow (fill inputs, click) when behavior matters, then check the DB.
- **NEW vs pre-existing lint** — don't chase errors you didn't cause. Compare against HEAD:
  `git show HEAD:<file> | npx eslint --stdin --stdin-filename <file>`. If the same errors exist at HEAD, they're pre-existing — note and move on.
- **Auth for verification** — `node scripts/playwright/auth-setup.mjs` mints a session into `.auth/app.json` (default target `owner@demo.invalid` from `scripts/seed-demo.mjs`; override with `E2E_USER_EMAIL`/`E2E_USER_ID`). `visit.mjs` uses it; `--no-auth` for public routes. Re-mint the default user when done verifying as someone else.

If verification fails, fix before moving on. A green `tsc` + clean screenshots + a confirming DB row is the difference between "I think it works" and "it works."

## Resilience

- **Agent cut / rate-limited mid-task** — assess partial state (`git status`, `git diff --stat`, `tsc`), then re-dispatch a *finisher* with the precise remaining scope. Don't restart from scratch.
- **Incomplete refactor breaking the build** — revert just that file to HEAD (`git checkout HEAD -- <file>` or delete a half-written new file), keep everything else, get back to green, then redo it cleanly.
- **Stale dev server** — after deleting files or changing tokens/tailwind, `rm -rf .next` (or `.next/cache`) and let it rebuild; Tailwind's incremental cache chokes on deleted files.
- **HMR lag** — right after editing, the dev server may still serve old code; a verification that "fails" seconds after an edit is often stale — retest.

## When to orchestrate vs. do it yourself

- **Yourself**: correctness-critical or security-sensitive code (auth, money, migrations, the design-system foundation), and anything where one wrong call cascades. Build the foundation others depend on.
- **Fleet (Workflow)**: large, parallelizable, mechanical-ish sweeps over many disjoint files (migrations, redesigns, audits). Always after the shared foundation exists. See [`orchestration.md`](orchestration.md).

## Repo-specific truths

- Migrations: single regenerated baseline. Schema change → `rm -rf drizzle && npx drizzle-kit generate --name baseline`; `scripts/migrate.mjs` applies `./drizzle` forward-only at build (see `docs/schema.md`). See pitfalls.
- Architecture is fixed: Flow Framework + Effect + RouteRegistry/CacheRegistry. Read `CLAUDE.md` and the relevant `docs/*.md` before building. Never change architecture during a feature/redesign sweep.
- Visual work follows `docs/design-tokens.md` (tokens only — never raw hues).
- Dev server is `:3000`. Don't start it yourself if it's already up; ask the user to run interactive commands via `! <cmd>`.
