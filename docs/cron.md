---
title: Cron Jobs
order: 16
category: Infrastructure
---

# Cron Jobs

Background jobs that don't belong inside a user request — retention sweeps,
periodic recomputes, scheduled cleanups — live as `POST` route handlers under
`app/api/cron/<name>/route.ts`. They're invoked by an external scheduler
(Vercel Cron, cron-job.org, a Linux cron, etc.) over HTTP, gated by a shared
secret.

This file explains the convention + lists every cron job in the repo + shows
how to add a new one.

## The convention

Every cron job:

1. Lives at `app/api/cron/<name>/route.ts`.
2. Exports `POST(req: Request)`. The ONLY permitted `GET` is the gated alias
   `export const GET = POST` — Vercel Cron invokes via GET; the alias runs the
   exact same `CRON_SECRET`-checked handler, so a casual visitor still can't
   trigger it.
3. First line: `const denied = requireCronAuth(req); if (denied) return denied`
   (`lib/cron/auth.ts`). Fails closed (401) if `CRON_SECRET` is unset, 403 if
   the header doesn't match. Accepts both `x-cron-secret: <secret>` and
   `Authorization: Bearer <secret>`.
4. Returns `NextResponse.json({ ok: true, ...metrics })` on success; the
   metrics fields (e.g. `deleted: N`) help with observability.
5. Idempotent — safe to run twice in a row, safe to run during a deploy. No
   state in route-handler memory between calls.
6. Bounded — never scan or mutate without a `WHERE created_at < ...` or
   similar predicate, and chunk big deletes. Don't delete `WHERE 1=1`.
7. Documented here.

## Setup

### 1. Pick a `CRON_SECRET`

Generate one (any 32+ character string is fine):

```bash
openssl rand -hex 32
```

Add to `.env` (and to your production env via your hosting provider's secrets
UI). If you never set it, every cron route returns
`401 { ok: false, error: 'CRON_SECRET not configured' }` — fails closed.
Rotate it any time by updating both the env var and your scheduler config.

### 2. Wire to a scheduler

#### Vercel Cron (recommended on Vercel)

`vercel.json` at the repo root ships with an empty `crons` array. Add entries:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/purge-spans", "schedule": "0 3 * * *" }
  ]
}
```

Vercel invokes the path via **GET** (hence the gated alias) and forwards
`Authorization: Bearer $CRON_SECRET` automatically once `CRON_SECRET` is set
in the project env — `requireCronAuth` accepts that convention as-is.

#### cron-job.org / EasyCron / external scheduler

```
POST https://<your-domain>/api/cron/purge-spans
Header: x-cron-secret: <your CRON_SECRET>
Schedule: every day at 03:00 UTC
```

#### Local dev (manual)

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/purge-spans
```

## Job catalog

### `purge-spans`

| | |
|---|---|
| **Path** | `/api/cron/purge-spans` |
| **Source** | `app/api/cron/purge-spans/route.ts` |
| **Schedule** | Daily at 03:00 (recommended) |
| **What it does** | Deletes rows from `trace_span` older than 30 days, in `LIMIT 5000` chunks |
| **Why** | OTel spans accumulate fast (every server action + cached query writes one). Without retention, the table grows unbounded |
| **Returns** | `{ ok: true, deleted, batches, retentionDays, hitMaxBatches }` |
| **Configurable** | `RETENTION_DAYS` / `CHUNK_SIZE` / `MAX_BATCHES` consts at the top of the route file |

If you skip wiring this and the table grows too large, run manually:

```sql
DELETE FROM trace_span WHERE created_at < NOW() - INTERVAL '30 days';
```

## Per-tenant local-hour fan-out

For a job that must run "at each tenant's own 08:00" (digests, reminders):
schedule ONE hourly cron (`"0 * * * *"`) and gate per tenant with
`lib/cron/local-hour.ts`:

```ts
import { dueAtLocalHour } from '@/lib/cron/local-hour'

// rows: [{ workspaceId, timeZone, sendHourLocal }, ...] from your pref table
const due = dueAtLocalHour(
  rows.map((r) => ({ tenant: r, timeZone: r.timeZone, sendHourLocal: r.sendHourLocal })),
)
for (const r of due) {
  // assemble + send for r.workspaceId only
}
```

Every tenant fires exactly once a day at its own wall-clock hour, DST handled
by the IANA zone database (`partsInZone`, `lib/time/zoned.ts`); invalid zones
fall back to UTC rather than crashing the sweep. Two useful escape hatches
from the pattern's origin: support `?<tenant>Id=` to bypass the hour gate for
a manual single-tenant run, and `?dryRun=1` to assemble without sending.

## Adding a new cron job

```bash
mkdir -p "app/api/cron/<name>"
touch    "app/api/cron/<name>/route.ts"
```

Template:

```ts
// app/api/cron/your-job/route.ts
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { requireCronAuth } from '@/lib/cron/auth'

export async function POST(req: Request) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  // Your bounded work here. Always include a WHERE / LIMIT.
  const result = await db.execute(sql`...`)
  const affected = (result as unknown as { rowCount?: number }).rowCount ?? 0

  return NextResponse.json({ ok: true, affected })
}

// Vercel Cron invokes via GET; alias to the same handler (CRON_SECRET-gated).
export const GET = POST
```

Then:
1. Add an entry to **Job catalog** above.
2. Wire it to your scheduler (`vercel.json` `crons` on Vercel).
3. Test locally with curl before deploying.

## Observability

Cron runs go through the same OTel tracing as everything else — spans land in
`trace_span`. To inspect recent runs:

```sql
SELECT name, status, duration_ms, error_message, created_at
FROM trace_span
WHERE name LIKE '%cron%' OR attributes->>'http.target' LIKE '/api/cron/%'
ORDER BY created_at DESC LIMIT 20;
```

Set up a separate alert (Slack webhook, email, whatever) on `status = 'error'`
rate spikes to catch crons silently failing.

## Anti-patterns to avoid

- **No auth.** Don't ship a cron route that anyone on the internet can `POST`.
  The `requireCronAuth` check is mandatory and comes first.
- **Ungated `GET` handlers.** A `GET` can be hit by a browser, a bot, or a
  link prefetcher. The only `GET` allowed is the `export const GET = POST`
  alias — same secret gate, needed because Vercel Cron invokes via GET.
- **Unbounded deletes/updates.** Always include a `WHERE` predicate that
  limits scope, and chunk big mutations (see purge-spans' ctid pattern).
- **Long-running synchronous work.** If the job needs >30s, chunk it (process
  N rows at a time, requeue) or move to a real background worker
  (BullMQ/Inngest/Trigger.dev).
- **State in module-level variables.** Route handlers can be called by
  multiple instances; in-memory state doesn't survive deploys or replicas.
- **Reads from `cookies()`/`headers()` for user context.** Crons run
  unauthenticated by design — they're system jobs. If you need to act *as a
  user*, look the user up via the DB and pass them through your domain
  functions explicitly.
