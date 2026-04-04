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
