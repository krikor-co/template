Create a new section component based on the user's description: $ARGUMENTS

## Step 1: Determine section type and flags

Based on the description, determine:
- `--client` — needs interactivity, state machine, `'use client'`
- `--fetches` — loads data from the server
- `--mutates` — has a form or triggers a server action

## Step 2: Generate boilerplate

Run the CLI generator with the appropriate flags:

```bash
npx tsx tools/cli/index.ts g section <path> [--client] [--fetches] [--mutates]
```

This creates the skeleton files (state.ts, fixtures.ts, Component.tsx, stories, and optionally transition.ts, scene.ts, actions.ts, etc.) with TODOs.

## Step 3: Fill in the generated files

Edit each file to replace TODOs with real code based on the user's description:

### `state.ts`
- Define the actual State variants this section needs (the generator provides idle/submitting/error/success as a starting point for client sections)
- Add domain data to states that carry it (e.g., `{ status: 'loaded'; items: Item[] }`)
- Add any extra events beyond the defaults
- Input field values (email, name, code, etc.) are NEVER in State — they belong in `useFormValues`
- Data displayed but not editable (e.g., email from props) CAN be in State

### `transition.ts`
- The generator provides the standard idle/submitting/error/success transitions
- Add any domain-specific transitions (e.g., SELECT, CLEAR, LOADED)
- Keep switching on `state.status`, then checking `event.type`

### `fixtures.ts`
- Replace `/TODO` redirectTo with a real path (use `route.exits.*()` if available)
- Add domain data to fixtures that need it
- One fixture per State variant — keep error messages generic

### `actions.ts`
- Replace `submitAction` with a descriptive name (e.g., `createBooking`, `sendVerificationCode`)
- Define the Zod validation schema for the FormData fields
- Implement the actual DB mutation / API call
- Add cache invalidation: `invalidate(Tag.xxx())` for immediate, `softInvalidate(Tag.xxx())` for eventual
- Return domain data — never call `redirect()`, never import route contracts

### `Component.tsx`
For client+mutates (form sections), the generator provides the three-hook pattern. Fill in:
- Replace `TODO` comments with actual form fields using `defaultValue={form.values.xxx}`
- Wire `route.exits.xxx()` into the `SUCCESS` dispatch
- Add `onChange={() => { if (state.status === 'error') send({ type: 'RETRY' }) }}` on inputs
- Mirror the active form fields in the success arm (disabled)
- Import and use `Input`, `Button`, `Label` from `@/components/ui/`

For client without mutates, fill in:
- The actual UI for each state arm
- Wire navigation via `route.exits.*()` where needed

### `Component.stories.tsx`
- Already generated with correct structure — update if you added custom props beyond `initialState`

### `query.ts` (if generated)
- Replace `Tag.TODO({})` with the real cache tag
- Implement the actual DB query
- Return the correct State variant

### `tags.ts` (if generated)
- Define the actual tag resolvers for this domain

### `useXxxLoader.ts` (if generated)
- Uncomment and implement the loading logic
- Wire the correct server action and event dispatches

## Rules

- Every non-primitive component is a section — no exceptions
- State must be a discriminated union — every status is explicit and exhaustive
- Component body = `switch (state.status)` only
- Input field values are NEVER scene state — they belong in `useFormValues`
- `useState`, `useEffect`, and all React hooks live only in custom hook files
- Actions never call `redirect()` — return domain data
- Actions never import route contracts — return domain results
- `<form action={handleSubmit}>` — never `onSubmit`
- `defaultValue={form.values.xxx}` on all inputs — never controlled `value` unless cross-field validation
