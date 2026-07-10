# Flow Framework

A Next.js template with one hierarchy, four layers, and zero ambiguity about where things go.

```
Page           composes Shells + Sections, parses URL, no logic
Shell          presentation context (FullPage, Card, Modal, Drawer)
Section        the feature: state machine, data fetching, actions
Primitives     raw UI atoms: Button, Input, Badge
```

Every non-primitive component is a section. Every section has an exhaustive state type. Every state renders through a `switch`. No exceptions.

It ships batteries included: a typed Effect server boundary, email + phone OTP auth, multi-tenant workspaces, i18n, a design-token system, and pre-wired integrations (Stripe, Vercel Blob, realtime, cron) — all following the same conventions, all documented, all deletable if you don't need them.

**Demo**: https://template-krikor.vercel.app/ | **Docs**: https://template-krikor.vercel.app/docs

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS · Effect · Drizzle ORM · PostgreSQL · Zod · Storybook · Vitest · Playwright

## Setup

```bash
npm install
cp .env.example .env.local    # configure DATABASE_URL, AUTH_SECRET, RESEND_API_KEY
npm run db:push               # apply schema to a dev database
npm run dev                   # http://localhost:3000
```

Deploys apply migrations automatically: `npm run build` runs `scripts/migrate.mjs` (a forward-only, idempotent runner over `drizzle/*.sql`) before `next build`. `.env.example` documents every variable, including the feature-gated ones (`TWILIO_*`, `STRIPE_*`, `BLOB_*`, `CRON_SECRET`) — a subsystem stays dormant until its env is present.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Run migrations, then production build |
| `npm run test` | Vitest unit tests (`*.test.ts`) |
| `npm run test:e2e` | Playwright end-to-end tests (`*.spec.ts`) |
| `npm run lint` | ESLint |
| `npm run storybook` | Storybook on port 6006 |
| `npm run db:push` | Push schema to a dev database |
| `npm run db:studio` | Drizzle Studio (database GUI) |
| `npm run db:generate` | Regenerate the baseline migration |
| `npm run seed:demo` | Seed idempotent demo data (`@demo.invalid`) |
| `npm run flow` | CLI scaffolding tool |

## Scaffolding

### CLI

```bash
# Generate a route (entry.ts + contract.ts + page.tsx + layout.tsx)
npm run flow -- g route app/bookings/new

# Generate a section (state.ts + transition.ts + scene.ts + fixtures.ts + component + stories)
npm run flow -- g section app/bookings/new/_components/CreateBookingForm --client --mutates
```

Section flags: `--client` (needs interactivity), `--fetches` (loads data), `--mutates` (has form/action).

### Claude Code

```
/scaffold-route app/bookings/new
/scaffold-section a form for creating bookings with service and date fields
/scaffold-feature an appointment booking flow with list and create pages
/design-flow — plan a feature as a visual flow diagram before implementation
```

Claude commands call the CLI for boilerplate, then fill in domain logic.

## Project structure

```
middleware.ts                 host → tenant resolution (subdomains, custom domains)
app/
  auth/                       email + phone OTP flow (identify, verify, register)
  dashboard/                  post-login workspace dispatcher (0 / 1 / N memberships)
  onboarding/                 first-workspace setup
  workspace/[workspaceId]/    the tenant-scoped app (billing gate lives here)
  invite/[token]/             magic-link invite accept
  admin/                      platform-admin surface
  api/                        stripe webhook, blob proxy, cron, realtime SSE
  docs/                       browsable documentation site
components/ui/                primitives + catalog (forms, charts, DatePicker, Toast, …)
db/schema/                    Drizzle schema (users, workspaces, feature_flag, trace_span, …)
lib/
  effect/                     server boundary — runAction / runQuery / typed errors / tracing
  auth/                       session, JWT, identifier (email-or-phone)
  i18n/                       locale resolution, typed messages, formatters, timezones
  tenant/                     pluggable host resolver
  workspace/  invite/         membership queries, invite roles + email
  features/                   feature-flag registry + 3-scope resolution
  stripe/  blob/  realtime/  cron/   integrations (all feature-gated)
  capabilities/  ai/          capability registry + AI surfaces
  theme/                      ThemeProvider (next-themes)
  shell/                      Shell components (FullPage, Card, Modal, Drawer)
  hooks/  list/  export/  time/      utilities (scroll-lock, filtering, CSV, zoned time)
  cache-registry.ts           typed hierarchical cache tags + cache-life profiles
  route-registry.ts           typed URL navigation
  scene.ts                    createScene — state machine hook factory
  rate-limit.ts               database-backed rate limiting
scripts/                      migrate.mjs, seed-demo.mjs, qa/, playwright/
tools/cli/                    scaffolding generators
docs/                         markdown documentation (rendered at /docs)
e2e/                          Playwright tests
```

