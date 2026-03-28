Create a new route following the RouteRegistry pattern from this project's architecture.

## What you will create

For the route described in $ARGUMENTS (or ask if not provided):

1. `entry.ts` — defines the URL shape and how to parse it
2. `contract.ts` — wires entry + exits into a typed route contract
3. `page.tsx` — Next.js async server component that parses the URL and renders scenes

## Requirements

Before writing any code, determine:
- **Route path**: what is the URL pattern? (e.g. `/bookings/list`, `/bookings/[id]/edit`)
- **Params**: what typed parameters does this route accept? (search params, path params, or none)
- **Exits**: what routes can the user navigate to from here? (list the names and destinations)
- **Shell type**: FullPage, Card, Modal, or Drawer? (ask if not obvious from context)

## File patterns to follow exactly

### `entry.ts`
```typescript
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

const schema = z.object({
  // define params here — use z.coerce.number() for numeric, z.string().optional() for optional
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params) => `/your-path?param=${p.param}`,
  parse: (ctx: ParseContext) => schema.parse(ctx.searchParams),
}
```

### `contract.ts`
```typescript
import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
// import { entry as xyzEntry } from '../xyz/entry'  ← neighbor entries only, NEVER their contracts

export const route = createRoute({
  entry,
  exits: {
    // exitName: neighborEntry.href,
    // or inline: exitName: (p: { id: string }) => `/path/${p.id}`,
  },
})
```

### `page.tsx`
```typescript
import { cookies } from 'next/headers'
import { route } from './contract'
import { Shell } from '@/lib/shell'
// import scene components and their query functions

type Props = {
  params:       Promise<Record<string, string>>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PageName({ params, searchParams }: Props) {
  const ctx = {
    params:      await params,
    searchParams: await searchParams,
    cookies: Object.fromEntries((await cookies()).getAll().map(c => [c.name, c.value])),
  }
  const entry = route.entry.parse(ctx)

  return (
    <Shell.FullPage title="Page Title">
      {/* TODO: add scene components here */}
    </Shell.FullPage>
  )
}
```

## Rules — never break these

- Never write raw URL strings in `href`, `router.push`, or `redirect` calls
- `entry.ts` must never import a neighbor route's `contract.ts` or `page.tsx`
- `contract.ts` imports only neighbor `entry.ts` files — never their contracts
- `page.tsx` uses `route.entry.parse(ctx)` for all URL parsing — never `searchParams.get()` directly
- Path params come from `ctx.params`, search params from `ctx.searchParams`

## After creating the files

Tell the user:
- What files were created and where
- What scenes still need to be created (offer to run `/scaffold-scene` for each)
- What neighbor routes need their contracts updated to add an exit to this new route
