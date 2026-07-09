---
title: Pages
order: 1
category: Core
---

# Pages

A page's job is minimal: parse the URL and compose Shells and Sections. No logic, no state, no business decisions, no data fetching. Sections own their own data.

Every page is one of two types:

## Single-section page — a step in a flow

One Shell, one Section. The page IS the step. Part of a routed flow navigated via RouteRegistry exits.

Use this when the page demands full attention: a form, a confirmation, an onboarding step, a detail view.

```tsx
// app/bookings/new/page.tsx
export default async function NewBookingPage({ searchParams }: Props) {
  const entry = route.entry.parse(ctx)
  return (
    <Shell.FullPage title="New Booking">
      <CreateBookingSection entryParams={entry} />
    </Shell.FullPage>
  )
}
```

The section receives only the parsed URL params it needs. It fetches its own data internally (via `query.ts` for server sections, or `useXxxLoader.ts` for client sections).

## Multi-section page — an overview

Multiple Shells each wrapping an independent Section. Sections stream independently via their own Suspense boundaries. Each has its own data, error boundary, and refresh.

Use this when the page aggregates several independent concerns: a dashboard, a profile, a settings page.

```tsx
// app/dashboard/page.tsx
export default async function DashboardPage() {
  return (
    <main className="space-y-6 p-6">
      <Shell.Card title="Upcoming Bookings">
        <Suspense fallback={<BookingsListView state={fixtures.empty} />}>
          <BookingsList />
        </Suspense>
      </Shell.Card>

      <Shell.Card title="Revenue">
        <Suspense fallback={<RevenueView state={fixtures.empty} />}>
          <Revenue />
        </Suspense>
      </Shell.Card>
    </main>
  )
}
```

Each section is an async server component that fetches its own data via `query.ts`. The page only composes — it never fetches.

## The strict hierarchy

```
Page
  └── Shell           (FullPage · Card · Modal · Drawer)
        └── Section   (the feature: state machine, data, actions)
              └── Primitives   (Button · Input · Badge · …)
```

- **Pages** never contain Primitives directly — always through a Shell and Section
- **Sections** never reference their Shell — the Shell is always the caller's concern
- **Primitives** have no data, no state, no domain logic — if it fetches, it's a Section

## The system

```
RouteRegistry
  Organizes navigation. Each URL is one focused route.
  State travels via the URL. No central orchestrator.

Shell
  Organizes presentation context. Provides container
  queries, step transitions, error boundaries, and
  global actions. Sections know nothing about their Shell.

Section
  Organizes component state. Every non-primitive component
  is an independent block with an exhaustive state type.

CacheRegistry
  Organizes data invalidation. Tags are typed, hierarchical,
  and defined once. Queries apply them. Actions invalidate.
```

Each part answers one question:

- **RouteRegistry**: where does the user go next, and what data does the next page need?
- **Shell**: what presentation context does this Section live in?
- **Section**: what can this component show, and what can the user do from each state?
- **CacheRegistry**: when data changes, what cached entries are now stale?

## Cross-cutting primitives

A page composes Shells + Sections, but it also renders row-links and
back-links — and those are *not* invented per page. Two conventions are
framework-wide:

- **Link primitives** — row-clicks, back affordances, and filter-preserving
  links are shared primitives (`<OriginLink>`, `<ContextualBackLink>`,
  `<PreserveSearchLink>`, `<BackLink>` in `components/ui/`), each with a
  decision tree entry. See [`links.md`](links.md).
- **Inter-flow navigation** (`?from=`) — when a link takes the user *out* of
  one flow into another, the destination page surfaces a "back to where you
  came from" affordance alongside its canonical back. See
  [`flow-params.md`](flow-params.md). Adopting it on a page is a one-line
  swap (`BackLink` → `ContextualBackLink`).

### How they compose

```
URL
 │
 ▼
page.tsx  ← RouteRegistry: parses URL into typed params via route.entry.parse()
 │
 ▼
<Shell.Card title="Appointments">   ← Shell: presentation context + global affordances
  │
  ▼
  <AppointmentsList initialState={...} />   ← Section: state machine drives UI
    │
    ├── query.ts   ← fetches data, applies cache tags via tagWith()
    │
    └── actions.ts ← mutates data, invalidates cache, returns domain result
</Shell.Card>
```

## Server-paginated lists — the `page` param contract

Lists that can grow unbounded paginate **server-side** (SQL `LIMIT`/`OFFSET`)
with the URL as the single source of list state — a list URL is shareable and
refresh-safe by construction. The contract:

- `?page=` — 1-based page number. The route's `entry.ts` owns parsing:
  coerce to a positive integer, default `1`, never trust the raw string.
- `?q=` — optional keyword filter. Trimmed; omitted when empty.
- Every other active filter travels in the URL the same way, and
  `entry.href` is the ONLY place list URLs are built.

```typescript
// entry.ts — page/q are part of the route's typed contract
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

const schema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  q:    z.string().trim().min(1).optional().catch(undefined),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href: (p: Partial<Params> = {}) => {
    const qs = new URLSearchParams()
    if (p.q) qs.set('q', p.q)
    if (p.page && p.page > 1) qs.set('page', String(p.page))
    const s = qs.toString()
    return s ? `/things?${s}` : '/things'
  },
  parse: (ctx: ParseContext) => schema.parse(ctx.searchParams),
}
```

The section's `query.ts` selects `LIMIT pageSize OFFSET (page - 1) * pageSize`
— fetch `pageSize + 1` rows to learn whether a next page exists without a
second COUNT round-trip. The **page** computes the prev/next hrefs from its
OWN `entry.href` (preserving every active filter) and passes them to the
`ListPager` client island as plain strings:

```tsx
// page.tsx
const entryParams = route.entry.parse(ctx)
const { rows, hasMore, total } = await listThings(entryParams)

const prevHref = entryParams.page > 1
  ? route.entry.href({ ...entryParams, page: entryParams.page - 1 })
  : null
const nextHref = hasMore
  ? route.entry.href({ ...entryParams, page: entryParams.page + 1 })
  : null

return (
  <ListPager
    prevHref={prevHref}
    nextHref={nextHref}
    rangeLabel={`${start}–${end} of ${total}`}
    pageLabel={`Page ${entryParams.page}`}
    prevLabel="Previous page"
    nextLabel="Next page"
  >
    {/* server-rendered rows */}
  </ListPager>
)
```

`ListPager` (`components/ui/ListPager.tsx` + `useListPager.ts`) wraps
`router.push` in a `startTransition` so the current rows stay on screen
(dimmed) while the next page streams in — a plain `<Link>` would re-suspend
the section and flash its skeleton. It never builds URLs: the server passes
finished hrefs in, so nothing route-specific leaks into the island and the
no-raw-URL-strings invariant holds (the hrefs come from `entry.href`).

Keyword search rides the same contract: `ListSearchBox`
(`components/ui/ListSearchBox.tsx`) + `useListSearch`
(`lib/list/useListSearch.ts`) debounce the input 300ms, then push
`?q=<term>` — REPLACING the whole query string, which deliberately drops
`?page=` so a new search resets to page 1.

Client-side instant filtering is for lists that are already fully loaded on
the client; the moment a list paginates on the server, every filter must
travel through the URL so the SQL query sees it.