## Key patterns

**Server boundary**: Every server action wraps its body in `runAction(pipe(...))` and every cached query in `runQuery(...)` — one tagged error union (`Forbidden | NotFound | ValidationFailed | …`), a default timeout, automatic OpenTelemetry spans, and `mapResult()` collapsing the per-action error switch at the edge. Pure `pipe` + `Effect.Do`, never `Effect.gen`. See [Data Flow](docs/data-flow.md).

**State machines**: Every section's state is a discriminated union on `status`. The component body is `switch (state.status)`. Transitions are pure functions `(state, event) => state`.

**Forms**: Three hooks compose without coupling — `useScene` (status), `useFormValues` (input values + validation), `useRedirectOnSuccess` (navigation). Forms use `<form action={fn}>` with `defaultValue` for value persistence across React 19's form reset.

**Navigation**: Every URL has `entry.ts` (build + parse) and `contract.ts` (exits). No raw URL strings anywhere. Actions return domain data — sections map results to routes.

**Caching**: `tagWith()` inside `'use cache'` scopes. `invalidate()` for immediate freshness, `softInvalidate()` for eventual. Tags are hierarchical; `withCacheProfile()` sets time-based revalidation.

**Guards**: Gated layouts are sync Suspense shells — the async guard runs inside the boundary and redirects from there, so uncached I/O never blocks navigation.

## Documentation

The `docs/` directory is a browsable site at `/docs` that ships with the template and grows with your app. Run `npm run dev` and visit [localhost:3000/docs](http://localhost:3000/docs), or read the markdown directly:

**Framework**

| Doc | Topic |
|-----|-------|
| [Overview](docs/overview.md) | What this is, how to get started |
| [Pages](docs/pages.md) | Page layer, hierarchy, `?page=`/`?q=` list contract |
| [Routing](docs/routing.md) | RouteRegistry, entries, exits |
| [Shells](docs/shells.md) | Shell types and implementation |
| [Sections](docs/sections.md) | Six section types and file map |
| [Guards](docs/guards.md) | Suspense guard shells, gate topology |
| [Links](docs/links.md) | Link primitives decision tree |
| [Flow Params](docs/flow-params.md) | `?from=` origin-tracking lifecycle |
| [Commands](docs/commands.md) | CLI and Claude Code scaffolding |
| [Planning](docs/planning.md) | Design-flow specs and feature planning |

**Data & state**

| Doc | Topic |
|-----|-------|
| [Data Flow](docs/data-flow.md) | Load / mutation / client-fetch + the Effect boundary |
| [Declarative Flows](docs/declarative-flows.md) | Action-first design principle |
| [Forms](docs/forms.md) | useFormValues, validation, persistence |
| [Caching](docs/caching.md) | Cache tags, invalidation, cache-life profiles |
| [Schema](docs/schema.md) | Entity-first modeling, timestamptz, partial uniques |
| [Rate Limiting](docs/rate-limiting.md) | Database-backed rate limiter |

**Platform & integrations**

| Doc | Topic |
|-----|-------|
| [Tenancy](docs/tenancy.md) | Workspaces, members, host resolution |
| [Feature Flags](docs/feature-flags.md) | Pure registry + 3-scope resolution |
| [i18n](docs/i18n.md) | Locale chain, typed messages, formatters, timezones |
| [Billing](docs/billing.md) | Stripe subscriptions and the workspace paywall |
| [Blob](docs/blob.md) | Validated uploads + SSRF-guarded serving |
| [Realtime](docs/realtime.md) | Per-tenant pulse + SSE nudge |
| [Cron](docs/cron.md) | Background-job convention and per-tenant fan-out |
| [Capabilities](docs/capabilities.md) | One operation, one definition; AI tools from it |

**Design & tooling**

| Doc | Topic |
|-----|-------|
| [Design Tokens](docs/design-tokens.md) | Accent triads, tone scale, palette swap |
| [Storybook](docs/storybook.md) | Story patterns and shell decorator |
