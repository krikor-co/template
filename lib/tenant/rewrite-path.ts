/**
 * Pure path logic for the host→workspace middleware (middleware.ts) —
 * extracted so the rewrite rules are unit-testable without NextRequest.
 *
 * On a tenant host (`<slug>.<base-domain>` or a verified custom domain) every
 * path is rewritten onto the canonical `/workspace/<id>/…` tree EXCEPT:
 *
 *   - paths already under `/workspace` — in-app `/workspace/[id]` links must
 *     resolve as-is;
 *   - framework-owned top-level areas (`/auth`, `/dashboard`, `/onboarding`,
 *     `/invite`, `/docs`, `/admin`). These are the layout guards' ESCAPE
 *     ROUTES: an unauthenticated visitor on a tenant host gets redirected to
 *     `/auth/identify?returnTo=…` — rewriting that onto
 *     `/workspace/<id>/auth/identify` would 404 and dead-lock login on custom
 *     domains. Keep this list in sync with the top-level `app/` areas.
 */
const PASSTHROUGH_PREFIXES = [
  '/workspace',
  '/auth',
  '/dashboard',
  '/onboarding',
  '/invite',
  '/docs',
  '/admin',
] as const

/** True when a tenant-host request must NOT be rewritten (framework-owned path). */
export function isTenantPassthroughPath(pathname: string): boolean {
  return PASSTHROUGH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Map a tenant-host pathname onto the canonical workspace tree.
 * Bare host (`/`) → the workspace home; everything else maps 1:1.
 */
export function tenantRewritePath(pathname: string, workspaceId: number): string {
  return pathname === '/' ? `/workspace/${workspaceId}` : `/workspace/${workspaceId}${pathname}`
}
