---
title: Feature Flags
order: 14
category: Patterns
---

# Feature Flags

Three pieces, strictly layered:

| Piece | File | May import |
|-------|------|-----------|
| **Registry** (what exists) | `lib/features/registry.ts` | nothing — PURE DATA, client-importable |
| **Precedence** (pure math) | `lib/features/precedence.ts` | nothing — unit-tested |
| **Resolver** (effective values) | `lib/features/resolve.ts` | db, registry, precedence — `server-only` |
| **Nav gate** (render predicate) | `lib/features/nav-gate.ts` | resolver — `server-only` |

## The registry

`FEATURE_REGISTRY` ships **empty**. Add one `FeatureDef` per feature:

```typescript
{ key: 'workspace.reports', label: 'Reports', group: 'Workspace',
  roles: ['owner'], defaultEnabled: true }
```

Keys are stable and namespaced (`<area>.<feature>[.<sub>]`) — **never rename a
shipped key**; `feature_flag` rows reference it by string. The registry must
stay free of db/server imports so a `'use client'` admin UI can import the
catalog directly.

## Overrides & resolution

The `feature_flag` table stores overrides at three scopes with a check
constraint (`global | workspace | user`) and two partial unique indexes (one
global row per key; one scoped row per `(scope, scope_id, key)`).

Resolution is **most-specific-wins**:

```
user override ▸ workspace override ▸ global override ▸ registry defaultEnabled
```

```typescript
const flags = await resolveFeatureFlags({ workspaceId, userId })  // every key → boolean
const on = await isFeatureEnabled('workspace.reports', { workspaceId })
await setFeatureFlag({ scope: 'workspace', scopeId, featureKey, enabled: false })
await clearFeatureFlag({ scope: 'workspace', scopeId, featureKey })  // fall back to broader scope
```

One query fetches all relevant rows; precedence is applied in JS
(`applyOverrides`). On any DB error the resolver logs and returns registry
defaults — it never throws.

## Nav gating (fail-open)

```typescript
const gate = await createNavGate({ workspaceId, userId })
navItems.filter((item) => gate(item.featureKey))
```

A nav entry is hidden ONLY when its key resolves to exactly `false`. Unmapped
entries, unknown keys, and any failure all SHOW — no wiring bug can ever blank
the navigation.

## Rules

- Flags gate **visibility and access**, not data integrity — never rely on a
  flag to protect a mutation; guards do that.
- Setting a flag never deletes it; `clearFeatureFlag` restores fall-through.
- Check flags server-side (layouts, pages, actions); pass booleans down as
  props.
