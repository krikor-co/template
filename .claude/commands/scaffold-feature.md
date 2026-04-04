Build a complete feature from the user's plain-English description: $ARGUMENTS

## Step 1: Understand the feature

Parse the description to identify:
- What routes/pages are needed
- What sections each page contains
- Whether sections fetch, mutate, or both
- What data entities are involved
- What navigation flows exist between pages

## Step 2: Design the data model (if needed)

If the feature needs new database tables:
- Add schema to `db/schema/` following the entity-first pattern (see docs/schema.md)
- Export from `db/schema/index.ts`
- Run `npx drizzle-kit generate` then `npx drizzle-kit push`

## Step 3: Create cache tags (if sections fetch)

Create a shared tag registry for the domain at `lib/<domain>/tags.ts`:

```typescript
import { createTagRegistry } from '@/lib/cache-registry'

export const { Tag, tagWith, invalidate, softInvalidate } = createTagRegistry({
  items: (_: Record<string, never>) => ['items'] as const,
  item:  (p: { id: string })        => ['items', `item:${p.id}`] as const,
})
```

## Step 4: Generate and fill routes

For each page, run the CLI generator then fill in:

```bash
npx tsx tools/cli/index.ts g route <path>
```

Then edit the generated files:
- `entry.ts` — define actual URL params schema and href builder
- `contract.ts` — wire exits to sibling routes
- `page.tsx` — compose Shell + Section, parse URL params
- `layout.tsx` — add guard logic if needed

Wire up exits between routes: each contract imports entry points from routes the user can navigate to.

## Step 5: Generate and fill sections

For each section, run the CLI generator with flags then fill in:

```bash
npx tsx tools/cli/index.ts g section <path> [--client] [--fetches] [--mutates]
```

Then edit the generated files to replace TODOs:
- `state.ts` — add domain-specific state variants and data
- `transition.ts` — add domain-specific transitions (generator provides standard pattern)
- `fixtures.ts` — add domain data, real redirectTo paths
- `actions.ts` — implement validation, mutation, cache invalidation
- `Component.tsx` — add form fields with `defaultValue={form.values.xxx}`, wire `route.exits.*()` into SUCCESS
- `query.ts` — implement DB query, wire real cache tags
- `tags.ts` — define real tag resolvers

## Step 6: Wire pages to sections

Update each `page.tsx` to:
- Import sections and fixtures
- Parse URL with `route.entry.parse()`
- Compose with appropriate Shell types (`Shell.FullPage`, `Shell.Card`, `Shell.Modal`, `Shell.Drawer`)
- Wrap async sections in `<Suspense fallback={<View state={fixtures.empty} />}>`
- Pass parsed entry params as props where needed

## Step 7: Add layout guards (if needed)

If any route needs access control:
- Create guard functions in the feature layer (e.g., `app/<feature>/guards.ts`)
- Apply in `layout.tsx` — layouts are the middleware layer
- Use `createTransitionGuard` from `lib/transition.ts` if exit animations must play before redirect

## Critical rules

- Never write raw URL strings — always `route.exits.xxx()` or `entry.href()`
- Actions never call `redirect()` — return domain data; section maps to routes
- Actions never import route contracts — return domain results
- Input field values are NEVER scene state — they belong in `useFormValues`
- State must be a discriminated union on `status`
- Component body = `switch (state.status)` only
- Server by default — only `'use client'` at the smallest leaf that needs it
- `useState`, `useEffect`, all hooks live only in custom hook files
- Layouts handle access control, never pages or sections
- After mutation, call `invalidate(Tag.xxx())` for immediate freshness or `softInvalidate(Tag.xxx())` for eventual

## Checklist

After building, verify:

```
[ ] Every new URL has entry.ts + contract.ts + page.tsx
[ ] Every non-primitive component has a section folder with state.ts + fixtures.ts
[ ] Every client section has transition.ts + scene.ts
[ ] Every form section uses useFormValues + useRedirectOnSuccess
[ ] Every action returns domain data (never calls redirect)
[ ] Every navigation uses route.exits or entry.href (no raw strings)
[ ] Every fetchable section has query.ts + tags.ts
[ ] Stories exist for every client section
[ ] Cache tags are invalidated after mutations
```
