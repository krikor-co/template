# Irene → Template Backport — Design Spec

**Date:** 2026-07-08
**Goal:** Pull every improvement made during the irene build that is not specific to irene's product (salon management) back into the template, so the template remains the bedrock for new projects. Salon-domain code stays in irene; everything else — integrations, patterns, primitives, docs, skills, agents, tooling — ports here, generalized.

Source of truth for the delta: 92-agent comparison run (2026-07-08), 91 findings across 8 subsystems, each candidate adversarially verified for salon entanglement. This spec is the approved scope.

## Approved decisions

| Decision | Choice |
|---|---|
| Scope | Maximal: everything generalizable ports; only salon-domain code excluded |
| Effect server boundary | **Adopt** as the canonical action/query pattern |
| Design tokens | **Adopt** triad + semantic tone scale with a brand-neutral placeholder palette |
| i18n | **Adopt** (zero-dep stack, seeded with `en` + `pt-BR`) |
| Auth | **Adopt** dual email+phone OTP (Twilio feature-flagged via env presence) |
| Multi-tenancy | **Adopt** host→tenant middleware + workspace/membership substrate + invites |
| Feature flags | **Adopt** registry + 3-level resolution + `feature_flag` table |
| Billing (Stripe) | **Port after a dedicated diff-review stage** (only unreviewed area) |
| AI stack | **Adopt generalized** capability registry, tools-from-capabilities, AI widgets, `ai_call_log` |

## Generalization rules (apply to every port)

