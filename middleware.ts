import { NextResponse, type NextRequest } from 'next/server'
import { createHostResolver } from '@/lib/tenant/resolve-host'
import { lookupWorkspaceBySlug, lookupWorkspaceByDomain } from '@/lib/tenant/lookups'

/**
 * Multi-tenant host routing. When a request arrives on a workspace's OWN host
 * (`<slug>.<base-domain>` or a verified custom domain), rewrite the path onto
 * the canonical `/workspace/<id>/…` tree so the host transparently serves that
 * workspace's pages.
 *
 * NOT a security boundary: this only decides WHICH workspace's pages a host
 * shows. The workspace layout guards (`requireWorkspaceRole`) remain the wall,
 * so a spoofed Host header only ever reaches what its session may access.
 * Resolution results are cached in-process for 60s (see resolve-host.ts).
 */
const resolveWorkspaceByHost = createHostResolver({
  lookupSlug:   lookupWorkspaceBySlug,
  lookupDomain: lookupWorkspaceByDomain,
})

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Already workspace-scoped → leave it (in-app /workspace/[id] links resolve as-is).
  if (pathname.startsWith('/workspace/')) return NextResponse.next()

  const workspaceId = await resolveWorkspaceByHost(req.headers.get('host'))
  if (workspaceId == null) return NextResponse.next()

  const url = req.nextUrl.clone()
  // Bare host → the workspace home; everything else maps 1:1 onto the
  // canonical /workspace/<id>/… tree.
  url.pathname = pathname === '/'
    ? `/workspace/${workspaceId}`
    : `/workspace/${workspaceId}${pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Page routes only — skip Next internals, API routes, and files with an extension.
  matcher: ['/((?!_next/|api/|.*\\.).*)'],
  // Node.js runtime — the host→workspace lookups use the pg client (needs
  // `crypto`), which the edge runtime doesn't provide.
  runtime: 'nodejs',
}
