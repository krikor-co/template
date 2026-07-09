import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/auth/session'

/**
 * Authenticated proxy for PRIVATE Vercel Blob images.
 *
 * The provisioned Blob store is private, so its canonical URLs 403 for a
 * browser. This route takes `?url=<blobUrl>`, validates it points at the
 * Vercel Blob host, and streams the bytes back using the server-side
 * `BLOB_READ_WRITE_TOKEN` (a Bearer-authenticated fetch).
 *
 * Gated on an authenticated session — only signed-in users can read stored
 * assets. The host allowlist prevents the token from being used as an open
 * fetch proxy (SSRF guard).
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

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
