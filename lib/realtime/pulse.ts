import { Effect } from 'effect'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { workspacePulse } from '@/db/schema'

export type WorkspacePulse = { version: number; lastEvent: string | null }

/**
 * Bump a workspace's liveness counter — call alongside cache invalidation on
 * any mutation other open sessions should see. Best-effort: a pulse failure
 * must NEVER fail the underlying mutation, so it swallows its own errors. The
 * SSE endpoint (app/api/workspace/[workspaceId]/stream) polls this row and
 * pushes a nudge to open dashboards, which then re-run their own scoped
 * queries.
 */
export async function bumpWorkspacePulse(workspaceId: number, event: string): Promise<void> {
  try {
    await db
      .insert(workspacePulse)
      .values({ workspaceId, version: 1, lastEvent: event })
      .onConflictDoUpdate({
        target: workspacePulse.workspaceId,
        set: { version: sql`${workspacePulse.version} + 1`, lastEvent: event, updatedAt: sql`now()` },
      })
  } catch (err) {
    console.error('[pulse] bump failed', { workspaceId, event, err: String(err) })
  }
}

/** Effect wrapper for use inside an action pipe (never fails — bump is best-effort). */
export const pulseE = (workspaceId: number, event: string): Effect.Effect<void> =>
  Effect.promise(() => bumpWorkspacePulse(workspaceId, event))

/** Current pulse for a workspace — the SSE endpoint polls this. */
export async function readWorkspacePulse(workspaceId: number): Promise<WorkspacePulse> {
  const [row] = await db
    .select({ version: workspacePulse.version, lastEvent: workspacePulse.lastEvent })
    .from(workspacePulse)
    .where(eq(workspacePulse.workspaceId, workspaceId))
    .limit(1)
  return { version: row?.version ?? 0, lastEvent: row?.lastEvent ?? null }
}
