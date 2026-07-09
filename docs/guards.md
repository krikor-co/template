---
title: Guards
order: 6
category: Patterns
---

# Layout Guards & Transition Guards

## Layout guards

Layouts act as middleware in this framework. Each layout runs before its children render and can redirect the user based on server-side state (session, cookies, feature flags). This keeps guard logic colocated with the routes it protects.

```typescript
// app/auth/verify/layout.tsx
import { canVerify } from '@/app/auth/guards'
import { redirect } from 'next/navigation'

export default async function VerifyLayout({ children }: { children: React.ReactNode }) {
  const to = await canVerify()
  if (to) redirect(to)
  return <>{children}</>
}
```

Guard functions return `string | null` — a redirect target or `null` if the user can stay. They live in the feature layer (e.g. `app/auth/guards.ts`), never in `lib/`, because they import route entries from `app/`.

## The problem: exit animations

Server-side guards react instantly to state changes. When an action sets a session cookie and returns success, the layout re-evaluates on the next request and redirects immediately. But the client may need time to play a success animation before navigating away.

## Transition guards

`createTransitionGuard` from `lib/transition.ts` solves this by granting a short-lived cookie that tells the layout guard "hold off — the client is transitioning."

```typescript
import { createTransitionGuard } from '@/lib/transition'

// In your feature's guards file:
export const transitions = {
  verify: createTransitionGuard('auth_verify', 2000),
}
```

**In the server action** — grant the transition before returning:

```typescript
// actions.ts
await transitions.verify.grant()   // sets a cookie that expires in 2 seconds
return { success: true }
```

**In the client section** — map the result to a route and navigate after animation:

```typescript
// The section receives { success: true } from the action.
// It maps the result to a URL using its own contract's exits:
//   send({ type: 'SUCCESS', redirectTo: returnTo ?? route.exits.dashboard() })
// The section transitions to 'success' state, plays a 1.5s animation,
// then calls router.push(state.redirectTo).
// The transition cookie expires after 2s, so the layout doesn't interfere.
```

**In the layout guard** — check if a transition is active:

```typescript
// layout.tsx or guards.ts
if (await transitions.verify.isActive()) return null  // let the client finish its animation
```

## Rules

- Transition duration should exceed the animation duration by a small margin (e.g. 2000ms cookie for a 1500ms animation).
- `grant()` is called in the server action, not in the client — the cookie is set server-side.
- `isActive()` is checked in layouts/guards — it is a server-only API.
- Transition guards are a framework utility (`lib/transition.ts`); the specific transitions are defined in the feature layer (e.g. `app/auth/guards.ts`).

## Cookie-based returnTo

