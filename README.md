# Flow Framework

A Next.js template with one hierarchy, four layers, and zero ambiguity about where things go.

```
Page           composes Shells + Sections, parses URL, no logic
Shell          presentation context (FullPage, Card, Modal, Drawer)
Section        the feature: state machine, data fetching, actions
Primitives     raw UI atoms: Button, Input, Badge
```

Every non-primitive component is a section. Every section has an exhaustive state type. Every state renders through a `switch`. No exceptions.

**Demo**: https://template-krikor.vercel.app/ | **Docs**: https://template-krikor.vercel.app/docs

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS · Drizzle ORM · PostgreSQL · Zod · Storybook · Playwright

## Setup

```bash
npm install
cp .env.example .env.local    # configure DATABASE_URL, RESEND_API_KEY
npm run db:push               # apply schema to database
npm run dev                   # http://localhost:3000
```

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run storybook` | Storybook on port 6006 |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Drizzle Studio (database GUI) |
| `npm run db:generate` | Generate migration files |
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
```

Claude commands call the CLI for boilerplate, then fill in domain logic.

## Project structure

```
app/
  auth/                     authentication flow (identify, verify, register)
  dashboard/                authenticated area
  docs/                     browsable documentation site
components/ui/              primitives (Button, Input, Label, etc.)
db/
  schema/                   Drizzle schema definitions
  drizzle.ts                database connection
lib/
  auth/                     session, JWT
  hooks/                    useFormValues, useRedirectOnSuccess
  otp/                      email OTP creation and verification
  shell/                    Shell components (FullPage, Card, Modal, Drawer)
  cache-registry.ts         typed hierarchical cache tags
  route-registry.ts         typed URL navigation
  scene.ts                  createScene — state machine hook factory
  rate-limit.ts             database-backed rate limiting
  transition.ts             transition guards for layout redirects
tools/cli/                  scaffolding generators
docs/                       markdown documentation (rendered at /docs)
e2e/                        Playwright tests
```

## Key patterns

**State machines**: Every section's state is a discriminated union on `status`. The component body is `switch (state.status)`. Transitions are pure functions `(state, event) => state`.

**Forms**: Three hooks compose without coupling — `useScene` (status), `useFormValues` (input values + validation), `useRedirectOnSuccess` (navigation). Forms use `<form action={fn}>` with `defaultValue` for value persistence across React 19's form reset.

**Navigation**: Every URL has `entry.ts` (build + parse) and `contract.ts` (exits). No raw URL strings anywhere. Actions return domain data — sections map results to routes.

**Caching**: `tagWith()` inside `'use cache'` scopes. `invalidate()` for immediate freshness. `softInvalidate()` for eventual. Tags are hierarchical.

## Documentation

Run `npm run dev` and visit [localhost:3000/docs](http://localhost:3000/docs) for the full documentation, or read the markdown files in `docs/`:

| Doc | Topic |
|-----|-------|
| [Overview](docs/overview.md) | What this is, how to get started |
| [Commands](docs/commands.md) | CLI and Claude Code scaffolding |
| [Pages](docs/pages.md) | Page layer and hierarchy |
| [Routing](docs/routing.md) | RouteRegistry, entries, exits |
| [Shells](docs/shells.md) | Shell types and implementation |
| [Sections](docs/sections.md) | Six section types and file map |
| [Caching](docs/caching.md) | Cache tags and invalidation |
| [Forms](docs/forms.md) | useFormValues, validation, persistence |
| [Guards](docs/guards.md) | Layout and transition guards |
| [Data Flow](docs/data-flow.md) | Load, mutation, client-fetch patterns |
| [Declarative Flows](docs/declarative-flows.md) | Action-first design principle |
| [Schema](docs/schema.md) | Entity-first database modeling |
| [Rate Limiting](docs/rate-limiting.md) | Database-backed rate limiter |
| [Storybook](docs/storybook.md) | Story patterns and shell decorator |