1. **Naming:** template's plural table names stay (`users`, `persons`, `sessions`, `otps`); ported SQL/schema adapts. Tenant concept is `workspace` / `workspace_member` (roles seeded `owner | member`, documented as an app-extensible union).
2. **Theme:** irene brand tokens (terracotta/sage/honey/charcoal, `shadow-bento`, `rounded-full`, serif display fonts) → neutral placeholder palette using the same triad/tone mechanics. The swap procedure is documented; components reference tokens, never hues.
3. **Copy:** no hardcoded pt-BR strings. Defaults are English; user-facing copy comes through props or the i18n messages module. pt-BR ships as the second seed locale.
4. **Identifiers:** cookie prefix `app.` (not `irene.`); OTel `serviceName` from env/package name; dev port 3000; Playwright storage state `.auth/app.json`; `E2E_VERIFY_PATH` default `/dashboard`.
5. **Effect coupling:** ports that irene wrote on the Effect stack keep it (Effect is adopted); irene-only guards (`requireOwnerE` etc.) become the template's workspace-role guards.
6. **Docs travel with code:** every ported primitive updates the matching `docs/*.md` and, where applicable, `CLAUDE.md` invariants and Storybook stories.
7. **Known irene regressions do NOT port:** session table must keep template's `unique()` on jwt_token and `onDelete: cascade`; irene's clobbered generic `planning.md` is ignored (template's is canonical).

## Scope inventory

### Foundation layers (order-sensitive)

- **F1. Design tokens** — 4-role accent triads (base/soft/deep/foreground), semantic tone scale (`tone.*` aliases over CSS vars), tailwind safelist for runtime-composed classes, font-token strategy (`--font-display`/`--font-kicker` aliasing pattern), per-theme `color-scheme`, neutral placeholder palette. Files: `tailwind.config.ts`, `app/globals.css`, docs.
- **F2. Effect boundary** — `lib/effect/`: `errors.ts` (tagged union incl. generalized `SubscriptionInactive({ workspaceId })`), `run-action.ts` (30s timeout, OTel boundary span, session/actor attribution), `run-query.ts`, `boundary.ts` (`mapResult`), `db.ts` (`dbE` adapters), `validate.ts`, `parse.ts` (`parseIdE`), `cache.ts`, `tracing.ts` (env-driven serviceName), `db-span-exporter.ts` + `trace_span` table (denormalized `workspace_id`/`user_id`, 5 indexes), `traced.ts`, `actor-context.ts`, empty `markers.ts` registry pattern. Deps: `effect`, `@effect/opentelemetry`, `@opentelemetry/*`.
- **F3. DB hardening** — `timestamptz` on every timestamp; `unique(users.personId)`; pg Pool `statement_timeout: 30_000`; forward-only idempotent migration runner (`scripts/migrate.mjs`, pointed at `./drizzle` single-dir; build = `node scripts/migrate.mjs && next build`; `db:deploy` keeps drizzle-kit); `emailVerified`; partial-unique-index pattern (nullable email + phone, `WHERE ... IS NOT NULL`); `platform_role` enum (`user | admin`) + `deletedAt` soft delete; `audit_log` table (nullable `workspaceId`); `feature_flag` table (scopes global/workspace/user, most-specific-wins, check constraint); `trace_span` (with F2). Regenerate the single baseline migration (template only has 0000 — no chain pain).
- **F4. i18n** — `lib/i18n/`: locale resolution chain (cookie → person.locale → default, request-cached, "never inside `use cache`" contract), typed `t(locale)` messages module seeded with template copy in `en`/`pt-BR`, Intl formatters (BR phone mask kept but locale-gated), timezone providers + `TimezoneSync`, `LocaleProvider`/`useT`. Cookies `app.locale`/`app.tz`; `DEFAULT_LOCALE = 'en'`.
- **F5. Dual-identifier auth** — `lib/auth/identifier.ts` (detectIdentifierType, normalizePhone, `AUTH_*_COOKIE` constants replacing raw strings), Twilio OTP channel (`lib/twilio/`, active only when `TWILIO_*` env present; SMS locale from i18n not hardcoded), identify→verify/register flow on `identifier` field, nullable `persons.email` + partial uniques (F3), slim JWT. Plus standalone fixes: lowercase email canonicalization in all three actions; `useResendOtp` unmount-leak fix; verify/register redirect hardening; dev OTP console print; `VerifySuccess` animated scene (neutral tokens).
- **F6. Tenancy substrate** — `workspaces` + `workspace_members` tables; `getUserWorkspaces`; post-login dispatcher (0 memberships → onboarding, 1 → role home, N → picker as plain example UI); role-parameterized invite flow (`lib/invite/` + `app/invite/[token]`: emailed single-use token); host→tenant resolution as pluggable `createHostResolver({ baseDomain, reserved, lookupSlug, lookupDomain })` + `middleware.ts` (subdomain + verified custom domain, 60s cache, "not a security boundary" doc note); `lib/vercel/domains.ts` typed Domains API client (verbatim — zero salon code).
- **F7. Feature flags** — `lib/features/`: empty pure-data `FEATURE_REGISTRY` + `FeatureDef` type (client-importable, no server imports), server-only `resolve.ts` (defaults → global → workspace → user), `nav-gate.ts` (already fully generic).

### Components (`components/ui/`, ride F1/F4)

CVA Button (brand accents → neutral `accent`; `block` defaults true); form kit (Field/Select/Textarea/Checkbox/Radio/Switch + exported `inputChrome`); Toast system with undo + IconChip; ConfirmDialog + `useConfirmDialog` promise API; segmented OtpInput (`input-otp`) wired into VerifyForm + `.otp-caret` keyframes; DatePicker/Calendar/Popover (`react-day-picker`, `@radix-ui/react-popover`; hidden-input form contract; locale via prop defaulting to Intl); ListSearch + `useListFilter` + FilterableList (+ `lib/list/normalize.ts`); `downscale-image`; SearchCommand palette (typed-exit-only navigation, two-item example group); Reveal; 11-primitive SVG chart kit (Sparkline, MiniBars, MultiBar, Donut, Gauge, Heatmap, AreaTrend, GradientBar, Delta, Progress, Rating — tone maps renamed to neutral tokens, pt-BR defaults → props); editorial catalog (Card, Badge, IconChip, PageHeader, SectionLabel, Stat, Tile, StatTile, Tabs, SegmentedControl, Avatar, Stepper, StatusPill/ModePill, Kanban — empty-label copy → props); MoneyInput (integer-cents mask core, configurable max, Intl-based locale prop) + PhoneInput (`libphonenumber-js`, `defaultCountry` prop); WidgetRefresh generalized onto the template Tag registry (`refreshTags` action parameterized by app tag union); ImageUpload/AvatarField + `useImageUpload`/`useAvatarField` (ride Blob, below). Stories ported/updated alongside.

### lib primitives

`lib/hooks/useScrollLock.ts` (ref-counted); Drawer/Modal structural upgrades (scroll lock, `h-[100dvh]`, inner `overflow-y-auto overscroll-contain` body, pinned aria-labeled close, `fill` + `closeLabel` props, dialog ARIA, `max-h-[calc(100dvh-2rem)]`) with neutral tokens; ErrorBoundary fallback (contained panel + button retry); cache-registry `CacheProfile` (hot/warm/cold) + `withCacheProfile` (~40 self-contained lines; push-first, profile-as-safety-net rule documented); `lib/time/zoned.ts` (DST-safe wall-clock ↔ UTC, + unit tests); `lib/export/csv.ts` (RFC 4180 + BOM/CRLF; date format parameterized); `lib/theme/ThemeProvider.tsx` + ThemeToggle (`next-themes`; keep the WebKit `disableTransitionOnChange` bug comment) + `.dark` CSS vars + `color-scheme`; navigation-state primitives (`flowParams.ts` `withFrom`/`useReturnTo`/`useKeepQs`, OriginLink, ContextualBackLink, PreserveSearchLink — `useSalonId` → workspace param, BackLink de-app'd).

### Integrations

- **Blob:** `lib/blob/upload-image.ts` ('use server' validated upload: MIME allowlist, 5MB cap, slugified `<folder>/<workspace>/<ts>-<name>`, on the Effect stack with workspace-role guard), SSRF-guarded authed streaming proxy `app/api/blob-image/route.ts` (Vercel-Blob host allowlist), public-asset endpoint pattern generalized, `image-src.ts` helpers, `serverActions.bodySizeLimit: '8mb'` with explanatory comment. Dep: `@vercel/blob`.
- **Realtime pulse:** `lib/realtime/pulse.ts` generalized (`workspace_pulse` version row, best-effort bump + `pulseE`, SSE route polling with auth) + client nudge component.
- **Cron:** `docs/cron.md` convention (POST-only `app/api/cron/<name>`, `CRON_SECRET` fail-closed, idempotent+bounded), one example route (retention sweep purging `trace_span`), `vercel.json` skeleton with empty `crons`; per-tenant local-hour fan-out helper + cron-auth guard extracted from digest as `lib/cron/` primitives.
- **Stripe billing (staged):** dedicated diff-review of `lib/stripe/`, webhook route, billing-inactive workspace gate, cancel-at-period-end/resume, post-payment landing. Review output decides exact port shape; target is a workspace-scoped subscription primitive + `SubscriptionInactive` wiring. Deps: `stripe`.
- **AI stack:** `lib/capabilities/types.ts` with parameterized `CapCtx`, empty registry, `resolve.ts` shape (domain content stays), `tools-from-capabilities` generator, `docs/capabilities.md`; AI widget family (AskAi, VoiceInput, InsightCard, AiForecastHero) with persona kicker + copy configurable; `ai_call_log` table + outcome-classification helper (cost/refusal tracking). Dep: `ai`.

### App patterns

Suspense-wrapped guard shells (sync layout → `<Suspense fallback={<FootprintFallback/>}>` → async Shell doing uncached I/O + redirect inside the boundary) applied to template's dashboard layout + documented; throw-based `XxxGuardError`/`requireXxx` guard convention (docs + `requireSession`/`requireAdmin` worked examples); gate-topology doc (one chokepoint layout per area, escape routes as ungated siblings, route groups for same-prefix public routes); viewport `interactiveWidget: 'resizes-content'` with comment; gate `/docs` behind session in production (typed-entry redirects); root-layout provider wiring (ThemeProvider, ToastProvider, TimezoneSync, `<html lang>`, LocaleProvider in auth layout); onboarding-checklist gate pattern documented (checklist route, per-item readiness predicate, layout lock + escape route — the distilled lesson of irene's ~100-commit wizard→checklist arc; docs only); server-side pagination + URL-state convention (ListPager/`useListSearch` generalized into `lib/list`/components + contract `page`-param doc); `next.config.ts` `devIndicators: { position: 'bottom-right' }`.

### Tooling, testing, QA

Vitest (config mirroring `@/` alias; `.test.ts` vitest / `.spec.ts` Playwright split; `test`/`test:watch` scripts; one example test — `zoned.test.ts` covers it); Playwright pre-auth harness (`scripts/playwright/auth-setup.mjs` minting JWT + session row against template schema, verify path `/dashboard`, state `.auth/app.json`; `smoke.mjs`; `.mcp.json` Playwright MCP wiring); QA auditor scripts (`scripts/qa/`: visit/interact/mobile/contrast/sql + add-findings/render-findings ledger — BASE_URL/auth-path/dark-mode-keys/submit-regex parameterized, English-first regex); `.gitignore` QA block (`/.auth/` with live-token warning, `.playwright-mcp/`, root `/*.png`, `playwright-report`); annotated `.env.example` runbook convention (grouped by integration, inline setup instructions; TWILIO/CRON_SECRET/BLOB/STRIPE/VERCEL_TOKEN documented as feature-gated); sentinel-scoped idempotent seed skeleton (`scripts/seed-demo.mjs`: env hydration, `@demo.invalid` scoping, reverse-FK cleanup, `information_schema` probing — seeds auth + workspace tables only).

### Docs, skills, agents (`.claude/` + `docs/`)

browser-verifier-mcp agent + verify-in-browser skill (de-irene'd: port 3000, template routes/schema); e2e-via-cmux skill (kept — this environment is cmux-first) + legacy browser-verifier agent; `app-navigation.md` living-map skeleton (Environment, auth-injection recipe, React controlled-input trick, self-update instruction); autonomous-build skill + orchestration.md + pitfalls.md (framework-generic entries only); agent-memory convention (`memory: project` frontmatter, Self-improvement section, empty `agent-memory/<agent>/` dirs); qa-engineer + qa-ux agents (salon nouns → placeholders) + QA charter template; Effect invariants (CLAUDE.md block + decision-guide rows; `docs/data-flow.md` Effect section, `docs/caching.md` profile rules, `docs/rate-limiting.md` update — template examples, no `EFFECT_DISABLE`/Phase-7 migration residue); links.md decision tree + flow-params.md (?from= lifecycle) + pages.md cross-cutting section; `docs/schema.md` additions (timestamptz rule, partial-unique pattern, audit_log shape); `docs/cron.md`; `docs/capabilities.md`; token/design-system doc with palette-swap procedure.

## Explicitly excluded (salon-specific)

Salon schema/tables and migrations payload, appointment/hub/no-show components, salon onboarding wizard content (pattern docs only), branded AuthShell composition, drive.mjs route list, scenario fixture harness (referenced in QA docs as a pattern), irene agent-memory *content*, walkthrough capture scripts (techniques distilled into QA docs), `recharts` (salon analysis only), `dotenv` (import-from-source only).

## Verification

- `tsc --noEmit` clean; `next build` (includes migration runner against a scratch DB); `vitest run` green; Storybook builds; ESLint clean.
- Playwright smoke via the ported harness: auth-setup mints a session against seeded demo user, `/dashboard` renders authed.
- Browser pass on auth flow (identify → OTP → verify) and dashboard with the new providers mounted.
- Each phase lands as its own commit on branch `backport/irene-2026-07`; template `main` untouched until done.

## Non-goals

Migrating irene itself onto any renamed primitive; restoring irene's clobbered `planning.md` (noted, separate concern); porting Stripe/AI code *before* their review stages pass.
