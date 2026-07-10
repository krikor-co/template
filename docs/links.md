---
title: Links
order: 13
category: Patterns
---

# Links

> Picking the right link primitive for the situation.

The template ships **four** link primitives. Each solves a different problem; picking the wrong one breaks back-navigation or filter state.

| Primitive | Purpose | Mechanism | Deep dive |
|---|---|---|---|
| `<OriginLink>` | Row-click on a list page where the destination is its own page (detail / edit) | `?from=` (one-level origin URL) | [`flow-params.md`](flow-params.md) |
| `<ContextualBackLink>` | The "back" affordance on a destination page — renders contextual ("where you came from") + canonical ("up to parent") | reads `?from=` | [`flow-params.md`](flow-params.md) |
| `<PreserveSearchLink>` + `useKeepQs()` | Intra-page navigation that must preserve a fixed set of filter keys (e.g. opening a drawer via a search-param toggle) | named-key search-param carry | this file |
| `<BackLink>` | Canonical "up to my parent" link — used when the page has no inter-flow context to preserve | static href | `components/ui/BackLink.tsx` |

Apps with clickable domain entities (a customer name inside a sentence, a
linked product title) should add their own **entity-link** primitives on top
of `withFrom` — one component per entity, styled as linked text. That family
is app-level by nature (it knows your routes and entities), so the template
doesn't ship one; `<OriginLink>` is the un-styled foundation to copy from.

---

## Decision tree

Start here when adding a new link.

```
Am I rendering a domain entity's display name as a link?
├─ Yes → your app's entity-link primitive (build it on withFrom; see note above)
└─ No → continue

Is this a row-click on a list page, navigating to a detail/edit sub-page?
├─ Yes → <OriginLink>      (so the destination's ContextualBackLink can return them with filters intact)
└─ No → continue

Is this a "back" link on a destination page (detail / edit / form)?
├─ Yes → <ContextualBackLink fallbackHref={…} fallbackLabel={…} />
└─ No → continue

Am I navigating WITHIN the same page but the URL must keep certain filter keys
(e.g. opening a drawer via search-param toggle on a list page)?
├─ Yes → <PreserveSearchLink keep={[…]}> + useKeepQs([…])
└─ No → continue

Is this the chrome's static "up to parent" link with NO filter context?
├─ Yes → <BackLink href={route.exits.parent()} label="Back to people" />
└─ No → plain <Link> — but think twice; it's almost always one of the above.
```

If you're using a raw `<Link href={route.exits.x(...)}>` for a row-click or a
back-link, you're probably wrong. These primitives exist specifically because
raw links drop state.

---

## `<OriginLink>` — row-click with origin preservation

Appends `?from=<currentPathnameAndSearch>` via `withFrom`, with no typography
opinion — suitable for "click the whole row" or "click the Edit button"
patterns.

```tsx
import { OriginLink } from '@/components/ui/OriginLink'

<ul className="divide-y rounded-md border">
  {people.map((p) => (
    <li key={p.id}>
      <OriginLink
        href={route.exits.personDetail({ personId: p.id })}
        className="grid grid-cols-12 items-center gap-3 px-4 py-3 hover:bg-muted/50"
      >
        {/* …row content… */}
      </OriginLink>
    </li>
  ))}
</ul>
```

The destination's `<ContextualBackLink>` then renders "Back to where you came
from" → the list URL with `?q=…&page=…` intact.

**File:** `components/ui/OriginLink.tsx`

---

## `<PreserveSearchLink>` + `useKeepQs()` — intra-page state carry

A **different** mechanism from `?from=`. Solves: "on a list+calendar page,
opening the detail drawer (`?openDrawer=N`) drops `?view`, `?date`, `?page` —
when the drawer closes, the filters reset."

The fix: every drawer-open and drawer-close link re-appends the known filter
keys.

```tsx
// 1. Define the keys to keep once, per page
const KEEP = ['view', 'date', 'page'] as const

// 2. Use the link in lists / calendar items
import { PreserveSearchLink } from '@/components/ui/PreserveSearchLink'

<PreserveSearchLink href={route.exits.detailOpen({ id })} keep={KEEP}>
  {row.name}
</PreserveSearchLink>

// 3. Use the hook for imperative navigation (router.push)
import { useKeepQs } from '@/lib/flow-params'

const qs = useKeepQs(KEEP)
router.push(qs ? `${base}?${qs}` : base)
```

