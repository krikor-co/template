---
title: Realtime (Pulse)
order: 15
category: Infrastructure
---

# Realtime — the Workspace Pulse

Cheap in-session liveness without websockets or extra infra: mutations bump a
per-workspace version row; an SSE endpoint polls that row and nudges open
dashboards; nudged clients call `router.refresh()` and re-run their **own**
scoped queries. The event carries no data — it is a doorbell, not a payload.

Cache tags (see `caching.md`) handle request-time freshness. The pulse handles
the other half: a screen that is already open when *someone else* changes the
data.

## The pieces

| Piece | File | Role |
|---|---|---|
| `workspace_pulse` table | `db/schema/workspace-pulse.ts` | One row per workspace: `version` bigint + `last_event` label |
| `bumpWorkspacePulse` / `pulseE` | `lib/realtime/pulse.ts` | Best-effort upsert `version = version + 1` |
| `readWorkspacePulse` | `lib/realtime/pulse.ts` | `{ version, lastEvent }` — what the stream polls |
| SSE route | `app/api/workspace/[workspaceId]/stream/route.ts` | Member/admin-gated stream: `ready` → `pulse` events, heartbeats |
| `<WorkspaceLive>` | `lib/realtime/WorkspaceLive.tsx` | Client: EventSource → `router.refresh()` on pulse |

## Bumping from a mutation

Inside an Effect action pipe, after the write and the cache invalidation:

```ts
import { pulseE } from '@/lib/realtime/pulse'

pipe(
  Effect.Do,
  Effect.tap(() => requireWorkspaceRoleE(workspaceId, 'owner')),
  Effect.bind('row', () => dbE.run(/* the write */)),
  // Nudge other open sessions. NEVER fails — pulseE swallows its own errors,
  // so a pulse outage cannot fail the mutation.
  Effect.tap(() => pulseE(Number(workspaceId), 'record.updated')),
  // ...
)
```

Outside Effect, `await bumpWorkspacePulse(id, 'event.name')` — same guarantee.
The event label is for debugging (`last_event` column), not for clients.

## Receiving

Mount once per workspace-scoped area (layout or page):

```tsx
import { WorkspaceLive } from '@/lib/realtime/WorkspaceLive'

<WorkspaceLive workspaceId={workspaceId} />
```

It renders nothing. On `pulse` it calls `router.refresh()` — server components
re-run their own queries under the viewer's own session, so **authorization
holds by construction**: the stream never transports data across users.

## Guarantees & caveats

- **Best-effort, at-least-nothing:** a failed bump logs and moves on. Never
  put the pulse before the write, and never await it as a success condition.
- **Auth:** the SSE route 401s without a session and 403s unless the caller
  is a member of the workspace (`getUserWorkspaces`) or a platform admin.
- **Polling cadence:** the stream polls every 3s (`POLL_MS`) — that is the
  worst-case staleness between devices.
- **Function limits:** the stream closes itself at 280s (`MAX_MS`), just
  under the 300s platform ceiling; the browser's `EventSource` reconnects
  automatically. Expect a reconnect blip every ~4.5 minutes.
- **Cost:** one held connection + one indexed single-row SELECT per 3s per
  open dashboard. Fine for team-sized tenants; for thousands of concurrent
  viewers move to a push provider and keep this API shape.
