/**
 * Map a stored Vercel Blob URL to a browser-renderable `<img>`/`next/image`
 * source. The default provisioned store is PRIVATE, so the canonical blob URL
 * 403s without a token — we route image reads through `/api/blob-image`, which
 * streams the bytes with the server-side R/W token (session-gated).
 *
 * Non-blob URLs (e.g. a public-store CDN URL or an external placeholder) are
 * returned untouched, and `null`/empty yields `null` so callers can fall back
 * to a placeholder.
 *
 * Assets that must render on UNAUTHENTICATED pages can't use this proxy (it
 * 401s) — see docs/blob.md "Public assets" for the per-entity public-endpoint
 * pattern.
 */
export function blobImageSrc(url: string | null | undefined): string | null {
  if (!url) return null
  if (/\.blob\.vercel-storage\.com\//.test(url)) {
    return `/api/blob-image?url=${encodeURIComponent(url)}`
  }
  return url
}