**Why this isn't `?from=`:**
- `?from=` carries **one full URL** as a single opaque string. Designed for
  cross-flow navigation (overview page → detail page → back to overview).
- `PreserveSearchLink` carries **a known set of keys** as individual params.
  Designed for intra-page transitions where the page itself owns the filter
  state and needs to round-trip it through the URL.

A page can use both: `PreserveSearchLink` for its drawer transitions AND
`<OriginLink>` on row-clicks that navigate OUT to other pages.

**Convention:** the keep-keys list is page-specific by nature — define one
`KEEP` const per page next to the page that owns the filter state, and keep
the toggled param (e.g. `openDrawer`) out of it.

---

## The three patterns side-by-side

| Pattern | URL after click | What the destination does |
|---|---|---|
| Raw `<Link>` | `/dest` | No filter context — back goes to bare parent |
| `<OriginLink>` | `/dest?from=%2Forigin%3Fq%3Dx%26page%3D3` | `<ContextualBackLink>` renders two links: "Back to where you came from" → origin (filters intact) + canonical → bare parent |
| `<PreserveSearchLink>` | `/same-page?openDrawer=N&view=day&date=…` | Stays on the same page; the page reads its filters from `searchParams` and renders both the list AND the drawer |

---

## When NOT to preserve state

Sometimes you want to drop filters. Two cases worth calling out:

- **Sidebar / global nav.** Going from `/dashboard/reports?date=…` to
  `/dashboard/people` should land on the bare people list, not propagate the
  date filter. Nav links use plain `<Link>` — no preservation primitives.
- **Form success that creates a new entity.** After creating a record, the
  user lands on the new record's detail page. Don't append `?from=` — the new
  page should render `<ContextualBackLink>` with its canonical fallback (back
  to list), not bounce them back to where the create form was opened.

The `?from=` machinery handles both naturally: only `<OriginLink>` (and your
entity links) emit it; everything else drops it.

---

## Checklist for a new list page

When you add a list page with URL filter state (`?q=`, `?page=`, date range):

1. **Row click → `<OriginLink>`** (or your entity-link primitive).
2. **Detail page top back-link → `<ContextualBackLink fallbackHref={…} fallbackLabel={…} />`**.
3. **Edit/form page top back-link → `<ContextualBackLink>`** (same as detail).
4. **Form `redirectTo` on success → resolve via `useReturnTo({ fallback })`**
   so save-then-return lands on the origin list page with filters intact.
5. **If the page opens a drawer via search-param toggle** → define the page's
   `KEEP` const, use `<PreserveSearchLink keep={KEEP}>` on the drawer-open
   links, and `useKeepQs(KEEP)` for the drawer-close `router.push`.

---

## Quick reference

```tsx
// Whole-row link:
import { OriginLink } from '@/components/ui/OriginLink'
<OriginLink href={route.exits.personDetail({ personId })} className="…">
  …row content…
</OriginLink>

// Destination back link:
import { ContextualBackLink } from '@/components/ui/ContextualBackLink'
<ContextualBackLink fallbackHref={route.exits.parent()} fallbackLabel="Back to people" />

// Form success that returns to origin (when present):
import { useReturnTo } from '@/lib/flow-params'
const returnTo = useReturnTo({ fallback: route.exits.parent() })
const successHref = returnTo ?? route.exits.parent()

// Intra-page drawer toggle:
import { PreserveSearchLink } from '@/components/ui/PreserveSearchLink'
<PreserveSearchLink href={route.exits.detailOpen({ id })} keep={['view', 'date', 'page']}>…</PreserveSearchLink>

// Canonical-only back:
import { BackLink } from '@/components/ui/BackLink'
<BackLink href={route.exits.parent()} label="Back to people" />
```

Files of interest:

- `components/ui/OriginLink.tsx` — row-click `?from=` emitter
- `components/ui/ContextualBackLink.tsx` — canonical destination back link
- `components/ui/PreserveSearchLink.tsx` — named-key search-param carry
- `components/ui/BackLink.tsx` — the static canonical "up" link
- `lib/flow-params.ts` — `withFrom`, `resolveReturnTo`, `useReturnTo`, `useDropFlowParam`, `useKeepQs`
