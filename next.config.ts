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
  // Server Actions default to a 1 MB request-body cap — any real photo upload
  // through a Server Action 413s. When the app ships file uploads (e.g. the
  // Vercel Blob upload primitive + client-side downscale in
  // components/ui/downscale-image.ts), uncomment this block as the backstop
  // for the fail-safe original-file path.
  // experimental: {
  //   serverActions: {
  //     bodySizeLimit: '8mb',
  //   },
  // },
}

export default nextConfig
