import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/drizzle'
import { workspaces } from '@/db/schema'

/** Slug → workspace id. Soft-deleted workspaces never resolve. */
export async function lookupWorkspaceBySlug(slug: string): Promise<number | null> {
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.slug, slug), isNull(workspaces.deletedAt)))
    .limit(1)
  return row?.id ?? null
}

/**
 * Verified custom domain → workspace id. The template ships NO custom-domain
 * table, so this always returns null. To support customer-owned domains:
 *   1. add a `workspace_domains` table (workspace_id FK, domain text unique,
 *      verified boolean, deleted_at timestamptz),
 *   2. query it here (lower(domain) = host, verified = true, not deleted),
 *   3. provision/verify the domain on Vercel with lib/vercel/domains.ts.
 * See docs/tenancy.md → "Custom domains".
 */
export async function lookupWorkspaceByDomain(_host: string): Promise<number | null> {
  return null
}
