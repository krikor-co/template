import { NextResponse, type NextRequest } from 'next/server'
import { requireWorkspaceRole, WorkspaceGuardError } from '@/app/workspace/guards'

/**
 * Authenticated proxy for PRIVATE Vercel Blob images.
 *
 * The provisioned Blob store is private, so its canonical URLs 403 for a
 * browser. This route takes `?url=<blobUrl>`, validates it points at the
 * Vercel Blob host, and streams the bytes back using the server-side
 * `BLOB_READ_WRITE_TOKEN` (a Bearer-authenticated fetch).
 *
 * Authorization is per-WORKSPACE, not just per-session: every private blob is
 * stored under `<folder>/<workspaceId>/…` (see lib/blob/upload-image.ts), so
 * the proxy parses the workspaceId segment out of the blob pathname and gates
 * on `requireWorkspaceRole(workspaceId, ['owner','member'])`. Without this, any
 * signed-in user could read any workspace's assets by reconstructing a URL.
 * Blobs outside that path convention are refused — if an app adds a new
 * private-blob namespace (e.g. per-user avatars), it must extend this check
 * with the matching ownership rule, never weaken it to session-only.
 *
 * The host allowlist prevents the token from being used as an open fetch
 * proxy (SSRF guard).
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) {
    return new NextResponse('Missing url', { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return new NextResponse('Invalid url', { status: 400 })
  }
  // SSRF guard: only proxy Vercel Blob hosts.
  if (target.protocol !== 'https:' || !target.hostname.endsWith('.blob.vercel-storage.com')) {
    return new NextResponse('Forbidden host', { status: 400 })
  }

  // Ownership guard: the pathname is `/<folder>/<workspaceId>/<file>` by
  // construction (upload-image.ts) — extract the tenant segment and require an
  // active membership. Fail CLOSED on any pathname that doesn't match.
  const workspaceId = target.pathname.split('/').filter(Boolean)[1]
  if (!workspaceId || !/^\d+$/.test(workspaceId)) {
    return new NextResponse('Forbidden path', { status: 403 })
  }
  try {
    await requireWorkspaceRole(workspaceId, ['owner', 'member'])
  } catch (err) {
    if (err instanceof WorkspaceGuardError) {
      return new NextResponse(
        err.reason === 'unauthenticated' ? 'Unauthorized' : 'Forbidden',
        { status: err.reason === 'unauthenticated' ? 401 : 403 },
      )
    }
    throw err
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return new NextResponse('Blob token not configured', { status: 500 })
  }

  const upstream = await fetch(target.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!upstream.ok || !upstream.body) {
    return new NextResponse('Image not found', { status: 404 })
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'content-type':  upstream.headers.get('content-type') ?? 'application/octet-stream',
      // Private-but-cacheable in the browser for the session; never on shared caches.
      'cache-control': 'private, max-age=3600',
    },
  })
}
