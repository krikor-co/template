/**
 * Thin Vercel Domains API client for the multi-tenant custom-domain flow.
 *
 * Every function degrades gracefully: when `VERCEL_TOKEN` (or the project id) is
 * not configured, each call short-circuits to a soft
 * `{ ok: false, reason: 'unconfigured' }` instead of throwing. The owner-facing
 * actions treat that as "Vercel isn't wired up — keep the DB row and show the
 * owner the manual DNS records to set". This lets the whole domains surface work
 * in local dev / self-hosted deploys with no Vercel project at all.
 *
 * Env (all optional):
 *   VERCEL_TOKEN       — bearer token. Absent → every fn returns 'unconfigured'.
 *   VERCEL_PROJECT_ID  — the project domains are attached to. Absent → 'unconfigured'.
 *   VERCEL_TEAM_ID     — appended as `?teamId=` when present (team-scoped tokens).
 *
 * Docs: https://vercel.com/docs/rest-api/endpoints/projects#add-a-domain-to-a-project
 */

const API = 'https://api.vercel.com'

/** A DNS record the owner must create to point/verify their domain. */
export type DnsRecord = {
  type:  string
  name:  string
  value: string
}

/** Verification challenge Vercel hands back for an unverified domain. */
export type VercelVerification = {
  type:   string
  domain: string
  value:  string
  reason?: string
}

export type VercelResult<T> =
  | ({ ok: true } & T)
  | { ok: false; reason: 'unconfigured' | 'error'; status?: number; message?: string }

type VercelConfig = {
  token:     string
  projectId: string
  teamId?:   string
}

function config(): VercelConfig | null {
  const token     = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !projectId) return null
  const teamId = process.env.VERCEL_TEAM_ID || undefined
  return { token, projectId, teamId }
}

function withTeam(url: string, cfg: VercelConfig): string {
  if (!cfg.teamId) return url
  return url + (url.includes('?') ? '&' : '?') + `teamId=${encodeURIComponent(cfg.teamId)}`
}

async function call(
  cfg:    VercelConfig,
  path:   string,
  method: 'GET' | 'POST' | 'DELETE',
  body?:  unknown,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(withTeam(`${API}${path}`, cfg), {
      method,
      headers: {
        Authorization:  `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })

    // 404 on GET/DELETE is benign for our flow (domain not on project yet /
    // already gone) — surface the status so callers can branch.
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null

    if (!res.ok) {
      const message =
        (json?.error as { message?: string } | undefined)?.message ??
        `Vercel responded ${res.status}`
      return { ok: false, status: res.status, message }
    }
    return { ok: true, data: json }
  } catch (cause) {
    return { ok: false, status: 0, message: cause instanceof Error ? cause.message : 'Vercel request failed' }
  }
}

/**
 * Normalize Vercel's `verification` array (GET domain) into our DnsRecord shape.
 * Vercel returns `[{ type, domain, value, reason }]`; `name` for the TXT/CNAME
 * is the `domain` field.
 */
function toDnsRecords(verification: unknown): DnsRecord[] {
  if (!Array.isArray(verification)) return []
  return verification
    .filter((v): v is VercelVerification => !!v && typeof v === 'object')
    .map((v) => ({ type: v.type, name: v.domain, value: v.value }))
}

/**
 * POST /v10/projects/{projectId}/domains — add a domain to the project.
 * Returns the verification records Vercel wants set (if the domain isn't yet
 * verified). Degrades to `unconfigured` when no token.
 */
export async function addProjectDomain(domain: string): Promise<VercelResult<{
  verified:      boolean
  verification:  DnsRecord[]
}>> {
  const cfg = config()
  if (!cfg) return { ok: false, reason: 'unconfigured' }

  const res = await call(cfg, `/v10/projects/${encodeURIComponent(cfg.projectId)}/domains`, 'POST', { name: domain })
  if (!res.ok) {
    // 409 = domain already on the project — treat as a non-fatal "exists";
    // the caller will fall back to a GET to read the verification records.
    return { ok: false, reason: 'error', status: res.status, message: res.message }
  }
  const data = res.data as { verified?: boolean; verification?: unknown }
  return {
    ok:           true,
    verified:     Boolean(data.verified),
    verification: toDnsRecords(data.verification),
  }
}

/**
 * GET /v9/projects/{projectId}/domains/{domain} — read current verified state +
 * the verification records still outstanding.
 */
export async function getProjectDomain(domain: string): Promise<VercelResult<{
  verified:     boolean
  verification: DnsRecord[]
}>> {
  const cfg = config()
  if (!cfg) return { ok: false, reason: 'unconfigured' }

  const res = await call(
    cfg,
    `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(domain)}`,
    'GET',
  )
  if (!res.ok) return { ok: false, reason: 'error', status: res.status, message: res.message }

  const data = res.data as { verified?: boolean; verification?: unknown }
  return {
    ok:           true,
    verified:     Boolean(data.verified),
    verification: toDnsRecords(data.verification),
  }
}

/**
 * POST /v9/projects/{projectId}/domains/{domain}/verify — ask Vercel to
 * re-check the DNS challenge now. Returns the resulting verified state.
 */
export async function verifyProjectDomain(domain: string): Promise<VercelResult<{
  verified:     boolean
  verification: DnsRecord[]
}>> {
  const cfg = config()
  if (!cfg) return { ok: false, reason: 'unconfigured' }

  const res = await call(
    cfg,
    `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(domain)}/verify`,
    'POST',
  )
  if (!res.ok) return { ok: false, reason: 'error', status: res.status, message: res.message }

  const data = res.data as { verified?: boolean; verification?: unknown }
  return {
    ok:           true,
    verified:     Boolean(data.verified),
    verification: toDnsRecords(data.verification),
  }
}

/**
 * DELETE /v9/projects/{projectId}/domains/{domain} — remove the domain from the
 * project. Best-effort: a 404 (already gone) still reports `ok: true`.
 */
export async function removeProjectDomain(domain: string): Promise<VercelResult<object>> {
  const cfg = config()
  if (!cfg) return { ok: false, reason: 'unconfigured' }

  const res = await call(
    cfg,
    `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(domain)}`,
    'DELETE',
  )
  if (!res.ok && res.status !== 404) {
    return { ok: false, reason: 'error', status: res.status, message: res.message }
  }
  return { ok: true }
}
