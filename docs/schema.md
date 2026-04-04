---
title: Schema Design
order: 11
category: Principles
---

# Schema Design

One principle drives every table definition in this codebase:

> **Model what the entity IS before modeling what it does in the system.**

---

## The principle

Before a person is a `user`, a `customer`, or a `professional` — they are a person. That fact exists independently of any role the system assigns them.

This means the base entity (`person`) is defined first, with only the attributes that are universally true about it. System roles (`user`, `customer`, `professional`) are separate tables that reference the base entity and carry only role-specific data.

```
persons                        ← what the entity IS
  id, email, name, ...

users → persons.id             ← system role: can authenticate
  id, personId, ...

customers → persons.id         ← system role: receives services
  id, personId, notes, ...

professionals → persons.id     ← system role: performs services
  id, personId, hireDate, ...
```

A person can be a customer and a professional simultaneously — two rows in two tables pointing to the same person. No nullable columns. No role flags. No cramming unrelated attributes into one table.

---

## Why this matters

When you model roles directly on a single `users` table:

```typescript
// ❌ role-first — the system's view imposed on the entity
export const users = pgTable('users', {
  id:            ...,
  email:         ...,
  hireDate:      ...,   // null if not a professional
  customerNotes: ...,   // null if not a customer
  role:          ...,   // enum: 'user' | 'customer' | 'professional'
})
```

You end up with nullable columns that have meaning only for some rows, and a `role` column that breaks the moment one person needs two roles.

When you model what the entity IS:

```typescript
// ✅ entity-first — reality reflected in the schema
// persons.ts — the human being
export const persons = pgTable('persons', {
  id:    integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email: text('email').notNull().unique(),
  name:  text('name'),
  ...
})

// professionals.ts — the employment relationship
export const professionals = pgTable('professionals', {
  id:       integer('id').primaryKey().generatedAlwaysAsIdentity(),
  personId: integer('person_id').notNull().references(() => persons.id),
  hireDate: date('hire_date'),
  status:   text('status').notNull().default('active'),
  ...
})
```

Every column in every table is always meaningful. Queries are honest. The schema reflects the world.

---

## Apply it to any entity

Ask yourself: **what is this thing before my system gets involved?**

- A `video` is a video before it's "content in a collection"
- An `appointment` is an appointment before it's "a booking in your calendar"
- A `product` is a product before it's "an item for sale"
- A `document` is a document before it's "an attachment on a record"

Model the real-world entity first. Then model its relationship to your system.

---

## Conventions

Every table follows these conventions:

**Primary keys**: auto-increment integers — `integer('id').primaryKey().generatedAlwaysAsIdentity()`

**Timestamps**: every table has `createdAt`. Add `updatedAt` when the table's rows are mutable (edited after creation).

**Soft deletes** (opt-in): add `deletedAt` when the domain requires recoverability or audit trails. Start without it — add it when the need arises.

```typescript
// Minimal table — immutable or rarely updated
export const things = pgTable('things', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  // ... domain columns ...
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// With updatedAt — rows are edited after creation
export const editableThings = pgTable('editable_things', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  // ... domain columns ...
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// With soft deletes — domain requires recoverability
export const recoverableThings = pgTable('recoverable_things', {
  id:        integer('id').primaryKey().generatedAlwaysAsIdentity(),
  // ... domain columns ...
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
})
```

The template starts simple — `persons`, `users`, and `sessions` use only `createdAt`. Add `updatedAt` and `deletedAt` as complexity demands it.

**Foreign keys reference roles, not base entities** — domain tables reference the role that is relevant to the domain:

```typescript
// ✅ transaction references customer — the role, not the person
transaction.customerId → customers.id

// ❌ would skip the semantic layer
transaction.personId → persons.id
```

---

## In the template

The template starts with `persons` + `users`. Every new project adds role tables as the domain requires.

`persons` → universal base identity
`users` → the auth role (can log in, has a session)

Other roles (`customers`, `professionals`, etc.) are created per-project via `/scaffold-feature`.
