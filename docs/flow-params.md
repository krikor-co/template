---
title: Flow Params (?from=)
order: 14
category: Patterns
---

# Inter-flow navigation (`?from=`)

> Let the user click a person's row on the dashboard overview, land on the
> person detail page, then go back to the **overview they came from** — not
> the bare people list.

A three-stage lifecycle around a single query param, built on a handful of
primitives. Nothing more global. Nothing stateful. No breadcrumb stack.

```
Overview → click <OriginLink> → /dashboard/people/123?from=/dashboard?tab=today
                                 └─ destination shows "← Back to where you came from"
                                    alongside its canonical "Back to people"
```

Files: `lib/flow-params.ts` + `components/ui/ContextualBackLink.tsx`.

---

## The lifecycle

The `?from=` param has exactly three lifecycle stages. Each has a dedicated
primitive. Picking the right primitive for each stage is the whole pattern.

### Birth — `withFrom(target, current)`

`<OriginLink>` emits `?from=` by calling `withFrom` under the hood — a
drop-in `<Link>` replacement for row-click / whole-card click targets. Apps
that add entity-name link primitives should emit it the same way.

```ts
withFrom('/dashboard/people/123', '/dashboard?tab=today')
// → '/dashboard/people/123?from=%2Fdashboard%3Ftab%3Dtoday'
```

`withFrom` leaves any pre-existing `from` on the target alone. That's the
**one-level-deep rule**: a chain Overview → Person → Report puts
`from=/person` on the report URL, not `from=/overview`. We deliberately don't
accumulate a stack — the canonical BackLink is always there as the global
"up" affordance.

Hand-written `<Link>` and `route.entry.href(...)` calls never emit `from`.
The param can only be spawned where we explicitly chose to spawn it. Nav
links, route exits, and form redirects all stay clean.

### Use — `useReturnTo({ fallback, prefix? })`

The destination page calls this hook to resolve a contextual back href. The
hook validates — any failure → `null` → caller falls back to the canonical
href.

```ts
const returnTo = useReturnTo({ fallback: route.exits.people(), prefix: '/dashboard' })
// → '/dashboard?tab=today'   (when ?from= is valid)
// → null                     (when missing / external / outside prefix / equal to fallback / self-loop)
```

Validation rules (any failure → `null`):
- Must be an in-app path: starts with `/` but not `//` — blocks absolute and
  protocol-relative URLs (open-redirect guard).
- When `prefix` is given, must start with it — scopes the honoured origins to
  an area (a workspace-scoped app passes its workspace route prefix, e.g.
  `/w/${workspaceId}`).
- Must not equal `fallback` — avoids duplicating the canonical back.
- Must not equal the current pathname — no self-loops.

The pure core is exported as `resolveReturnTo(raw, { fallback, pathname,
prefix? })` for unit tests and server-side reuse.

### Drop — `useDropFlowParam('from')`

For flows that **complete on the same page** (inline save with no
navigation), call this hook to scrub the param via `router.replace`. No
scroll, no navigation, just URL cleanup.

```tsx
const dropFrom = useDropFlowParam()    // defaults to 'from'

const handleSaved = () => {
  // … run inline save
  dropFrom()                            // ?from=… falls off the URL
}
```

Most flows don't need this. Two reasons it dies naturally without explicit
drop:

1. The destination's contextual back navigates to `from` *plain* —
   destination URL is left clean.
2. Any other `route.exits.*(...)` exit doesn't carry `from` forward.

`useDropFlowParam` is the safety valve for the one case those two don't
cover: completing in place without changing the URL otherwise.

---

## `<ContextualBackLink>` — the canonical adoption point

You don't usually call the hooks directly. You use `<ContextualBackLink>`,
which renders the canonical back **always** and the contextual back **when
applicable**:

```tsx
<ContextualBackLink
  fallbackHref={route.exits.people()}
  fallbackLabel="Back to people"
/>
```

Renders:

```
← Back to where you came from        ← Back to people
[contextual, only when ?from valid]  [canonical, always]
```

- The canonical link is the page's stable mental model — never hidden.
- The contextual link appears only when `useReturnTo` resolves to a real,
  valid origin.
- Optional `contextualLabel` overrides the default English copy (pass a
  translated string from your i18n messages).
- Optional `prefix` scopes which origins are honoured.

**Migration recipe** for any detail page:

```diff
- <BackLink href={route.exits.people()} label="Back to people" />
+ <ContextualBackLink
+   fallbackHref={route.exits.people()}
+   fallbackLabel="Back to people"
+ />
```

That's the entire change. The flow handles itself from there.

---

## What `from` does NOT do

| Question | Answer |
|---|---|
| Does it survive a hard refresh? | Yes — it lives in the URL, so refresh + share both preserve it. |
| Does it survive opening in a new tab? | Yes — `Link` preserves the href. |
| Does it survive chaining (Overview → Person → Report)? | **No.** Report's `from` points to `/person`, not `/overview`. One level deep. |
| Does it persist if the user goes elsewhere? | No — only origin-link primitives emit it. Nav, exits, hand-written links all drop it naturally. |
| Should I use it as a breadcrumb? | No — use `<ContextualBackLink>` which already does the right thing. |
| Should I store the breadcrumb stack somewhere? | No — that's the explicit non-goal. |

---

## Why one level (and not a stack)

A stack would let Report go back to Person, then Person back to Overview. We
chose not to build that because:

- **Pruning rules get hard fast.** What if the user navigates Overview →
  Person → Person → Report? Does Person appear twice in the stack?
- **The 95% case is one level.** Overview → detail is the common pattern.
  Two-hop is rare; three-hop is rarer.
- **The canonical BackLink is already the global "up".** For anything deeper,
  the browser back button works; same for the canonical hierarchy.

If you ever need a real chain, the upgrade path is to make `from` a
comma-separated list and have `useReturnTo` pop the last entry. The current
primitives are designed so that upgrade is local — neither call sites nor
`<ContextualBackLink>` would need to change.

---

## Convention to keep this clean

The lifecycle only works if the **birth stage is constrained**. Three rules:

1. **Only origin-link primitives emit `from`** (`<OriginLink>` and any
   app-authored entity links built on `withFrom`). No hand-written
   `<a href="…?from=…">`.
2. **No `route.entry.href(...)` call appends `from`**. The entries don't know
   about it; `withFrom` is the only blessed wrapper.
3. **All adopting destinations use `<ContextualBackLink>`**, not raw
   `useReturnTo` (with one exception: pages that render their back UI in a
   non-standard place may call the hook directly).

A simple grep can backstop this:

```bash
# Should match only lib/flow-params.ts and components/ui/OriginLink.tsx
grep -rn "from=" app/ components/ lib/ --include="*.tsx" --include="*.ts" | grep -v flow-params | grep -v OriginLink
```

---

## Quick reference

```tsx
// Destination page:
import { ContextualBackLink } from '@/components/ui/ContextualBackLink'

<ContextualBackLink
  fallbackHref={route.exits.parent()}
  fallbackLabel="Back to people"
/>

// In-place flow completion:
import { useDropFlowParam } from '@/lib/flow-params'

const dropFrom = useDropFlowParam()
// call dropFrom() once the in-place flow finishes
```

Files of interest:

- `lib/flow-params.ts` — `withFrom`, `resolveReturnTo`, `useReturnTo`, `useDropFlowParam`, `useKeepQs`
- `components/ui/OriginLink.tsx` — birth-stage emission for row-click / whole-card targets
- `components/ui/ContextualBackLink.tsx` — canonical adoption point
- For the decision tree across all link primitives, see [`links.md`](links.md)
