import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Dev-only overlay: the floating Next.js indicator defaults to bottom-LEFT,
  // where it sits on top of left-aligned page chrome on mobile viewports
  // (stat-card icons, list headers) during dev and screenshot verification.
  // Move it to bottom-right so it never covers card headers/content.
  // No effect on the production bundle (indicator is dev-only).
  devIndicators: {
    position: 'bottom-right',
  },
  experimental: {
    // Server Actions default to a 1 MB request-body cap — any real photo
    // upload through a Server Action 413s. Avatars are downscaled client-side
    // (components/ui/downscale-image.ts) so they're tiny, but this raised
    // ceiling backstops the fail-safe original-file path in
    // components/ui/useAvatarField.ts (which uploads the original file when
    // downscaling fails) and the raw <ImageUpload> path (5 MB server cap in
    // lib/blob/upload-image.ts).
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
}

export default nextConfig
