---
title: Multi-Tenancy
order: 13
category: Patterns
---

# Multi-Tenancy — Workspaces

The template's tenant unit is the **workspace**. Everything tenant-scoped hangs
off `workspaces.id`: memberships, invites, feature-flag overrides, audit/trace
rows.

## Data model

| Table | Shape |
|-------|-------|
| `workspaces` | `id`, `name`, `slug` (nullable, unique among non-null — powers host routing), timestamps, `deleted_at` soft delete |
| `workspace_members` | `workspace_id` FK, `user_id` FK, `role` **text**, `unique(workspace_id, user_id)`, soft delete |
| `invites` | `workspace_id` FK, `email`, `role` text, `token` unique (`crypto.randomUUID()`), `status` pending→accepted\|revoked\|expired, `invited_by_user_id`, `expires_at` |

`workspace_members.role` is TEXT, not a pg enum: the template seeds
`'owner' | 'member'` (see `WORKSPACE_ROLES` in `lib/invite/roles.ts`) and apps
extend the vocabulary without a migration. Guards take the required role(s) as
parameters, so new roles need no schema change.

## Guards

Route access control follows the throw-based guard convention (see
`docs/guards.md`):

```typescript
// app/workspace/guards.ts
await requireWorkspaceRole(workspaceId, ['owner', 'member'])  // any member
await requireWorkspaceRole(workspaceId, 'owner')              // owner-only

// app/admin/guards.ts — platform admin (users.role), NOT workspace-scoped
await requireAdmin()
```

One chokepoint layout gates the whole tenant tree:
`app/workspace/[workspaceId]/layout.tsx` calls `requireWorkspaceRole` and
redirects (`unauthenticated` → login with returnTo, `forbidden` → dashboard).

Server actions use the Effect adapters from `lib/effect/auth.ts`:
`requireSessionE()`, `requireWorkspaceRoleE(workspaceId, role)`,
`requireAdminE()` — each maps the guard error to typed
`Unauthenticated` / `Forbidden`.

## Post-login dispatcher

`/dashboard` (`app/dashboard/page.tsx`) resolves `getUserWorkspaces(userId)`
(`lib/workspace/memberships.ts`) and routes:

- **0 memberships** → `/onboarding` (stub route — replace with your
  create-first-workspace flow; platform admins are exempt)
- **exactly 1** → straight into `/workspace/<id>` (no picker)
- **more than 1** → a picker (plain example UI — restyle per app)

All uncached I/O resolves inside a `<Suspense>` child so redirects fire from
within the boundary (Next 16 Cache Components).

## Invites

Role-parameterized, single-use, emailed invites:

1. Your app inserts an `invites` row (`role` from `INVITABLE_ROLES`, token
   `crypto.randomUUID()`, `expires_at` e.g. +7 days) and sends the link with
   `sendInviteEmail` (`lib/invite/send-email.ts`, Resend, localized copy).
2. The invitee opens `/invite/<token>` — a **magic-link accept**: the token is
   the credential, no prior sign-in. The page validates server-side
   (`validateInvite` in `lib/invite/validate.ts` — shared by the loader AND the
   accept action so they can never diverge).
3. Accepting provisions `persons` → `users` → `workspace_members` in one
   transaction, flips the invite to `accepted` **guarded by
   `status = 'pending'` (single-use)**, mints a session, and hard-navigates
   into the workspace.

## Host → workspace middleware

`middleware.ts` rewrites tenant hosts onto the canonical tree:

- `<slug>.<APP_BASE_DOMAIN>` → `/workspace/<id>/…` (slug lookup)
- a verified custom domain → `/workspace/<id>/…` (domain lookup)
- base domain / `www` / `*.vercel.app` / `localhost` → untouched
- framework-owned paths (`/workspace`, `/auth`, `/dashboard`, `/onboarding`,
  `/invite`, `/docs`, `/admin`) → untouched even on a tenant host. These are
  the layout guards' escape routes — an unauthenticated visitor on a tenant
  host must still reach `/auth/identify`. Rules live in
  `lib/tenant/rewrite-path.ts` (unit-tested); keep the list in sync with the
  top-level `app/` areas.

> **NOT a security boundary.** Host resolution only decides WHICH workspace's
> pages a host shows. The workspace layout guards remain the wall — a spoofed
> `Host` header only ever reaches what its session may access.

The resolver is pluggable (`createHostResolver({ baseDomain, reserved,
lookupSlug, lookupDomain, cacheTtlMs })` in `lib/tenant/resolve-host.ts`) and
caches results (including misses) in-process for **60s**. Reserved labels
(`www`, `app`, `api`, …) never resolve as slugs. In dev,
`<slug>.localhost:3000` works out of the box (`APP_BASE_DOMAIN` defaults to
`localhost`).

## Custom domains

The template ships `lookupWorkspaceByDomain` as a documented null stub
(`lib/tenant/lookups.ts`). To let workspaces bring their own domain:

1. Add a `workspace_domains` table (`workspace_id` FK, `domain` unique,
   `verified` boolean, `deleted_at`).
2. Query it in `lookupWorkspaceByDomain` (`lower(domain) = host`, verified,
   not deleted).
3. Provision + verify the domain on Vercel with the typed client in
   `lib/vercel/domains.ts` (`addProjectDomain` / `getProjectDomain` /
   `verifyProjectDomain` / `removeProjectDomain`). Every function degrades to
   `{ ok: false, reason: 'unconfigured' }` when `VERCEL_TOKEN` /
   `VERCEL_PROJECT_ID` are absent, so the surface works in local dev with no
   Vercel project at all.
