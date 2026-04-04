---
title: Routing
order: 2
category: Core
---

# RouteRegistry — Navigation

Every URL in the app has an `entry.ts` and a `contract.ts`. These two files are the complete definition of a route's navigation contract. Never write a raw URL string anywhere else.

## entry.ts

Defines how to enter this route: how to build the URL and how to parse it back into typed params.

```typescript
// app/bookings/list/entry.ts
import { z } from 'zod'
import type { ParseContext } from '@/lib/route-registry'

const schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

export type Params = z.infer<typeof schema>

export const entry = {
  href:  (p: Params) => `/bookings?page=${p.page}`,
  parse: (ctx: ParseContext) => schema.parse(ctx.searchParams),
}
```

## contract.ts

Wires `entry` together with `exits` — the routes this page can navigate to.

```typescript
// app/bookings/list/contract.ts
import { createRoute } from '@/lib/route-registry'
import { entry } from './entry'
import { entry as newEntry }    from '../new/entry'
import { entry as detailEntry } from '../detail/entry'

export const route = createRoute({
  entry,
  exits: {
    new:    newEntry.href,
    detail: detailEntry.href,
  },
})
```

## Usage in components

```typescript
import { route } from './contract'

// In a Link (no async work):
<Link href={route.exits.new({})}>New booking</Link>

// In a client component after async work:
router.push(route.exits.detail({ id: booking.id }))

// In a server action or server component:
redirect(route.exits.detail({ id: booking.id }))

// In page.tsx to parse the URL:
const params = route.entry.parse(ctx)
```

## Rules

- Never write raw URL strings in `href`, `router.push`, or `redirect`.
- Always use `route.exits.*()` or `route.entry.href()`.
- `entry.ts` never imports a neighbor route's `contract.ts` or `page.tsx` — only its own schema.
- `contract.ts` imports only neighbor `entry.ts` files — never their contracts or pages.
- One `contract.ts` per route — it is the single source of truth for that route's navigation.
- **Actions and queries never call `redirect()`** — they return domain data (e.g. `{ success: true, isNew: boolean }`) and the section is responsible for orchestrating the navigation. Actions never import route contracts or entry points — the section maps action results to routes using its own contract's exits. This keeps timing, animation, and sequencing decisions in the component layer where they belong.