Auth flow metadata like `returnTo` travels via cookies, not URL params. This keeps layouts simple — they never need `searchParams` (which layouts don't receive in Next.js App Router).

The external entry point (`/auth/identify?returnTo=/bookings`) reads the param and passes it as a prop to the section. The **server action** (not the page) persists it to a cookie — pages and layouts cannot set cookies in Next.js.

```typescript
// app/auth/identify/page.tsx — reads, passes as prop
const entry = route.entry.parse({ params: {}, searchParams: sp, cookies: {} })
return <LoginForm initialState={fixtures.idle} returnTo={entry.returnTo} />
```

```tsx
// LoginForm.tsx — passes returnTo as hidden field
<form action={handleSubmit}>
  {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
  ...
</form>
```

```typescript
// actions.ts — server action sets the cookie
if (returnTo) {
  cookieStore.set(AUTH_RETURN_TO_COOKIE, returnTo, { ... })
} else {
  cookieStore.set(AUTH_RETURN_TO_COOKIE, '', { path: '/', maxAge: 0 })
}
```

Downstream guards and the final verify action read from the cookie. The verify action clears it on success:

```typescript
// app/auth/verify/actions.ts
const returnTo = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value
cookieStore.set(AUTH_RETURN_TO_COOKIE, '', { path: '/', maxAge: 0 })
return { success: true }
```

Internal auth routes (`/auth/verify`, `/auth/register`) don't need a `returnTo` param — the cookie carries it through the entire flow.

## Throw-based data guards

Beyond redirect-returning layout guards, guards that server **actions** share
with layouts are throw-based: `requireXxx()` either passes or throws a
`XxxGuardError` carrying `reason: 'unauthenticated' | 'forbidden'`.

| Guard | Error class | Lives in | Checks |
|-------|-------------|----------|--------|
| `requireSession()` | `SessionGuardError` | `lib/auth/session.ts` | valid session exists |
| `requireWorkspaceRole(workspaceId, role)` | `WorkspaceGuardError` | `app/workspace/guards.ts` | active membership with one of `role` (string or array) on an active workspace |
| `requireAdmin()` | `AdminGuardError` | `app/admin/guards.ts` | `users.role === 'admin'` (platform-wide, not workspace-scoped) |

The `unauthenticated` / `forbidden` split is intentional UX: unauthenticated →
send to login; forbidden → show no-permission copy. Layouts catch and redirect:

```typescript
// app/workspace/[workspaceId]/layout.tsx
try {
  await requireWorkspaceRole(workspaceId, ['owner', 'member'])
} catch (e) {
  if (e instanceof WorkspaceGuardError && e.reason === 'unauthenticated') {
    redirect(route.exits.login({ workspaceId }))
  }
  redirect(route.exits.dashboard())
}
```

Server actions never try/catch — they use the Effect adapters in
`lib/effect/auth.ts` (`requireSessionE`, `requireWorkspaceRoleE`,
`requireAdminE`), which map the guard errors to typed `Unauthenticated` /
`Forbidden` failures inside the pipe.

## Suspense guard shells

Guard checks are uncached I/O — `cookies()`, the sessions-table lookup,
membership queries. Under Next 16 Cache Components, a layout that `await`s
that I/O at its top level **blocks route navigation**: nothing paints until
the guard resolves. Gated layouts therefore use a three-part shape:

```
sync layout  →  <Suspense fallback={<Fallback/>}>  →  async shell
                                                       (uncached I/O +
                                                        redirect inside
                                                        the boundary)
```

1. The **layout is sync** and returns immediately — navigation streams at
   once.
2. An **async shell child** does every uncached read (guard, providers,
   chrome data) and calls `redirect()` on failure. `redirect()` works when
   thrown inside a Suspense boundary.
3. The **fallback is footprint-matched**: it mirrors the shell's outer frame
   (same max-width / padding / grid skeleton) so the fallback → content swap
   doesn't shift layout.

Worked example — the template's own `/dashboard` chokepoint
(`app/dashboard/layout.tsx`), pairing the shape with the throw-based
`requireSession` guard (see "Throw-based data guards" above):

```tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { requireSession, SessionGuardError } from '@/lib/auth/session'
import { route } from './contract'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardGuardFallback />}>
      <DashboardGuard>{children}</DashboardGuard>
    </Suspense>
  )
}

async function DashboardGuard({ children }: { children: React.ReactNode }) {
  try {
    await requireSession()
  } catch (err) {
    // Only the guard's own sentinel maps to a redirect — anything else is a
    // real bug and must surface, not silently bounce users to login.
    if (err instanceof SessionGuardError) redirect(route.exits.login())
    throw err
  }
  return <>{children}</>
}

function DashboardGuardFallback() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12" aria-busy="true">
      <div className="space-y-8">
        <div className="h-24 w-2/3 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </main>
  )
}
```

Rules:

- Never `await` guard I/O in the layout body — always inside the Suspense'd
  child.
- Catch only your own guard error (`instanceof XxxGuardError`); **rethrow
  everything else** so real failures surface instead of masquerading as
  auth bounces.
- Keep the fallback in the same file, footprint-matched to the area's frame.
  A `min-h-screen` spinner that doesn't match the frame causes a visible
  jump on every navigation into the area.
- The same shape applies to gated **pages** that redirect — the `/dashboard`
  dispatcher (`app/dashboard/page.tsx`) and the workspace home
  (`app/workspace/[workspaceId]/page.tsx`) resolve their uncached I/O inside
  their own Suspense children for the same reason.
- As a gated layout grows chrome (sidebar, providers), the chrome moves into
  the async shell too — guard first, then chrome data, one boundary.
