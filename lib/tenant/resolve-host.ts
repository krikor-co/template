/**
 * Maps an incoming HTTP host to a workspace id, for the multi-tenant
 * middleware.
 *
 *   <slug>.<baseDomain>       → workspace by `workspaces.slug` (via lookupSlug)
 *   a verified custom domain  → workspace via lookupDomain
 *   the base domain / www / *.vercel.app / localhost root → null (the main app)
 *
 * This is NOT a security boundary — it only decides WHICH workspace's pages a
 * host shows. The workspace layout guards (`requireWorkspaceRole`) remain the
 * wall, so a spoofed Host only ever reaches what its session may access.
 *
 * The DB lookups are INJECTED (`lookupSlug` / `lookupDomain`) so this module
 * stays db-agnostic and unit-testable; middleware.ts wires the real queries
 * from lib/tenant/lookups.ts.
 *
 * `baseDomain` is the domain workspaces are hosted under (e.g. "example.com");
 * it defaults to env `APP_BASE_DOMAIN`, then "localhost" so
 * `<slug>.localhost:3000` works in dev.
 *
 * Results (including nulls) are cached in-process per host for `cacheTtlMs`
 * (default 60s) so the middleware doesn't hit the DB on every request.
 */

/** Subdomains that are NEVER a workspace slug (marketing/app/infra hosts). */
export const DEFAULT_RESERVED_SUBDOMAINS = [
  'www', 'app', 'api', 'admin', 'auth', 'dashboard', 'staging', 'preview', 'staff', 'cdn',
] as const

export type HostResolver = (rawHost: string | null | undefined) => Promise<number | null>

export type HostResolverConfig = {
  /** Defaults to `process.env.APP_BASE_DOMAIN`, then 'localhost'. */
  baseDomain?: string
  /** Defaults to DEFAULT_RESERVED_SUBDOMAINS. */
  reserved?: Iterable<string>
  /** Slug → workspace id (or null). */
  lookupSlug: (slug: string) => Promise<number | null>
  /** Full host → workspace id via a verified custom domain (or null). Return null when the app has no custom-domain table. */
  lookupDomain: (host: string) => Promise<number | null>
  /** Positive+negative cache TTL in ms. Default 60_000. */
  cacheTtlMs?: number
  /** Clock override for tests. Default Date.now. */
  now?: () => number
}

type CacheHit = { id: number | null; exp: number }

export function createHostResolver(cfg: HostResolverConfig): HostResolver {
  const baseDomain = (cfg.baseDomain ?? process.env.APP_BASE_DOMAIN ?? 'localhost').toLowerCase()
  const reserved = new Set(cfg.reserved ?? DEFAULT_RESERVED_SUBDOMAINS)
  const ttl = cfg.cacheTtlMs ?? 60_000
  const now = cfg.now ?? Date.now
  const cache = new Map<string, CacheHit>()

  return async function resolveWorkspaceByHost(rawHost) {
    const host = (rawHost ?? '').split(':')[0].toLowerCase().trim()
    if (
      !host ||
      host === 'localhost' ||
      host === baseDomain ||
      host === `www.${baseDomain}` ||
      host.endsWith('.vercel.app')
    ) {
      return null
    }

    const cached = cache.get(host)
    if (cached && cached.exp > now()) return cached.id

    let id: number | null = null
    if (host.endsWith(`.${baseDomain}`)) {
      // The label immediately left of the base domain is the slug.
      const sub = host.slice(0, host.length - (baseDomain.length + 1))
      const label = sub.split('.').pop() ?? sub
      if (label && !reserved.has(label)) id = await cfg.lookupSlug(label)
    } else {
      // Not under our base domain → a workspace's own custom domain.
      id = await cfg.lookupDomain(host)
    }

    cache.set(host, { id, exp: now() + ttl })
    return id
  }
}
