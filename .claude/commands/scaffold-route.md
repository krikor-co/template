Create a new route at the path specified by the user: $ARGUMENTS

## Step 1: Generate boilerplate

Run the CLI generator:

```bash
npx tsx tools/cli/index.ts g route <path>
```

This creates `entry.ts`, `contract.ts`, `page.tsx`, and `layout.tsx` with skeleton code.

## Step 2: Fill in the generated files

Based on the user's description, edit the generated files:

### `entry.ts`
- Define the Zod schema with the actual URL params this route needs
- If params come from dynamic route segments, parse from `ctx.params`
- If params come from query string, parse from `ctx.searchParams`
- Build the `href()` function to construct the real URL from params
- For optional params like `returnTo`, conditionally append to the URL string

### `contract.ts`
- Import `entry` objects from sibling routes that this page navigates to
- Wire each exit: `exitName: siblingEntry.href`
- Import only `entry` objects from sibling routes (never their contract.ts)

### `page.tsx`
- Uncomment and wire up `route.entry.parse()`
- Replace the `<p>TODO</p>` with the actual Shell + Section composition
- For multi-section pages, wrap each section in its own `<Suspense>` with fixture fallback
- Pass parsed entry params as props to sections that need them

### `layout.tsx`
- Add guard logic if the route needs access control
- Leave as pass-through if no guards needed

## Rules

- Never write raw URL strings — always use `route.exits.xxx()` or `entry.href()`
- `entry.ts` never imports a neighbor route's `contract.ts`
- Pages never contain business logic, data fetching, or state
- If the route needs access control, implement it in `layout.tsx`
