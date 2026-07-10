# Irene → Template Backport — Implementation Plan (Index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute phase files in dependency order; tasks within a phase are sequential.

**Goal:** Port every non-salon-specific improvement from irene into the template so it seeds future projects — per the approved spec at `docs/superpowers/specs/2026-07-08-irene-backport-design.md`.

**Architecture:** Thirteen dependency-ordered phases on branch `backport/irene-2026-07`. Foundation layers land first (DB substrate, design tokens, Effect boundary, i18n, auth, tenancy/flags), then primitives and components, then integrations, then app patterns and the QA/agent suite, closing with a full verification gate. Each task is a small port-generalize-verify-commit cycle; irene source files are the reference implementation, the template's conventions win on every conflict.

**Tech Stack:** Next.js 16 (Cache Components), React 19, Drizzle + Postgres, Effect + OpenTelemetry, Tailwind, Storybook, Vitest (`.test.ts`) + Playwright (`.spec.ts`), Resend, Twilio (env-gated), Vercel Blob, Stripe (post-review), `ai`.

## Global Constraints

Every task in every phase file implicitly includes these. Exact values — do not improvise alternates.

- Repos: template `/Users/luca/dev/winter-park/template` (work here, branch `backport/irene-2026-07`); irene `/Users/luca/dev/winter-park/irene` (read-only reference).
- Table naming: template plural stays (`users`, `persons`, `sessions`, `otp_codes`). New tables: `workspaces`, `workspace_members` (roles seeded `'owner' | 'member'`), `feature_flag`, `audit_log`, `trace_span`, `workspace_pulse`, `ai_call_log`.
- Tenant concept is `workspace` everywhere irene says salon. Guards: `requireSession`, `requireAdmin`, `requireWorkspaceRole(workspaceId, role)`; Effect adapters `requireSessionE`, `requireAdminE`, `requireWorkspaceRoleE`; error classes `SessionGuardError`, `AdminGuardError`, `WorkspaceGuardError` with `reason: 'unauthenticated' | 'forbidden'`.
- Design tokens: accent slots `brand`, `accent`, `info`, `success`, `warning`, `destructive`, each a 4-role triad `--<slot>` / `--<slot>-soft` / `--<slot>-deep` / `--<slot>-foreground`; tone scale `tone-urgent`, `tone-attention`, `tone-positive`, `tone-info`, `tone-neutral`; `shadow-bento` → `shadow-card`; fonts keep the `--font-display`/`--font-kicker` aliasing pattern pointed at template fonts. Neutral placeholder hues; soft surfaces always pair with `-deep` text (WCAG rule).
- Copy: English defaults; user-facing copy via props or `lib/i18n` messages; `pt-BR` is the second seed locale. No hardcoded pt-BR defaults in code.
- Identifiers: cookies `app.locale` / `app.tz`; auth cookies via `AUTH_*_COOKIE` constants; localStorage theme key `app.theme.mode`; OTel serviceName from `OTEL_SERVICE_NAME` env with package-name fallback; dev port 3000; Playwright storageState `.auth/app.json`; `E2E_VERIFY_PATH` default `/dashboard`; `DEFAULT_LOCALE = 'en'`; `SUPPORTED_LOCALES = ['en', 'pt-BR']`.
- Effect is canonical: Effect-based irene code stays Effect-based. Names: `runAction`, `runQuery`, `mapResult`, `dbE`, `validate`, `parseIdE`, `withCacheProfile`. Error union: `Forbidden`, `Unauthenticated`, `NotFound`, `ValidationFailed`, `RateLimited`, `Conflict`, `ExternalServiceError`, `DbError`, `Timeout`, `SubscriptionInactive({ workspaceId })`.
- Irene regressions do NOT port: `sessions` keeps `unique()` on `token` and `onDelete: cascade`.
- Migrations: template has only baseline `0000` — schema changes regenerate the baseline; runner `scripts/migrate.mjs` reads `./drizzle`.
- Docs travel with code; stories port with their components.
- Every task ends with `npx tsc --noEmit` clean (plus task-appropriate checks) and a commit with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Commit granularity — deliberate refinement of the spec: the spec's verification section says "each phase lands as its own commit on branch `backport/irene-2026-07`"; this plan supersedes that wording with task-level commits (finer-grained, bisectable, reviewable). No per-phase squash is performed; the squash/merge decision is deferred to the user at Task 13.10 (superpowers:finishing-a-development-branch). `main` stays untouched until the user decides, exactly as the spec requires.

## Phases

| # | File | Depends on | Scope |
|---|------|-----------|-------|
| 1 | `phase-01-substrate.md` | — | deps, vitest, .gitignore, .env.example, next.config DX, DB hardening, migration runner |
| 2 | `phase-02-tokens.md` | 1 | triad + tone token architecture, neutral palette, safelist, font strategy, docs |
| 3 | `phase-03-effect.md` | 1 | lib/effect boundary, trace_span, cache profiles, Effect docs + worked example |
| 4 | `phase-04-i18n-theme.md` | 1, 3 | i18n stack, timezone providers, ThemeProvider, root-layout wiring, viewport |
| 5 | `phase-05-auth.md` | 1, 3, 4 | dual email+phone OTP, auth bugfixes, OtpInput, VerifySuccess, e2e updates |
| 6 | `phase-06-tenancy-flags.md` | 1, 3, 5 | workspaces/members, dispatcher, invites, host→tenant middleware, Vercel Domains, feature flags |
| 7 | `phase-07-lib-shell.md` | 2 | useScrollLock, Drawer/Modal upgrades, zoned time, CSV, normalize, nav-state primitives, links docs |
| 8 | `phase-08-components.md` | 2, 4, 7 | Button CVA, form kit, Toast, ConfirmDialog, DatePicker, charts, editorial catalog, Money/PhoneInput, WidgetRefresh, stories |
| 9 | `phase-09-integrations.md` | 3, 6; 7 (task 9.13); 8 (tasks 9.5–9.6) | Vercel Blob story, realtime pulse, cron convention + kernels |
| 10 | `phase-10-stripe-ai.md` | 3, 6; 4 (tasks 10.5–10.8); 2, 8 (tasks 10.6–10.8, 10.14–10.15) | Stripe diff-review stage → conditional billing port; capability registry, AI widgets, ai_call_log |
| 11 | `phase-11-app-patterns.md` | 3, 4, 6 | Suspense guard shells, guard/gate-topology docs, /docs gating, pagination convention, docs sweep |
| 12 | `phase-12-qa-claude.md` | 1, 5, 6 | Playwright pre-auth harness, QA auditors, seed skeleton, .claude agents/skills, app-navigation map |
| 13 | `phase-13-final-verify.md` | all | full gate: tsc/lint/vitest/build+migrate/storybook/smoke/browser pass, dead-reference sweep |

Parallelization note for orchestrators: {2, 3} may run in parallel after 1; {4, 7} after their deps; 8 needs 2+4+7; 11 after 6; {9, 10} only after BOTH 6 and 8 (they consume phase-7/8 outputs mid-phase — see the dependency column; dispatching them alongside 7/8 hits their internal dependency-gate STOPs); 12 after 6; 13 strictly last. Phases touching `db/schema` (1, 3, 5, 6, 9, 10) serialize the baseline-migration regeneration step.
