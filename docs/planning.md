---
title: Planning
order: 11
category: Process
---

# Planning — Design Flow Specs

Before building a feature, design it as a **flow spec**. A flow spec is a structured document that maps every page, section, navigation edge, and business rule — precise enough that an implementing agent can build the feature without ambiguity.

Flow specs live at `.claude/specs/<feature-name>.md`. The `/design-flow` skill helps create them collaboratively.

---

## Why specs exist

The framework has strong conventions (Pages, Shells, Sections, RouteRegistry, CacheRegistry), but conventions don't answer domain questions: what pages exist, what sections go on each page, what data flows between them, what actions are available, what the state machine looks like.

A flow spec answers those questions once, up front, so the implementing agent doesn't have to guess.

---

## The spec file

A single markdown file with two parts:

### Part 1: Mermaid flow diagram

A visual graph showing the full topology of the feature:

- **PAGE nodes** (blue) — routes with entry URL, params, exits, guards
- **SECTION nodes** (dark) — features with shell, type, data, actions, state, forms, cache
- **Solid arrows** — route navigation between pages (labeled with exit names)
- **Dashed arrows** — local UI actions (drawer/modal opens, return data)
- **Subgraphs** — AnimatedStep multi-step flows (numbered steps, summary bar)
- **Nested subgraphs** (purple) — sub-steps within a step, visually distinct

The diagram is designed to be viewed in [mermaid.live](https://mermaid.live) or any Mermaid renderer.

### Part 2: Companion annotations

Structured sections keyed by node ID, providing the detail the diagram can't hold:

| Section | What it captures |
|---------|-----------------|
| **Pages** | Entry params (Zod schema), search params, named exits with descriptions, layout guards, single/multi-section |
| **Sections** | Full `State` and `Event` discriminated unions as TypeScript, action signatures (input + return types), form fields + validation + capture guard, cache tags + invalidation strategy + optional cacheLife, redirect pattern (with `[reset, form.reset]` for form sections), Suspense fallback fixture (page owns the boundary), deps.ts injection (Type 2), loader hooks (Type 6), return types for spoke sections, rate limiting per action |
| **Shared Cache Tags** | Domain-level `createTagRegistry` definition shared across sections |
| **Domain Types** | Shared TypeScript types referenced across sections (e.g., `UserRef`, `ItemRef`) |
| **Business Rules** | Calculation formulas, constraints, invariants that affect state machine design |
| **Implementation Notes** | File path conventions, exit-to-entry import mapping, rate limiting, shared sections |

---

## Node format reference

### PAGE node

```
Feature Name — PAGE · single-section|multi-section
entry: /path/:param
params: paramName · search: optionalParam?
exits: exitA, exitB, exitC
guard: guardFunction → /redirect/path
```

### SECTION node

```
SectionName [Shell]
Type N · description · 📝 form (if applicable)
───────────
📦 props: what it receives from page
📊 data fetched description
🏷️ tagWith Tag.name(params)
⚡ actionName → invalidate|softInvalidate Tag.name
📝 field1 required, field2 validate(fn)
🔄 status1 → status2 → status3
📐 derives: ComputedTypeName
🔀 useRedirectOnSuccess → exits.name
⏳ fallback: fixtures.key
📥 useXxxLoader (for Type 6)
↩️ returns: TypeName (for spoke sections)
```

### Edge types

| Edge | Syntax | Meaning |
|------|--------|---------|
| Page contains section | `---` solid line | Composition |
| Page contains drawer/modal | `-.-` dashed line | Conditionally shown section |
| Route navigation | `-->` solid arrow | Navigate to another page (label: action + exits.name) |
| Opens drawer/modal | `-.->` dashed arrow | Local UI opens a section |
| Return data | `-.->` dashed arrow | Data flows back to parent (label: `↩️ TypeName`) |
| Step transition | `-->` inside subgraph | Next step in AnimatedStep |

---

## Multi-step flows

Features with multi-step flows (wizards, guided forms) use **AnimatedStep subgraphs**:

```
subgraph FLOW ["FlowName [FullPage] · Type 5 · AnimatedStep"]
    SUMMARY["📋 Summary Bar — collapsible per-step · edit buttons"]
    S1["① Step One"] --> S2["② Step Two"] --> S3["③ Step Three"]
end
```

- Steps are numbered and flow top-to-bottom
- A **Summary Bar** at the top shows completed steps with edit buttons
- **Nested steps** (sub-steps within a step) are a separate subgraph with different styling:

```
subgraph NESTED ["Step detail — nested steps"]
    N1["Sub-step A"] --> N2["Sub-step B"]
end
S2 -.-> NESTED
NESTED -.->|"↩️ ResultType"| S2
```

Outer steps use dark blue backgrounds. Nested steps use purple — visually distinct at a glance.

---

## Section type derivation

Don't memorize type numbers. Derive the type from properties:

| Does it... | Server | Client |
|------------|--------|--------|
| Just render props | Type 1 | — |
| Fetch data | Type 2 | Type 6 (via useXxxLoader) |
| Have a mutation form | Type 3 | Type 5 |
| Have local state only | — | Type 4 |

Key signals:
- Needs interactivity, animations, or local state? → client
- Parent is a client component? → client (Type 6 for data loading)
- Has a `<form>` with server action? → add form indicator
- Fetches AND can be mutated? → needs cache tags

---

## The planning process

### Order of operations

1. **Map pages** — what URLs exist, how does the user navigate between them
2. **Fill sections** — what sections each page contains, what shells wrap them
3. **Detail each section** — data, actions, state machine, forms, cache
4. **Handle multi-step flows** — AnimatedStep subgraphs with nested steps
5. **Define domain types** — shared types and business rules
6. **Validate** — audit the spec against the architecture docs
7. **Save** — write to `.claude/specs/<feature-name>.md`

### Validation

Before the spec is final, it must be validated against the current architecture docs. The validator checks:

- **Architecture compliance** — section types match properties, shells are valid, no raw URLs, actions don't redirect, forms use three-hook pattern with capture guard, form fields are not in State unions
- **Completeness** — every page has entry/exits/guard, every section has states, every fetch has tags, every action has invalidation strategy, every form lists fields and redirect resets (`[reset, form.reset]`), domain types are defined, deps.ts noted for Type 2, transition guards have name/duration/grant/isActive
- **Implementation readiness** — could the implementing agent build each piece without guessing? Are file paths determinable? Are exit-to-entry imports clear?

The validator reads the current docs, not a static checklist. If the architecture evolves, the validation evolves with it.

---

## Implementation handoff

The implementing agent reads the spec top-to-bottom and works through it using:

1. **`/scaffold-route`** for each PAGE node — generates `entry.ts`, `contract.ts`, `page.tsx`, `layout.tsx`
2. **`/scaffold-section`** for each SECTION node — generates the section folder with appropriate flags (`--client`, `--fetches`, `--mutates`)
3. **Fill in domain code** from the companion annotations — state types, transitions, actions, queries, form fields

The spec covers UI flow, domain types, and business rules. The implementing agent derives the DB schema and migrations from the domain types.

---

## Checklist

Before handing off a spec:

```
□ Every page has entry URL, params, exits, and guard
□ Every section has shell, type, data, actions, state machine
□ Every fetching section has cache tags
□ Every action has invalidation strategy (invalidate vs softInvalidate)
□ Every edge has a type (route exit vs drawer/modal open)
□ Every form lists fields and validation rules
□ Every spoke section has a return type
□ Multi-step flows use AnimatedStep subgraphs with summary bar
□ Domain types are defined for all shared data shapes
□ Business rules and calculations are documented
□ Validation agent found no gaps
```
