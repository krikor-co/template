Build a complete feature from a plain-English description.

Given: $ARGUMENTS

## Your process — follow this order exactly

### Step 1 — Declarative Flows: enumerate actions first

Before writing any code, list what the user is allowed to DO in this feature. These become state machine events.

Example for "bookings CRUD":
- View list of bookings (paginated)
- Search bookings by name
- Delete a booking
- Navigate to create a new booking
- Fill in and submit a new booking form
- Navigate back from form to list

Each action → one or more `Event` types in the relevant scene.

### Step 2 — Enumerate routes

From the actions, determine what routes are needed:
- List/index page? → `app/[feature]/list/`
- Create page? → `app/[feature]/new/`
- Detail/edit page? → `app/[feature]/[id]/edit/`
- Any other focused URL? → its own route

### Step 3 — Enumerate scenes per route

For each route, what scenes does it need?
- One main scene per route is common
- Multi-section pages may have several Card-wrapped scenes

For each scene, determine its type:
- Server only (no interactivity) → `state.ts + fixtures.ts + Component.tsx + deps.ts + query.ts + tags.ts`
- Client with mutations → add `transition.ts + scene.ts + actions.ts`
- Client with loader → add `useXxxLoader.ts + server action loader`

### Step 4 — Define the schema

Before writing any table, ask: **what is this entity in the real world, before the system assigns it a role?**

Model the real-world entity first. System roles and domain-specific attributes go in separate tables that reference it.

```
// A booking is a booking before it's "a record in the system"
bookings: id, customerId → customers.id, professionalId → professionals.id, ...

// A customer is a person before they're a customer
customers: id, personId → persons.id, notes, ...

// Never collapse what something IS with what it DOES in your system
```

**Schema conventions — every table:**
- Integer PK: `integer('id').primaryKey().generatedAlwaysAsIdentity()`
- `createdAt` + `updatedAt` timestamps on every table
- `deletedAt` for soft delete on all domain tables (omit only on pure join tables)
- Foreign keys reference the role relevant to the domain, not the base entity

```typescript
export const bookings = pgTable('bookings', {
  id:             integer('id').primaryKey().generatedAlwaysAsIdentity(),
  customerId:     integer('customer_id').notNull().references(() => customers.id),
  professionalId: integer('professional_id').notNull().references(() => professionals.id),
  // ... domain columns ...
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
  deletedAt:      timestamp('deleted_at'),
})
```

Then create `lib/[domain]/`:
- `tags.ts` — shared `createTagRegistry` for this domain
- `get-[entity].ts`, `get-[entities].ts` — read functions
- `create-[entity].ts`, `update-[entity].ts`, `delete-[entity].ts` — write functions

### Step 5 — Build routes (entry + contract + page)

For each route:
1. `entry.ts` with Zod schema, `Params` type, `href` + `parse`
2. `contract.ts` with `createRoute({ entry, exits: { ... } })`
3. `page.tsx` parsing URL via `route.entry.parse(ctx)`, wrapping scenes in shells

Wire exits between routes:
- List → New: `exits: { new: newEntry.href }`
- New → List: `exits: { back: listEntry.href, saved: listEntry.href }`
- List → Detail: `exits: { detail: detailEntry.href }`

### Step 6 — Build scenes

For each scene, create all appropriate files following the scene patterns.

### Step 7 — Wire cache tags

Every scene that fetches uses `tagWith(Tag.x(...))` in its `query.ts`.
Every scene that mutates calls `invalidate(Tag.x(...))` in its `actions.ts`.
Use the shared `lib/[domain]/tags.ts` so invalidation is consistent across all scenes.

---

## Rules — never break these

**Declarative Flows**
- Start from what the user can DO — actions first, UI second
- Every action in your Step 1 list must map to at least one `Event` type somewhere

**Navigation**
- Never write raw URL strings
- `entry.ts` never imports a neighbor `contract.ts`
- All exits use neighbor `entry.href` functions

**Scene**
- Every non-primitive component is a scene
- `State` = exhaustive discriminated union
- Component = `switch (state.status)` only
- `useState`, `useEffect`, hooks → only in `.ts` hook files

**Client boundary**
- Server by default
- `'use client'` only where interactivity is required

**Cache**
- `tagWith` only inside `'use cache'` scope
- `invalidate` in server actions after mutations
- `invalidate(Tag.entity({ id }))` covers entity + parent list

---

## Output format

After building everything, provide:

```
Created routes:
  app/[feature]/list/    — entry.ts, contract.ts, page.tsx
  app/[feature]/new/     — entry.ts, contract.ts, page.tsx

Created scenes:
  [Feature]List          — server scene with fetch, client transitions (search, delete)
  Create[Feature]Form    — client scene with mutation

Created data layer:
  lib/[feature]/tags.ts
  lib/[feature]/get-[feature]s.ts
  lib/[feature]/create-[feature].ts
  lib/[feature]/delete-[feature].ts

DB schema additions:
  [describe any new tables or columns]

Next steps:
  [anything the developer needs to do manually — env vars, migrations, etc.]
```
