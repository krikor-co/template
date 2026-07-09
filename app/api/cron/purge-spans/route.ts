import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { traceSpan } from '@/db/schema'
import { requireCronAuth } from '@/lib/cron/auth'

/**
 * Daily-ish trace_span retention job.
 *
 * Wire to whichever scheduler you have — see `docs/cron.md` for setup.
 *
 * Auth: `requireCronAuth` (lib/cron/auth.ts) — fail-closed on missing
 * CRON_SECRET; accepts both `Authorization: Bearer <secret>` (Vercel Cron)
 * and `x-cron-secret: <secret>` (cron-job.org / curl).
 *
 * Chunked DELETE: a single unbounded `DELETE FROM trace_span WHERE created_at < ...`
 * locks the table for the full delete duration. At 1M+ stale rows that's 30–90s
 * of write blocking. Chunked deletion (`LIMIT 5000` per pass, repeated until
 * empty) keeps each lock-held window to ~50ms while still cleaning everything
 * old. Capped at MAX_BATCHES iterations to bound cron runtime.
 */
const RETENTION_DAYS = 30
const CHUNK_SIZE     = 5000
const MAX_BATCHES    = 200   // 1M rows / pass max; safety ceiling

export async function POST(req: Request) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  let totalDeleted = 0
  let batches      = 0
  for (; batches < MAX_BATCHES; batches++) {
    // ctid-based chunked delete — fastest pattern in pg for "delete N old rows"
    // because the planner can use an index-only scan over the inner SELECT.
    const result = await db.execute(sql`
      DELETE FROM ${traceSpan}
      WHERE ctid IN (
        SELECT ctid FROM ${traceSpan}
        WHERE created_at < NOW() - INTERVAL '${sql.raw(String(RETENTION_DAYS))} days'
        LIMIT ${CHUNK_SIZE}
      )
    `)
    const deleted = (result as unknown as { rowCount?: number }).rowCount ?? 0
    totalDeleted += deleted
    if (deleted === 0) break
  }

  return NextResponse.json({
    ok:             true,
    deleted:        totalDeleted,
    batches:        batches + 1,
    retentionDays:  RETENTION_DAYS,
    hitMaxBatches:  batches >= MAX_BATCHES,
  })
}

// Vercel Cron invokes via GET; alias to the same handler (CRON_SECRET-gated).
export const GET = POST
