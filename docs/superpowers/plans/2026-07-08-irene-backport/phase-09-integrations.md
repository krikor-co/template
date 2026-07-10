# Phase 9: Integrations (Blob · Pulse · Cron) — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Port irene's three infrastructure integrations — the Vercel Blob upload story (validated Effect upload action, SSRF-guarded authed proxy, ImageUpload/AvatarField primitives), the realtime workspace pulse (table + best-effort bump + SSE nudge), and the cron convention (docs, `CRON_SECRET` guard, per-tenant local-hour fan-out, `purge-spans` example route, `vercel.json` skeleton) — generalized onto the workspace tenant model.

**Depends on phases:** 3, 6 (all tasks). Additionally: Tasks 9.2–9.3 consume phase 4 (`lib/i18n` — guaranteed transitively: 6→5→4); Tasks 9.5–9.6 consume phase 8 (`Avatar`, `downscaleImage`); Task 9.13 consumes phase 7 (`lib/time/zoned.ts` `partsInZone` — phase 7's Task 7.4 explicitly promises it to this phase). Dependency-gate steps are included where the dep is not transitively guaranteed.

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE source repo: `/Users/luca/dev/winter-park/irene` (read-only reference).
- Tenant concept: **workspace** everywhere irene says salon. New table this phase: `workspace_pulse` (`workspace_id` PK → `workspaces.id`).
- Effect is adopted: irene's Effect-based ports STAY Effect-based. Names: `runAction`, `mapResult`, `pulseE`. Errors from `@/lib/effect/errors`: `ValidationFailed`, `ExternalServiceError` (this phase's users).
- Guards: Effect adapter `requireWorkspaceRoleE(workspaceId: string, role: string | string[]): Effect.Effect<void, Forbidden | Unauthenticated>` from `@/lib/effect/auth` (phase 6 Task 6.4).
- Copy: English defaults; all user-facing copy overridable via props or `lib/i18n` messages. pt-BR is the second seed locale. No hardcoded pt-BR in code defaults.
- Design tokens: no irene hues — `text-terracotta` → `text-accent`, `bg-charcoal/40` → `bg-foreground/40`. No irene-internal ticket refs (`#031`) in comments.
- Migration story: template has only baseline `0000` — schema changes regenerate the baseline: `rm -rf drizzle && npx drizzle-kit generate --name baseline` → `drizzle/0000_baseline.sql`. Runner `scripts/migrate.mjs` reads `./drizzle`.
- Full build/migrate verification: defer to phase 13's gate when no scratch `DATABASE_URL` is configured (`npx tsc --noEmit` + eslint + vitest still run per task).
- Verification gate for every task: at minimum `npx tsc --noEmit` clean, plus the task-appropriate command. Every task ends with a git commit whose message carries the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- All commands run from `/Users/luca/dev/winter-park/template` unless the step says otherwise.

---

### Task 9.1: `@vercel/blob` dependency + activate `serverActions.bodySizeLimit: '8mb'`

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/package.json` (add dependency)
- Modify (full rewrite, ~26 lines after phase 1's Task 1.4): `/Users/luca/dev/winter-park/template/next.config.ts`

**Interfaces:**
- Consumes: phase 1 Task 1.4's `next.config.ts` (devIndicators active, bodySizeLimit block present but commented out).
- Produces: importable package `@vercel/blob@^2.4.1` (`put` consumed by Task 9.3); `experimental.serverActions.bodySizeLimit: '8mb'` ACTIVE (Task 9.6's `useAvatarField` 8 MB client ceiling pairs with it).

**Steps:**

- [ ] Step: dependency gate — Run: `test -f lib/effect/run-action.ts && test -f lib/effect/auth.ts && grep -q "requireWorkspaceRoleE" lib/effect/auth.ts && echo OK` → expected: `OK`. If not, STOP: phases 3/6 have not landed.
- [ ] Step: install — Run: `npm install @vercel/blob@^2.4.1` → expected: exit 0, `@vercel/blob` appears in `package.json` dependencies.
- [ ] Step: Write `/Users/luca/dev/winter-park/template/next.config.ts` with exactly this content (uncomments phase 1's block; comment rewritten to reference the now-real upload code paths):

  ```typescript
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
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -c "bodySizeLimit: '8mb'" next.config.ts` → expected: `1`. Run: `grep -c "// experimental" next.config.ts` → expected: `0` (block is no longer commented).
- [ ] Step: commit —
  ```bash
  git add package.json package-lock.json next.config.ts
  git commit -m "backport(blob): add @vercel/blob dep; activate serverActions bodySizeLimit 8mb

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.2: i18n `upload` message namespace (en + pt-BR)

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/lib/i18n/messages.ts` (phase 4 Task 4.5 file — anchor on the `theme` blocks, NOT line numbers; phases 5/6 may have appended other namespaces)

**Interfaces:**
- Consumes: `type Messages`, `const en`, `const ptBR`, `t(locale)` structure from phase 4 Task 4.5.
- Produces: `Messages['upload']` = `{ failed: string; tooLarge: string; invalidType: string }` — consumed by Task 9.3 (`t(locale).upload`).

**Steps:**

- [ ] Step: edit `lib/i18n/messages.ts` — three insertions, each anchored immediately AFTER the closing brace of the `theme` block in its structure:
  1. In `export type Messages = {`, after the `theme: { toggle: string; light: string; dark: string; system: string }` block's closing `}` line, insert:
     ```ts
       upload: {
         failed:      string
         tooLarge:    string
         invalidType: string
       }
     ```
  2. In `const en: Messages = {`, after the `theme: { ... }` block's closing `},` line, insert:
     ```ts
       upload: {
         failed:      'Failed to upload image. Please try again.',
         tooLarge:    'Image is too large (max 5 MB).',
         invalidType: 'Unsupported file type — use PNG, JPG, WEBP, GIF or SVG.',
       },
     ```
  3. In `const ptBR: Messages = {`, after the `theme: { ... }` block's closing `},` line, insert:
     ```ts
       upload: {
         failed:      'Falha ao enviar a imagem. Tente novamente.',
         tooLarge:    'Imagem muito grande (máx. 5 MB).',
         invalidType: 'Tipo de arquivo não suportado — use PNG, JPG, WEBP, GIF ou SVG.',
       },
     ```
  (pt-BR phrasing reused verbatim from irene `lib/i18n/messages.ts` lines 3291–3293; en from lines 81–83.)
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0 (the `Messages` annotation on both dictionaries enforces shape parity — a missing locale block fails here). Run: `grep -c 'upload:' lib/i18n/messages.ts` → expected: `3`.
- [ ] Step: commit —
  ```bash
  git add lib/i18n/messages.ts
  git commit -m "backport(i18n): upload error message namespace (en + pt-BR)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.3: `lib/blob/upload-image.ts` — validated Effect upload action

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/blob/upload-image.ts` (generalized port of `/Users/luca/dev/winter-park/irene/lib/blob/upload-image.ts`, 195 lines → ~140; the `uploadSiteImage` salon-marketing-site variant does NOT port — the public-store pattern is documented in docs/blob.md instead)

**Interfaces:**
- Consumes: `runAction` + `RunActionOpts` (phase 3 Task 3.7), `mapResult` (3.7), `ValidationFailed`/`ExternalServiceError` (3.3), `requireWorkspaceRoleE(workspaceId: string, role: string | string[])` (phase 6 Task 6.4), `getCurrentLocale(): Promise<Locale>` (phase 4 Task 4.4), `t(locale): Messages` + `Messages['upload']` (Task 9.2), `put` from `@vercel/blob` (Task 9.1).
- Produces:
  - `type UploadImageResult = { success: true; url: string } | { success: false; error: string }`
  - `uploadImage(workspaceId: string, formData: FormData, folder?: string): Promise<UploadImageResult>` (`'use server'`; folder default `'uploads'`) — consumed by Task 9.5 (`useImageUpload` default uploader) and by app forms.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/blob/upload-image.ts` with exactly this content (port with these generalizations vs irene: `salonId` → `workspaceId` everywhere incl. blob pathname; `requireOwnerE(salonId)` → `requireWorkspaceRoleE(workspaceId, 'owner')`; error copy `t(locale).common.errors.{uploadImage,imageTooLarge,invalidImageType}` → `t(locale).upload.{failed,tooLarge,invalidType}`; `(#031)` ticket ref dropped; salon-site/`uploadSiteImage`/`/api/salon-photo` doc prose dropped; the internal `access` parameter + dual-token pick is KEPT as the documented public-store hook):

  ```typescript
  'use server'

  import { Effect, pipe } from 'effect'
  import { put } from '@vercel/blob'
  import { runAction } from '@/lib/effect/run-action'
  import { mapResult } from '@/lib/effect/boundary'
  import { requireWorkspaceRoleE } from '@/lib/effect/auth'
  import { ExternalServiceError, ValidationFailed } from '@/lib/effect/errors'
  import { getCurrentLocale } from '@/lib/i18n/getLocale'
  import { t } from '@/lib/i18n/messages'

  /**
   * Reusable image upload to Vercel Blob (see docs/blob.md).
   *
   * A single `'use server'` action the `<ImageUpload>` primitive posts to. It
   * validates the file is an image under the size cap, `put()`s it to Blob under
   * `<folder>/<workspaceId>/<timestamp>-<name>`, and returns the stored URL. The
   * caller persists that URL into the relevant DB column on its own form submit.
   *
   * Workspace-owner only: gated on `requireWorkspaceRoleE(workspaceId, 'owner')`.
   * Widen the role list here if/when member self-uploads are added.
   */

  /** 5 MB cap — generous for a logo / avatar, cheap to store. */
  const MAX_BYTES = 5 * 1024 * 1024

  const ALLOWED_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
  ])

  export type UploadImageResult =
    | { success: true; url: string }
    | { success: false; error: string }

  /** Slugify the original filename so the blob pathname stays URL-clean. */
  function safeName(name: string): string {
    const base = name.replace(/\.[^.]+$/, '')
    const ext = (name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase()
    const slug = base
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48)
    return `${slug || 'image'}${ext}`
  }

  const uploadImageE = (
    workspaceId: string,
    file: File,
    folder: string,
    access: 'private' | 'public',
  ) => pipe(
    Effect.Do,
    Effect.tap(() => requireWorkspaceRoleE(workspaceId, 'owner')),

    // Validate type + size before touching the network.
    Effect.tap(() =>
      !ALLOWED_TYPES.has(file.type)
        ? Effect.fail(new ValidationFailed({ message: 'INVALID_IMAGE_TYPE' }))
        : Effect.succeed(undefined),
    ),
    Effect.tap(() =>
      file.size > MAX_BYTES
        ? Effect.fail(new ValidationFailed({ message: 'IMAGE_TOO_LARGE' }))
        : Effect.succeed(undefined),
    ),

    Effect.bind('blob', () =>
      Effect.tryPromise({
        try: () =>
          // `access: 'private'` → the canonical URL 403s without a token and is
          // served back through `/api/blob-image` (Bearer-authed proxy) — the
          // default for everything rendered behind a session. `access: 'public'`
          // → the returned URL is directly fetchable by any browser with no
          // token — only for assets an UNAUTHENTICATED page must render; that
          // requires a second, PUBLIC Blob store and its own token
          // (BLOB_PUBLIC_READ_WRITE_TOKEN). See docs/blob.md "Public assets".
          put(`${folder}/${workspaceId}/${Date.now()}-${safeName(file.name)}`, file, {
            access,
            token: access === 'public'
              ? process.env.BLOB_PUBLIC_READ_WRITE_TOKEN
              : process.env.BLOB_READ_WRITE_TOKEN,
            contentType: file.type,
          }),
        catch: (cause) =>
          new ExternalServiceError({ service: 'vercel-blob', cause }),
      }),
    ),

    Effect.map(({ blob }) => ({ url: blob.url })),
  )

  /**
   * Uploads an image to Vercel Blob and returns its stored URL.
   *
   * @param workspaceId owning workspace — auth-gated to its owner.
   * @param formData    must carry a `file` entry (the image).
   * @param folder      blob path prefix (e.g. `'logos'`). Defaults to `'uploads'`.
   */
  export async function uploadImage(
    workspaceId: string,
    formData: FormData,
    folder = 'uploads',
  ): Promise<UploadImageResult> {
    const locale = await getCurrentLocale()
    const e = t(locale).upload

    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: e.failed }
    }

    const result = await runAction(uploadImageE(workspaceId, file, folder, 'private'), {
      actionName: 'uploadImage',
      timeout:    '30 seconds',
      attributes: { workspaceId, folder, size: file.size, type: file.type },
    })

    const flat = mapResult(result, {
      fallback: e.failed,
      custom: (r) => {
        if (r.kind === 'ValidationFailed') {
          if (r.error === 'IMAGE_TOO_LARGE')    return e.tooLarge
          if (r.error === 'INVALID_IMAGE_TYPE') return e.invalidType
        }
        return null
      },
    })

    return flat.success
      ? { success: true, url: flat.url }
      : { success: false, error: flat.error }
  }
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -cn 'salon\|irene\|#031' lib/blob/upload-image.ts` → expected: 0 matches (exit 1 from grep is the pass signal). Run: `npx eslint lib/blob/upload-image.ts --max-warnings=0` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  git add lib/blob/upload-image.ts
  git commit -m "backport(blob): validated Effect image-upload action (workspace-owner gated, 5MB, MIME allowlist)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.4: `lib/blob/image-src.ts` + SSRF-guarded authed proxy `app/api/blob-image/route.ts`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/blob/image-src.ts` (partial port of irene's — `blobImageSrc` verbatim; the salon-specific `salonLogoSrc`/`salonPhotoSrc` helpers do NOT port, their pattern goes to docs/blob.md)
- Create: `/Users/luca/dev/winter-park/template/app/api/blob-image/route.ts` (port of `/Users/luca/dev/winter-park/irene/app/api/blob-image/route.ts`, 58 lines — allowlist logic ported EXACTLY)

**Interfaces:**
- Consumes: `getSession(): Promise<SessionPayload | null>` from `@/lib/auth/session` (existing template).
- Produces:
  - `blobImageSrc(url: string | null | undefined): string | null` — consumed by Task 9.5 (ImageUpload default `toSrc`), Task 9.6 (AvatarField default `toSrc`), and any `Avatar toSrc={blobImageSrc}` call site (phase 8's Avatar produced the `toSrc` prop for exactly this).
  - `GET /api/blob-image?url=<blobUrl>` — session-gated streaming proxy for private-store blobs.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/blob/image-src.ts` with exactly this content (irene's `blobImageSrc` body verbatim; doc comment de-ticketed):

  ```typescript
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
  ```
- [ ] Step: copy proxy route —
  ```bash
  mkdir -p app/api/blob-image
  cp /Users/luca/dev/winter-park/irene/app/api/blob-image/route.ts app/api/blob-image/route.ts
  ```
- [ ] Step: apply generalization edits to `app/api/blob-image/route.ts` (irene line refs; comments only — every line of executable code, including the SSRF host allowlist, ports byte-for-byte):
  1. Line 5: `* Authenticated proxy for PRIVATE Vercel Blob images (#031).` → `* Authenticated proxy for PRIVATE Vercel Blob images.`
  2. Lines 12–13: `* Gated on an authenticated session — only signed-in users can read salon` / `* assets. The host allowlist prevents the token from being used as an open` → `* Gated on an authenticated session — only signed-in users can read stored` / `* assets. The host allowlist prevents the token from being used as an open`
  3. No other edits. In particular these stay exactly as irene wrote them:
     - `if (target.protocol !== 'https:' || !target.hostname.endsWith('.blob.vercel-storage.com')) {` → `return new NextResponse('Forbidden host', { status: 400 })`
     - the `Bearer ${token}` upstream fetch with `BLOB_READ_WRITE_TOKEN`
     - `'cache-control': 'private, max-age=3600'` (private-but-cacheable in the browser; never on shared caches)
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `diff <(grep -v '^\s*\*\|^\s*//' /Users/luca/dev/winter-park/irene/app/api/blob-image/route.ts) <(grep -v '^\s*\*\|^\s*//' app/api/blob-image/route.ts)` → expected: no output (executable lines identical). Run: `npx eslint lib/blob/image-src.ts app/api/blob-image/route.ts --max-warnings=0` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  git add lib/blob/image-src.ts app/api/blob-image/route.ts
  git commit -m "backport(blob): blobImageSrc helper + SSRF-guarded authed streaming proxy /api/blob-image

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.5: `ImageUpload` + `useImageUpload` (copy→props, workspaceId param)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/useImageUpload.ts` (port of irene's, 78 lines)
- Create: `/Users/luca/dev/winter-park/template/components/ui/ImageUpload.tsx` (port of irene's, 143 lines — `useT()` copy converted to a `labels` prop with English defaults)

**Interfaces:**
- Consumes: `uploadImage` (Task 9.3), `blobImageSrc` (Task 9.4), `cn` from `@/lib/utils` (existing), `lucide-react` icons (existing dep), `next/image`.
- Produces:
  - `type ImageUploadResult = { success: true; url: string } | { success: false; error: string }`
  - `type ImageUploader = (workspaceId: string, formData: FormData, folder?: string) => Promise<ImageUploadResult>`
  - `useImageUpload({ workspaceId, folder?, initialUrl?, onChange?, uploader? }): { inputRef, url, status, pick, handleFile, remove }`
  - `type ImageUploadLabels = { upload: string; change: string; remove: string; uploading: string; alt: string; hint: string }`
  - `ImageUpload({ workspaceId: string; folder?: string; value?: string | null; name?: string; onChange?: (url: string | null) => void; disabled?: boolean; className?: string; uploader?: ImageUploader; toSrc?: (url: string) => string | null; labels?: Partial<ImageUploadLabels> })`

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/components/ui/useImageUpload.ts` with exactly this content (irene port; edits applied: `salonId` → `workspaceId` in `ImageUploader` type, `Params`, hook signature and `upload(...)` call; doc comment's "The salon site passes `uploadSiteImage` (PUBLIC blob) so hero/gallery photos load unauthenticated" → public-store note):

  ```typescript
  'use client'

  import { useRef, useState } from 'react'
  import { uploadImage } from '@/lib/blob/upload-image'

  type Status =
    | { kind: 'idle' }
    | { kind: 'uploading' }
    | { kind: 'error'; message: string }

  /** Result shape every uploader server action returns. */
  export type ImageUploadResult =
    | { success: true; url: string }
    | { success: false; error: string }

  /** A server action that uploads a `file` FormData entry and returns its URL. */
  export type ImageUploader = (
    workspaceId: string,
    formData: FormData,
    folder?: string,
  ) => Promise<ImageUploadResult>

  type Params = {
    workspaceId: string
    folder?: string
    /** Seed preview/value with an already-stored URL (edit forms). */
    initialUrl?: string | null
    /** Bubble the resulting URL up to the host form. */
    onChange?: (url: string | null) => void
    /**
     * Override the upload action. Defaults to `uploadImage` (PRIVATE blob,
     * served via the authed /api/blob-image proxy). Apps with a PUBLIC blob
     * store pass their own public-store action so the URL loads
     * unauthenticated (see docs/blob.md "Public assets").
     */
    uploader?: ImageUploader
  }

  /**
   * State + actions for the `<ImageUpload>` primitive. Keeps all hooks out of the
   * component (Flow invariant). Holds the current URL (preview + hidden-input
   * source of truth), an upload status, and the file-input ref used to trigger
   * the native picker and to reset it after each pick.
   */
  export function useImageUpload({ workspaceId, folder, initialUrl, onChange, uploader }: Params) {
    const upload = uploader ?? uploadImage
    const inputRef = useRef<HTMLInputElement>(null)
    const [url, setUrl] = useState<string | null>(initialUrl ?? null)
    const [status, setStatus] = useState<Status>({ kind: 'idle' })

    function pick() {
      inputRef.current?.click()
    }

    async function handleFile(file: File) {
      setStatus({ kind: 'uploading' })
      const fd = new FormData()
      fd.append('file', file)
      const result = await upload(workspaceId, fd, folder)
      // Reset the native input so re-picking the same file fires `change` again.
      if (inputRef.current) inputRef.current.value = ''
      if (result.success) {
        setUrl(result.url)
        setStatus({ kind: 'idle' })
        onChange?.(result.url)
      } else {
        setStatus({ kind: 'error', message: result.error })
      }
    }

    function remove() {
      setUrl(null)
      setStatus({ kind: 'idle' })
      onChange?.(null)
    }

    return { inputRef, url, status, pick, handleFile, remove }
  }
  ```
- [ ] Step: Write `/Users/luca/dev/winter-park/template/components/ui/ImageUpload.tsx` with exactly this content (irene port; edits applied: `salonId` → `workspaceId`; `useT()`/`m.settings.*` copy → `labels` prop merged over `DEFAULT_LABELS` (English defaults reuse irene's en catalogue: `Upload image` / `Change image` / `Remove` / `Uploading…`; hint updated for the GIF-included accept list); `text-terracotta` → `text-accent`; "rounded, warm preview tile" / "terracotta accents" design prose neutralized; `(#031)` dropped):

  ```tsx
  'use client'

  import { ImagePlus, Loader2, X } from 'lucide-react'
  import Image from 'next/image'
  import { cn } from '@/lib/utils'
  import { blobImageSrc } from '@/lib/blob/image-src'
  import { useImageUpload, type ImageUploader } from './useImageUpload'

  /** All user-facing copy — override per instance or wire to `useT()` from lib/i18n. */
  export type ImageUploadLabels = {
    upload:    string
    change:    string
    remove:    string
    uploading: string
    /** Alt text for the preview image. */
    alt:       string
    /** Helper line under the buttons (formats + size cap). */
    hint:      string
  }

  const DEFAULT_LABELS: ImageUploadLabels = {
    upload:    'Upload image',
    change:    'Change image',
    remove:    'Remove',
    uploading: 'Uploading…',
    alt:       'Uploaded image',
    hint:      'PNG, JPG, WEBP, GIF or SVG, up to 5 MB.',
  }

  type Props = {
    workspaceId: string
    /** Blob path prefix (e.g. `'logos'`). */
    folder?: string
    /** Already-stored URL to seed the preview (edit forms). */
    value?: string | null
    /** Hidden-input name so the resolved URL submits with the host form. */
    name?: string
    /** Notified with the stored URL (or null on remove) after each change. */
    onChange?: (url: string | null) => void
    disabled?: boolean
    className?: string
    /**
     * Override the upload action (defaults to the PRIVATE `uploadImage`).
     * Apps with a PUBLIC blob store pass their public-store action so the
     * resulting URL loads on unauthenticated pages.
     */
    uploader?: ImageUploader
    /** How to render the stored URL as an `<img>` src. Defaults to `blobImageSrc`
     *  (authed proxy). Public-blob URLs can pass `(u) => u`. */
    toSrc?: (url: string) => string | null
    labels?: Partial<ImageUploadLabels>
  }

  /**
   * Reusable image-upload control. Renders a preview tile + a button that opens
   * the native file picker, posts to the `uploadImage` server action (Vercel
   * Blob), and surfaces the resulting URL through a hidden input (so it submits
   * with the surrounding `<form>`) and an `onChange` prop.
   *
   * Design-token only — card surface, accent spinner, rounded-2xl tile.
   */
  export function ImageUpload({
    workspaceId,
    folder,
    value,
    name,
    onChange,
    disabled,
    className,
    uploader,
    toSrc,
    labels,
  }: Props) {
    const l = { ...DEFAULT_LABELS, ...labels }
    const { inputRef, url, status, pick, handleFile, remove } = useImageUpload({
      workspaceId,
      folder,
      initialUrl: value,
      onChange,
      uploader,
    })
    const resolveSrc = toSrc ?? blobImageSrc

    const uploading = status.kind === 'uploading'
    const busy = uploading || disabled

    return (
      <div className={cn('flex items-center gap-4', className)}>
        {/* Hidden input carries the resolved URL into the host form's FormData. */}
        {name && <input type="hidden" name={name} value={url ?? ''} readOnly />}

        <div
          className={cn(
            'relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-input bg-card shadow-sm',
            uploading && 'opacity-70',
          )}
        >
          {url ? (
            <Image
              src={resolveSrc(url) ?? url}
              alt={l.alt}
              fill
              sizes="80px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <ImagePlus aria-hidden className="size-7 text-muted-foreground" />
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-card/60">
              <Loader2 aria-hidden className="size-5 animate-spin text-accent" />
            </span>
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={pick}
              disabled={busy}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <ImagePlus aria-hidden className="size-4" />
              {uploading ? l.uploading : url ? l.change : l.upload}
            </button>
            {url && !uploading && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:opacity-50"
              >
                <X aria-hidden className="size-4" />
                {l.remove}
              </button>
            )}
          </div>
          {status.kind === 'error' && (
            <p role="alert" className="text-sm text-destructive">{status.message}</p>
          )}
          <p className="text-xs text-muted-foreground">{l.hint}</p>
        </div>
      </div>
    )
  }
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -cn 'salon\|terracotta\|useT\|i18n/LocaleProvider' components/ui/ImageUpload.tsx components/ui/useImageUpload.ts` → expected: 0 matches. Run: `npx eslint components/ui/ImageUpload.tsx components/ui/useImageUpload.ts --max-warnings=0` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  git add components/ui/ImageUpload.tsx components/ui/useImageUpload.ts
  git commit -m "backport(components): ImageUpload + useImageUpload (workspace param, labels-as-props, blobImageSrc default)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.6: `AvatarField` + `useAvatarField` (copy→props, Avatar `toSrc` wiring)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/useAvatarField.ts` (port of irene's, 110 lines)
- Create: `/Users/luca/dev/winter-park/template/components/ui/AvatarField.tsx` (port of irene's, 135 lines — `useT()` copy converted to a `labels` prop; `toSrc` threaded into phase 8's `Avatar`)

**Interfaces:**
- Consumes: `downscaleImage(file: File, maxDim?: number, quality?: number): Promise<File>` from `./downscale-image` (phase 8 Task 8.8); `Avatar({ name, src?, toSrc?, size?, className? })` from `./Avatar` (phase 8 Task 8.15); `blobImageSrc` (Task 9.4); `cn`.
- Produces:
  - `type AvatarActionResult = { success: true; url?: string } | { success: false; error?: string }`
  - `type AvatarAction = (formData: FormData) => Promise<AvatarActionResult>`
  - `type AvatarRemove = () => Promise<{ success: boolean }>`
  - `useAvatarField({ initialUrl?, action, onRemove?, fallbackError, tooLargeError }): { inputRef, url, status, pick, handleFile, remove, canRemove }`
  - `type AvatarFieldLabels = { addPhoto: string; changePhoto: string; remove: string; uploading: string; hint: string; errorFallback: string; errorTooLarge: string }`
  - `AvatarField({ name: string; initialUrl?: string | null; action: AvatarAction; onRemove?: AvatarRemove; size?: 'lg' | 'xl'; layout?: 'row' | 'stack'; onDark?: boolean; toSrc?: (url: string) => string | null; avatarClassName?: string; className?: string; labels?: Partial<AvatarFieldLabels> })`

**Steps:**

- [ ] Step: dependency gate — Run: `test -f components/ui/downscale-image.ts && test -f components/ui/Avatar.tsx && grep -q 'toSrc' components/ui/Avatar.tsx && echo OK` → expected: `OK`. If not, STOP: phase 8 (Tasks 8.8/8.15) has not landed; execute it first.
- [ ] Step: Write `/Users/luca/dev/winter-park/template/components/ui/useAvatarField.ts` with exactly this content (irene port; only doc-comment edits: "matches `lib/blob/upload-avatar.ts`" → "the shape an avatar-persisting server action returns"; the code body is verbatim):

  ```typescript
  'use client'

  import { useRef, useState } from 'react'
  import { downscaleImage } from './downscale-image'

  /** Hard client ceiling for the (post-downscale / fallback-original) upload — kept
   *  under the raised Server-Action body limit (next.config.ts bodySizeLimit '8mb')
   *  so an over-cap file errors cleanly instead of 413-ing the request. */
  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

  /** Flat result every avatar action returns (the shape an avatar-persisting
   *  server action returns — mirror of lib/blob/upload-image.ts's result). */
  export type AvatarActionResult =
    | { success: true; url?: string }
    | { success: false; error?: string }

  /** A server action that persists the picked `file` and returns its stored URL. */
  export type AvatarAction = (formData: FormData) => Promise<AvatarActionResult>

  /** A server action that clears the avatar (back to the initials chip). */
  export type AvatarRemove = () => Promise<{ success: boolean }>

  type Status =
    | { kind: 'idle' }
    | { kind: 'uploading' }
    | { kind: 'error'; message: string }

  type Params = {
    /** Already-stored avatar URL to seed the preview. */
    initialUrl?: string | null
    /** Persists the picked file immediately; returns the new URL. */
    action: AvatarAction
    /** Optional — clears the avatar. When omitted, no "Remove" button shows. */
    onRemove?: AvatarRemove
    /** Fallback copy when an action resolves `success:false` without a message. */
    fallbackError: string
    /** Copy shown when the picked file is too large to upload. */
    tooLargeError: string
  }

  /**
   * State + actions for `<AvatarField>`. Keeps all hooks out of the component
   * (Flow invariant). Holds the current URL (preview), an upload status, and the
   * file-input ref used to open the native picker and reset it after each pick.
   *
   * Unlike `useImageUpload`, the passed `action` PERSISTS on the server in the
   * same call — so there is no hidden form input or host-form submit; the preview
   * is the source of truth and updates the moment the action resolves.
   */
  export function useAvatarField({ initialUrl, action, onRemove, fallbackError, tooLargeError }: Params) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [url, setUrl] = useState<string | null>(initialUrl ?? null)
    const [status, setStatus] = useState<Status>({ kind: 'idle' })

    function pick() {
      inputRef.current?.click()
    }

    /** Always reset the native input so re-picking the same file fires `change`. */
    function resetInput() {
      if (inputRef.current) inputRef.current.value = ''
    }

    async function handleFile(file: File) {
      setStatus({ kind: 'uploading' })
      try {
        // Shrink in the browser first → a tiny body that sails under the Server-
        // Action limit (fails safe to the original file on any error).
        const upload = await downscaleImage(file)
        if (upload.size > MAX_UPLOAD_BYTES) {
          resetInput()
          setStatus({ kind: 'error', message: tooLargeError })
          return
        }
        const fd = new FormData()
        fd.append('file', upload)
        const result = await action(fd)
        resetInput()
        if (result.success) {
          if (result.url) setUrl(result.url)
          setStatus({ kind: 'idle' })
        } else {
          setStatus({ kind: 'error', message: result.error || fallbackError })
        }
      } catch {
        // A rejected action (e.g. an over-limit body or network drop) must NOT
        // leave the control stuck on "uploading" forever.
        resetInput()
        setStatus({ kind: 'error', message: fallbackError })
      }
    }

    async function remove() {
      if (!onRemove) return
      setStatus({ kind: 'uploading' })
      try {
        const result = await onRemove()
        if (result.success) {
          setUrl(null)
          setStatus({ kind: 'idle' })
        } else {
          setStatus({ kind: 'error', message: fallbackError })
        }
      } catch {
        setStatus({ kind: 'error', message: fallbackError })
      }
    }

    return { inputRef, url, status, pick, handleFile, remove, canRemove: Boolean(onRemove) }
  }
  ```
- [ ] Step: Write `/Users/luca/dev/winter-park/template/components/ui/AvatarField.tsx` with exactly this content (irene port; edits applied: `useT()`/`m.avatar.*`/`m.common.errors.*` → `labels` prop merged over `DEFAULT_LABELS` (English defaults from irene's en catalogue: `Add photo` / `Change photo` / `Remove` / `Uploading…` / `PNG, JPG, WEBP or GIF, up to 5 MB.`; error defaults from the en upload copy, tooLarge restated for the 8 MB client ceiling); `bg-charcoal/40` → `bg-foreground/40`; NEW `toSrc` prop (default `blobImageSrc`) threaded into `<Avatar>` — irene's Avatar applied `blobImageSrc` internally, phase 8's template Avatar takes it as a prop; "warm `<ImageUpload>` aesthetic … terracotta accent" design prose neutralized; "mirror `upload-avatar.ts`" → generic):

  ```tsx
  'use client'

  import { Camera, Loader2, X } from 'lucide-react'
  import { cn } from '@/lib/utils'
  import { blobImageSrc } from '@/lib/blob/image-src'
  import { Avatar } from './Avatar'
  import { useAvatarField, type AvatarAction, type AvatarRemove } from './useAvatarField'

  const AVATAR_SIZE = {
    lg: 'size-12 text-sm',
    xl: 'size-20 text-lg',
  } as const

  /** All user-facing copy — override per instance or wire to `useT()` from lib/i18n. */
  export type AvatarFieldLabels = {
    addPhoto:      string
    changePhoto:   string
    remove:        string
    uploading:     string
    hint:          string
    /** Shown when the action resolves `success:false` without a message. */
    errorFallback: string
    /** Shown when the picked file exceeds the client upload ceiling. */
    errorTooLarge: string
  }

  const DEFAULT_LABELS: AvatarFieldLabels = {
    addPhoto:      'Add photo',
    changePhoto:   'Change photo',
    remove:        'Remove',
    uploading:     'Uploading…',
    hint:          'PNG, JPG, WEBP or GIF, up to 5 MB.',
    errorFallback: 'Failed to upload image. Please try again.',
    errorTooLarge: 'Image is too large (max 8 MB).',
  }

  type Props = {
    /** Display name — drives the initials fallback + alt text. */
    name: string
    /** Already-stored avatar URL (edit/profile forms). */
    initialUrl?: string | null
    /** Persists the picked file immediately; returns the new URL. */
    action: AvatarAction
    /** Optional — clears the avatar. When omitted, no "Remove" button shows. */
    onRemove?: AvatarRemove
    /** Avatar diameter. Defaults to `xl` (the profile-hero size). */
    size?: keyof typeof AVATAR_SIZE
    /** Stack the controls beneath the avatar (centered) vs. beside it. */
    layout?: 'row' | 'stack'
    /** Tune copy/controls for an always-dark surface. */
    onDark?: boolean
    /** How to render the stored URL as an `<img>` src. Defaults to `blobImageSrc`
     *  (authed proxy). Public-blob URLs can pass `(u) => u`. */
    toSrc?: (url: string) => string | null
    /** Extra ring/spacing on the avatar (e.g. `ring-4 ring-card/15`). */
    avatarClassName?: string
    className?: string
    labels?: Partial<AvatarFieldLabels>
  }

  /**
   * AvatarField — round, avatar-shaped upload control. Shows the current avatar
   * (or the initials `<Avatar>` fallback when none), with a "Change photo" /
   * "Add photo" button that opens the native picker and posts to a passed
   * `action` server action (which PERSISTS immediately), plus an optional
   * "Remove" button. Uploading + error states inline.
   *
   * Built on the `<ImageUpload>` aesthetic (rounded pill buttons, card surface)
   * but round instead of square — an avatar is a person, not a marketing tile.
   * Accepts PNG/JPG/WEBP/GIF; the picked file is downscaled client-side before
   * upload (useAvatarField → downscale-image), with an 8 MB client ceiling.
   */
  export function AvatarField({
    name,
    initialUrl,
    action,
    onRemove,
    size = 'xl',
    layout = 'stack',
    onDark = false,
    toSrc,
    avatarClassName,
    className,
    labels,
  }: Props) {
    const l = { ...DEFAULT_LABELS, ...labels }
    const { inputRef, url, status, pick, handleFile, remove, canRemove } = useAvatarField({
      initialUrl,
      action,
      onRemove,
      fallbackError: l.errorFallback,
      tooLargeError: l.errorTooLarge,
    })

    const uploading = status.kind === 'uploading'
    const dim = AVATAR_SIZE[size].split(' ')[0]

    return (
      <div
        className={cn(
          'flex gap-4',
          layout === 'stack' ? 'flex-col items-center text-center' : 'items-center',
          className,
        )}
      >
        <div className={cn('relative shrink-0', dim)}>
          <Avatar
            name={name || '?'}
            src={url}
            toSrc={toSrc ?? blobImageSrc}
            size="lg"
            className={cn(dim, size === 'xl' && 'text-lg', uploading && 'opacity-70', avatarClassName)}
          />
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40">
              <Loader2 aria-hidden className="size-5 animate-spin text-card" />
            </span>
          )}
        </div>

        <div className={cn('min-w-0 space-y-2', layout === 'stack' && 'flex flex-col items-center')}>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={pick}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera aria-hidden className="size-4" />
              {uploading ? l.uploading : url ? l.changePhoto : l.addPhoto}
            </button>
            {url && !uploading && canRemove && (
              <button
                type="button"
                onClick={remove}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium transition-colors disabled:opacity-50',
                  onDark
                    ? 'text-current opacity-80 hover:bg-card/15 hover:opacity-100'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )}
              >
                <X aria-hidden className="size-4" />
                {l.remove}
              </button>
            )}
          </div>
          {status.kind === 'error'
            ? <p role="alert" className="text-sm text-destructive">{status.message}</p>
            : <p className={cn('text-xs', onDark ? 'text-current opacity-70' : 'text-muted-foreground')}>{l.hint}</p>}
        </div>
      </div>
    )
  }
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -cn 'salon\|charcoal\|useT\|upload-avatar' components/ui/AvatarField.tsx components/ui/useAvatarField.ts` → expected: 0 matches. Run: `npx eslint components/ui/AvatarField.tsx components/ui/useAvatarField.ts --max-warnings=0` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  git add components/ui/AvatarField.tsx components/ui/useAvatarField.ts
  git commit -m "backport(components): AvatarField + useAvatarField (labels-as-props, Avatar toSrc wiring, client downscale)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.7: `docs/blob.md` + CLAUDE.md doc row + .env.example check

**Files:**
- Create: `/Users/luca/dev/winter-park/template/docs/blob.md`
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (docs table — anchor on table structure, not line numbers)

**Interfaces:**
- Consumes: everything Tasks 9.1–9.6 produced (documents it).
- Produces: `docs/blob.md` served at `/docs/blob` (frontmatter `category: Infrastructure`, `order: 14`).

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/docs/blob.md` with exactly this content:

  ````markdown
  ---
  title: File Uploads (Blob)
  order: 14
  category: Infrastructure
  ---

  # File Uploads — Vercel Blob

  The template's upload story: a validated `'use server'` upload action, a
  PRIVATE-by-default Blob store, an authed streaming proxy for reads, and two
  UI primitives (`<ImageUpload>` for form-persisted images, `<AvatarField>` for
  immediately-persisted profile photos).

  ## Setup

  1. Attach a Blob store to the Vercel project (Storage → Blob), then
     `vercel env pull` — this injects `BLOB_READ_WRITE_TOKEN`.
  2. Locally, copy the token into `.env` (see `.env.example`, "File uploads"
     group).
  3. `next.config.ts` raises `serverActions.bodySizeLimit` to `'8mb'` — the
     Server-Action default of 1 MB 413s any real photo. Client code downscales
     before upload (`components/ui/downscale-image.ts`), so this is a backstop.

  The store is **private**: canonical `https://….blob.vercel-storage.com/…`
  URLs 403 in a browser. That is the point — reads go through an app-controlled
  proxy that enforces the app's own auth.

  ## The upload action — `lib/blob/upload-image.ts`

  ```ts
  uploadImage(workspaceId: string, formData: FormData, folder = 'uploads')
    : Promise<{ success: true; url: string } | { success: false; error: string }>
  ```

  - Validates BEFORE touching the network: MIME allowlist
    (PNG/JPEG/WEBP/GIF/SVG) and a 5 MB cap — typed `ValidationFailed` failures.
  - Auth inside the pipe: `requireWorkspaceRoleE(workspaceId, 'owner')`. Widen
    the role list in that one place if members should self-upload.
  - Blob pathname: `<folder>/<workspaceId>/<timestamp>-<slugified-name>` — the
    tenant id in the path keeps stores auditable and per-workspace deletable.
  - Returns the stored URL; **the caller persists it** into its own DB column
    on its own form submit (the action does not write to the DB).
  - Error copy comes from `lib/i18n` (`t(locale).upload.*`) — en + pt-BR seeded.

  ## Serving private blobs — `blobImageSrc` + `/api/blob-image`

  Never render a canonical private-store URL. Map it first:

  ```tsx
  import { blobImageSrc } from '@/lib/blob/image-src'

  <Avatar name={name} src={person.avatarUrl} toSrc={blobImageSrc} />
  ```

  `blobImageSrc(url)` rewrites `*.blob.vercel-storage.com` URLs onto
  `/api/blob-image?url=…` and passes anything else through (`null` in → `null`
  out, so callers can fall back to a placeholder).

  `app/api/blob-image/route.ts` is the authed streaming proxy:

  - **Session-gated** — 401 without a valid session.
  - **SSRF-guarded** — only proxies `https:` URLs whose hostname ends in
    `.blob.vercel-storage.com`. Without this, the route would be an open fetch
    proxy that exfiltrates with the server's Bearer token. Do not loosen it.
  - Streams bytes with `cache-control: private, max-age=3600` — cacheable in
    the user's browser, never on shared caches.

  ## Components

  | Primitive | Persistence | Use for |
  |---|---|---|
  | `<ImageUpload>` | Hidden input → host `<form>` submit persists the URL | Logos, gallery images, anything edited inside a bigger form |
  | `<AvatarField>` | The passed `action` persists immediately | Profile photos with exactly one home column |

  Both take a `labels` prop (English defaults) — pass `useT()`-derived strings
  for localized copy — and a `toSrc` prop defaulting to `blobImageSrc`.
  `<AvatarField>` downscales client-side (`downscale-image.ts`) and enforces an
  8 MB client ceiling matched to the Server-Action body limit.

  An avatar-persisting `action` is any server action matching
  `(formData: FormData) => Promise<{ success: true; url?: string } | { success: false; error?: string }>`
  — typically: parse the `file` entry, call `put()` (or reuse `uploadImage`'s
  validation shape), then `UPDATE persons SET avatar_url = …` in the same pipe.

  ## Public assets (pattern, not shipped)

  Assets an **unauthenticated** page must render (a public marketing page's
  logo/hero) can't use `/api/blob-image` — it 401s. Two options, in order:

  1. **Second, PUBLIC Blob store** — set `BLOB_PUBLIC_READ_WRITE_TOKEN`, upload
     with `access: 'public'` (the internal `uploadImageE` already takes the
     access + token pick), and render the returned CDN URL directly (`toSrc`
     pass-through).
  2. **Per-entity public endpoint** — a route like `/api/workspace-logo/[id]`
     that looks up the entity's OWN stored URL in the DB (never a
     caller-supplied URL), streams it with the server token, and hard-caches.
     The DB re-check is what keeps it from being an open proxy.

  ## Invariants

  - Validation (MIME + size) happens server-side in the action — client checks
    are UX, not security.
  - The proxy's host allowlist is a security boundary; the upload action's
    role guard is the write-side boundary.
  - Components reference tokens only (`text-accent`, `bg-card`) — no hues.
  ````
- [ ] Step: edit `/Users/luca/dev/winter-park/template/CLAUDE.md` — in the docs table (the `| Doc | What it covers |` table near the top), append after the LAST existing row (rows from phases 2–8 may already be present; do not reorder them):

  ```markdown
  | [`blob.md`](docs/blob.md) | Vercel Blob uploads: `uploadImage` action, authed `/api/blob-image` proxy, ImageUpload/AvatarField |
  ```
- [ ] Step: .env.example check (scope: BLOB_* rows flip to active) — Run: `grep -cE '^(BLOB_READ_WRITE_TOKEN|BLOB_PUBLIC_READ_WRITE_TOKEN)=' .env.example` → expected: `2`, and Run: `grep -c 'lib/blob/upload-image.ts' .env.example` → expected: `1`. Phase 1 Task 1.3 pre-seeded the Blob group with comments that reference the code this phase just landed — they are now accurate as written; **no edit needed**. If either grep fails, re-apply phase 1 Task 1.3's Blob block verbatim.
- [ ] Step: verification — Run: `head -5 docs/blob.md | grep -c 'order: 14'` → expected: `1`. Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  git add docs/blob.md CLAUDE.md
  git commit -m "docs(blob): Vercel Blob upload/serve conventions + CLAUDE.md doc row

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.8: `workspace_pulse` table + baseline regeneration

**Files:**
- Create: `/Users/luca/dev/winter-park/template/db/schema/workspace-pulse.ts` (port of `/Users/luca/dev/winter-park/irene/db/schema/salon-pulse.ts`, 17 lines)
- Modify: `/Users/luca/dev/winter-park/template/db/schema/index.ts` (add one export line)
- Regenerate: `/Users/luca/dev/winter-park/template/drizzle/` (baseline)

**Interfaces:**
- Consumes: `workspaces` table from `db/schema/workspaces.ts` (phase 6 Task 6.1); baseline-regen convention (phase 1).
- Produces: `workspacePulse` pgTable export from `@/db/schema` — columns `workspaceId: integer PK → workspaces.id`, `version: bigint(mode number) NOT NULL DEFAULT 0`, `lastEvent: text NULL`, `updatedAt: timestamptz NOT NULL DEFAULT now()`. Consumed by Task 9.9.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/db/schema/workspace-pulse.ts` with exactly this content (irene port; edits: `salon` → `workspaces` import/reference, `salonPulse`/`salon_pulse`/`salon_id` → `workspacePulse`/`workspace_pulse`/`workspace_id`, doc comment de-phased and de-saloned):

  ```typescript
  import { integer, bigint, text, pgTable, timestamp } from 'drizzle-orm/pg-core'
  import { workspaces } from './workspaces'

  /**
   * Per-workspace liveness counter (see docs/realtime.md). Mutations that other
   * open sessions should see bump `version` (+ a short `lastEvent` label). The
   * SSE endpoint (app/api/workspace/[workspaceId]/stream) polls this row and
   * streams an event when the version changes; open dashboards then re-run
   * their OWN scoped queries (the auth wall holds — the event carries no
   * payload, just the nudge). Cache tags still handle request-time freshness;
   * this handles in-session liveness.
   */
  export const workspacePulse = pgTable('workspace_pulse', {
    workspaceId: integer('workspace_id').primaryKey().references(() => workspaces.id),
    version:     bigint('version', { mode: 'number' }).notNull().default(0),
    lastEvent:   text('last_event'),
    updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  })
  ```
- [ ] Step: edit `/Users/luca/dev/winter-park/template/db/schema/index.ts` — after the line `export * from './workspace-members'` (added by phase 6), add:

  ```typescript
  export * from './workspace-pulse'
  ```
- [ ] Step: Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: regenerate baseline — Run: `rm -rf drizzle && npx drizzle-kit generate --name baseline` → expected: exactly one `drizzle/0000_baseline.sql` created. Then Run: `grep -c 'CREATE TABLE "workspace_pulse"' drizzle/0000_baseline.sql` → expected: `1`.
- [ ] Step: Run: `npx vitest run db/schema` → expected: exit 0 (phase 1's schema-invariants test iterates the new table; `updated_at` is timestamptz so it stays green). Full `npm run build` (migrate + next build) defers to phase 13's gate when no scratch `DATABASE_URL` is configured.
- [ ] Step: commit —
  ```bash
  git add db/schema/workspace-pulse.ts db/schema/index.ts drizzle
  git commit -m "feat(db): workspace_pulse liveness-counter table + baseline regen

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.9: `lib/realtime/pulse.ts` — bump / read / `pulseE`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/realtime/pulse.ts` (port of `/Users/luca/dev/winter-park/irene/lib/realtime/pulse.ts`, 42 lines)

**Interfaces:**
- Consumes: `workspacePulse` (Task 9.8), `db` from `@/db/drizzle` (existing), `Effect` from `effect` (phase 3 dep).
- Produces:
  - `type WorkspacePulse = { version: number; lastEvent: string | null }`
  - `bumpWorkspacePulse(workspaceId: number, event: string): Promise<void>` (best-effort — swallows its own errors)
  - `pulseE(workspaceId: number, event: string): Effect.Effect<void>` (never fails — for action pipes)
  - `readWorkspacePulse(workspaceId: number): Promise<WorkspacePulse>` — consumed by Task 9.10's SSE route.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/realtime/pulse.ts` with exactly this content (irene port; enumerated renames: `salonPulse` → `workspacePulse`, `SalonPulse` → `WorkspacePulse`, `bumpSalonPulse` → `bumpWorkspacePulse`, `readSalonPulse` → `readWorkspacePulse`, `salonId` → `workspaceId` (params, `values`, `target`, `where`, error log), doc comments: "salon's" → "workspace's", "status/money mutation" → "mutation other open sessions should see", SSE path updated; upsert + swallowed-catch logic verbatim):

  ```typescript
  import { Effect } from 'effect'
  import { eq, sql } from 'drizzle-orm'
  import { db } from '@/db/drizzle'
  import { workspacePulse } from '@/db/schema'

  export type WorkspacePulse = { version: number; lastEvent: string | null }

  /**
   * Bump a workspace's liveness counter — call alongside cache invalidation on
   * any mutation other open sessions should see. Best-effort: a pulse failure
   * must NEVER fail the underlying mutation, so it swallows its own errors. The
   * SSE endpoint (app/api/workspace/[workspaceId]/stream) polls this row and
   * pushes a nudge to open dashboards, which then re-run their own scoped
   * queries.
   */
  export async function bumpWorkspacePulse(workspaceId: number, event: string): Promise<void> {
    try {
      await db
        .insert(workspacePulse)
        .values({ workspaceId, version: 1, lastEvent: event })
        .onConflictDoUpdate({
          target: workspacePulse.workspaceId,
          set: { version: sql`${workspacePulse.version} + 1`, lastEvent: event, updatedAt: sql`now()` },
        })
    } catch (err) {
      console.error('[pulse] bump failed', { workspaceId, event, err: String(err) })
    }
  }

  /** Effect wrapper for use inside an action pipe (never fails — bump is best-effort). */
  export const pulseE = (workspaceId: number, event: string): Effect.Effect<void> =>
    Effect.promise(() => bumpWorkspacePulse(workspaceId, event))

  /** Current pulse for a workspace — the SSE endpoint polls this. */
  export async function readWorkspacePulse(workspaceId: number): Promise<WorkspacePulse> {
    const [row] = await db
      .select({ version: workspacePulse.version, lastEvent: workspacePulse.lastEvent })
      .from(workspacePulse)
      .where(eq(workspacePulse.workspaceId, workspaceId))
      .limit(1)
    return { version: row?.version ?? 0, lastEvent: row?.lastEvent ?? null }
  }
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -cn 'salon' lib/realtime/pulse.ts` → expected: 0 matches. Run: `npx eslint lib/realtime/pulse.ts --max-warnings=0` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  git add lib/realtime/pulse.ts
  git commit -m "backport(realtime): workspace pulse — best-effort bump, pulseE, read

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.10: SSE route `/api/workspace/[workspaceId]/stream` + `WorkspaceLive` nudge component

**Files:**
- Create: `/Users/luca/dev/winter-park/template/app/api/workspace/[workspaceId]/stream/route.ts` (port of `/Users/luca/dev/winter-park/irene/app/api/salon/[salonId]/stream/route.ts`, 78 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/realtime/WorkspaceLive.tsx` (port of `/Users/luca/dev/winter-park/irene/lib/realtime/SalonLive.tsx`, 31 lines)

**Interfaces:**
- Consumes: `readWorkspacePulse` (Task 9.9); `getSession(): Promise<SessionPayload | null>` from `@/lib/auth/session` with `SessionPayload = { userId: number }` (phase 5 Task rewrites `lib/auth/jwt.ts` to this slimmed shape — the `Number(session.userId)` wrapper in the route below is a no-op kept for robustness and may be dropped); `getUserWorkspaces(userId: number): Promise<UserWorkspace[]>` + `isPlatformAdmin(userId: number): Promise<boolean>` from `@/lib/workspace/memberships` (phase 6 Task 6.5; `UserWorkspace = { id: number; name: string; role: string }`).
- Produces:
  - `GET /api/workspace/[workspaceId]/stream` — member-or-admin-gated SSE stream emitting `ready` then `pulse` events (no payload beyond version), heartbeat comments, closes at 280s.
  - `WorkspaceLive({ workspaceId: string })` (client, renders nothing) — mount inside a workspace-scoped layout/page to auto-`router.refresh()` on pulse.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/app/api/workspace/[workspaceId]/stream/route.ts` with exactly this content (irene port; enumerated changes: param `salonId` → `workspaceId`; irene's session-embedded `getUserWorkspaces()` (no-arg, returned `{ isAdmin, salons }`) → template's explicit `getSession()` + `getUserWorkspaces(userId)`/`isPlatformAdmin(userId)` with a 401 branch for no session; `readSalonPulse` → `readWorkspacePulse`; `salon_pulse` → `workspace_pulse` and "member of this salon" → "member of this workspace" in comments; "Phase 2.3" dropped; stream/heartbeat/timing logic verbatim):

  ```typescript
  import { getSession } from '@/lib/auth/session'
  import { getUserWorkspaces, isPlatformAdmin } from '@/lib/workspace/memberships'
  import { readWorkspacePulse } from '@/lib/realtime/pulse'

  const POLL_MS = 3_000
  // Close a touch before the platform function limit (300s) so the client's
  // EventSource reconnects cleanly rather than being killed mid-frame.
  const MAX_MS = 280_000

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  /**
   * Per-workspace SSE liveness stream (see docs/realtime.md). Holds the
   * connection and polls the workspace_pulse row every few seconds; emits a
   * thin `pulse` event when the version changes (no payload — the receiver
   * re-runs its own scoped query, so the auth wall holds). Auth: the caller
   * must be a member of this workspace or a platform admin. Heartbeat comments
   * keep proxies from dropping an idle stream.
   */
  export async function GET(_req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
    const { workspaceId } = await params
    const id = Number(workspaceId)
    if (!Number.isInteger(id)) return new Response('Bad request', { status: 400 })

    const session = await getSession()
    if (!session) return new Response('Unauthorized', { status: 401 })

    const userId = Number(session.userId)
    const memberships = await getUserWorkspaces(userId)
    const allowed = memberships.some((w) => w.id === id) || (await isPlatformAdmin(userId))
    if (!allowed) return new Response('Forbidden', { status: 403 })

    const encoder = new TextEncoder()
    let closed = false

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          if (closed) return
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
          } catch { closed = true }
        }
        const heartbeat = () => {
          if (closed) return
          try { controller.enqueue(encoder.encode(`: ping\n\n`)) } catch { closed = true }
        }

        let last = (await readWorkspacePulse(id)).version
        send('ready', { version: last })

        const startedAt = Date.now()
        while (!closed && Date.now() - startedAt < MAX_MS) {
          await sleep(POLL_MS)
          if (closed) break
          try {
            const cur = await readWorkspacePulse(id)
            if (cur.version !== last) {
              last = cur.version
              send('pulse', cur)
            } else {
              heartbeat()
            }
          } catch {
            heartbeat()
          }
        }
        if (!closed) {
          try { controller.close() } catch { /* already closed */ }
        }
      },
      cancel() {
        closed = true
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }
  ```
- [ ] Step: Write `/Users/luca/dev/winter-park/template/lib/realtime/WorkspaceLive.tsx` with exactly this content (irene `SalonLive` port; renames: `SalonLive` → `WorkspaceLive`, `salonId` → `workspaceId`, URL `/api/salon/…` → `/api/workspace/…`; doc comment examples de-saloned, "Phase 2.3" dropped):

  ```tsx
  'use client'

  import { useEffect } from 'react'
  import { useRouter } from 'next/navigation'

  /**
   * Subscribes to the workspace's SSE liveness stream and refreshes the current
   * route when a `pulse` arrives — which re-runs the server components' own
   * scoped queries, so the screen reflects another device's action (a record
   * settled, a row approved elsewhere) without a manual reload.
   *
   * EventSource reconnects automatically when the server closes the stream near
   * the function time limit or the network blips. Renders nothing. Mount it in
   * a workspace-scoped layout or page.
   */
  export function WorkspaceLive({ workspaceId }: { workspaceId: string }) {
    const router = useRouter()

    useEffect(() => {
      if (typeof window === 'undefined' || typeof EventSource === 'undefined') return
      const es = new EventSource(`/api/workspace/${workspaceId}/stream`)
      const onPulse = () => router.refresh()
      es.addEventListener('pulse', onPulse)
      return () => {
        es.removeEventListener('pulse', onPulse)
        es.close()
      }
    }, [workspaceId, router])

    return null
  }
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `grep -rcn 'salon' app/api/workspace lib/realtime` → expected: 0 matches. Run: `npx eslint app/api/workspace lib/realtime --max-warnings=0` → expected: exit 0. Live SSE behavior (connect, bump, refresh) defers to phase 13's browser pass (needs DB + dev server).
- [ ] Step: commit —
  ```bash
  git add app/api/workspace/[workspaceId]/stream/route.ts lib/realtime/WorkspaceLive.tsx
  git commit -m "backport(realtime): workspace SSE stream (member/admin gated) + WorkspaceLive nudge component

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.11: `docs/realtime.md` + CLAUDE.md doc row

**Files:**
- Create: `/Users/luca/dev/winter-park/template/docs/realtime.md`
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (docs table)

**Interfaces:**
- Consumes: Tasks 9.8–9.10 (documents them).
- Produces: `docs/realtime.md` served at `/docs/realtime` (frontmatter `category: Infrastructure`, `order: 15`).

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/docs/realtime.md` with exactly this content:

  ````markdown
  ---
  title: Realtime (Pulse)
  order: 15
  category: Infrastructure
  ---

  # Realtime — the Workspace Pulse

  Cheap in-session liveness without websockets or extra infra: mutations bump a
  per-workspace version row; an SSE endpoint polls that row and nudges open
  dashboards; nudged clients call `router.refresh()` and re-run their **own**
  scoped queries. The event carries no data — it is a doorbell, not a payload.

  Cache tags (see `caching.md`) handle request-time freshness. The pulse handles
  the other half: a screen that is already open when *someone else* changes the
  data.

  ## The pieces

  | Piece | File | Role |
  |---|---|---|
  | `workspace_pulse` table | `db/schema/workspace-pulse.ts` | One row per workspace: `version` bigint + `last_event` label |
  | `bumpWorkspacePulse` / `pulseE` | `lib/realtime/pulse.ts` | Best-effort upsert `version = version + 1` |
  | `readWorkspacePulse` | `lib/realtime/pulse.ts` | `{ version, lastEvent }` — what the stream polls |
  | SSE route | `app/api/workspace/[workspaceId]/stream/route.ts` | Member/admin-gated stream: `ready` → `pulse` events, heartbeats |
  | `<WorkspaceLive>` | `lib/realtime/WorkspaceLive.tsx` | Client: EventSource → `router.refresh()` on pulse |

  ## Bumping from a mutation

  Inside an Effect action pipe, after the write and the cache invalidation:

  ```ts
  import { pulseE } from '@/lib/realtime/pulse'

  pipe(
    Effect.Do,
    Effect.tap(() => requireWorkspaceRoleE(workspaceId, 'owner')),
    Effect.bind('row', () => dbE.run(/* the write */)),
    // Nudge other open sessions. NEVER fails — pulseE swallows its own errors,
    // so a pulse outage cannot fail the mutation.
    Effect.tap(() => pulseE(Number(workspaceId), 'record.updated')),
    // ...
  )
  ```

  Outside Effect, `await bumpWorkspacePulse(id, 'event.name')` — same guarantee.
  The event label is for debugging (`last_event` column), not for clients.

  ## Receiving

  Mount once per workspace-scoped area (layout or page):

  ```tsx
  import { WorkspaceLive } from '@/lib/realtime/WorkspaceLive'

  <WorkspaceLive workspaceId={workspaceId} />
  ```

  It renders nothing. On `pulse` it calls `router.refresh()` — server components
  re-run their own queries under the viewer's own session, so **authorization
  holds by construction**: the stream never transports data across users.

  ## Guarantees & caveats

  - **Best-effort, at-least-nothing:** a failed bump logs and moves on. Never
    put the pulse before the write, and never await it as a success condition.
  - **Auth:** the SSE route 401s without a session and 403s unless the caller
    is a member of the workspace (`getUserWorkspaces`) or a platform admin.
  - **Polling cadence:** the stream polls every 3s (`POLL_MS`) — that is the
    worst-case staleness between devices.
  - **Function limits:** the stream closes itself at 280s (`MAX_MS`), just
    under the 300s platform ceiling; the browser's `EventSource` reconnects
    automatically. Expect a reconnect blip every ~4.5 minutes.
  - **Cost:** one held connection + one indexed single-row SELECT per 3s per
    open dashboard. Fine for team-sized tenants; for thousands of concurrent
    viewers move to a push provider and keep this API shape.
  ````
- [ ] Step: edit `/Users/luca/dev/winter-park/template/CLAUDE.md` — append to the docs table after the `blob.md` row (added by Task 9.7):

  ```markdown
  | [`realtime.md`](docs/realtime.md) | Workspace pulse: best-effort liveness bump + SSE nudge, `<WorkspaceLive>` |
  ```
- [ ] Step: verification — Run: `head -5 docs/realtime.md | grep -c 'order: 15'` → expected: `1`. Run: `grep -c 'realtime.md' CLAUDE.md` → expected: ≥ 1.
- [ ] Step: commit —
  ```bash
  git add docs/realtime.md CLAUDE.md
  git commit -m "docs(realtime): workspace-pulse pattern doc + CLAUDE.md doc row

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.12: `lib/cron/auth.ts` — fail-closed CRON_SECRET guard (TDD)

**Files:**
- Test: `/Users/luca/dev/winter-park/template/lib/cron/auth.test.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/cron/auth.ts` (extraction of the `isAuthorized` + fail-closed env check duplicated across every irene cron route, e.g. `/Users/luca/dev/winter-park/irene/app/api/cron/purge-spans/route.ts` lines 26–33 and 63–69)

**Interfaces:**
- Consumes: nothing (web-standard `Request`/`Response` only — deliberately framework-light so it unit-tests without Next).
- Produces:
  - `isCronAuthorized(req: Request, expected: string): boolean` — accepts `x-cron-secret: <secret>` OR `Authorization: Bearer <secret>` (Vercel Cron's convention).
  - `requireCronAuth(req: Request): Response | null` — `null` = authorized; otherwise a JSON `Response` to return as-is: 401 `{ ok: false, error: 'CRON_SECRET not configured' }` when the env var is unset (fail-closed), 403 `{ ok: false, error: 'forbidden' }` on mismatch. Consumed by Task 9.14 and every future cron route.

**Steps:**

- [ ] Step: write failing test — Write `/Users/luca/dev/winter-park/template/lib/cron/auth.test.ts` with exactly:

  ```typescript
  import { afterEach, beforeEach, describe, expect, it } from 'vitest'
  import { isCronAuthorized, requireCronAuth } from './auth'

  const url = 'http://localhost:3000/api/cron/test'
  const post = (headers?: Record<string, string>) => new Request(url, { method: 'POST', headers })

  describe('isCronAuthorized', () => {
    it('accepts the x-cron-secret header', () => {
      expect(isCronAuthorized(post({ 'x-cron-secret': 's3cret' }), 's3cret')).toBe(true)
    })

    it('accepts the Vercel Cron Authorization: Bearer header', () => {
      expect(isCronAuthorized(post({ authorization: 'Bearer s3cret' }), 's3cret')).toBe(true)
    })

    it('rejects a wrong secret', () => {
      expect(isCronAuthorized(post({ 'x-cron-secret': 'nope' }), 's3cret')).toBe(false)
    })

    it('rejects when both headers are missing', () => {
      expect(isCronAuthorized(post(), 's3cret')).toBe(false)
    })

    it('rejects a bare token without the Bearer prefix', () => {
      expect(isCronAuthorized(post({ authorization: 's3cret' }), 's3cret')).toBe(false)
    })
  })

  describe('requireCronAuth', () => {
    const saved = process.env.CRON_SECRET
    beforeEach(() => { delete process.env.CRON_SECRET })
    afterEach(() => {
      if (saved === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = saved
    })

    it('fails closed with 401 when CRON_SECRET is unset — even with a header present', async () => {
      const res = requireCronAuth(post({ 'x-cron-secret': 'anything' }))
      expect(res?.status).toBe(401)
      await expect(res!.json()).resolves.toEqual({ ok: false, error: 'CRON_SECRET not configured' })
    })

    it('returns 403 forbidden on a wrong secret', async () => {
      process.env.CRON_SECRET = 's3cret'
      const res = requireCronAuth(post({ 'x-cron-secret': 'nope' }))
      expect(res?.status).toBe(403)
      await expect(res!.json()).resolves.toEqual({ ok: false, error: 'forbidden' })
    })

    it('returns null (authorized) on a match via either header convention', () => {
      process.env.CRON_SECRET = 's3cret'
      expect(requireCronAuth(post({ 'x-cron-secret': 's3cret' }))).toBeNull()
      expect(requireCronAuth(post({ authorization: 'Bearer s3cret' }))).toBeNull()
    })
  })
  ```
- [ ] Step: run test, expect FAIL — Run: `npx vitest run lib/cron/auth.test.ts` → expected: exit 1, "Cannot find module './auth'" (or equivalent resolve error) — the module does not exist yet.
- [ ] Step: implement — Write `/Users/luca/dev/winter-park/template/lib/cron/auth.ts` with exactly:

  ```typescript
  /**
   * Shared auth gate for every `app/api/cron/*` route (see docs/cron.md).
   *
   * Fail-closed: with CRON_SECRET unset every cron route answers 401 — a
   * misconfigured deploy can never expose an open cron endpoint. Accepts BOTH
   * scheduler conventions:
   *   - Vercel Cron:            `Authorization: Bearer <secret>`
   *   - cron-job.org / curl:    `x-cron-secret: <secret>`
   *
   * Uses web-standard Request/Response (not NextResponse) so it stays
   * unit-testable without a Next runtime; route handlers can return the
   * Response as-is.
   */

  /** True when the request carries the expected secret via either convention. */
  export function isCronAuthorized(req: Request, expected: string): boolean {
    if (req.headers.get('x-cron-secret') === expected) return true
    if (req.headers.get('authorization') === `Bearer ${expected}`) return true
    return false
  }

  /**
   * Gate a cron route. Returns `null` when authorized, otherwise the error
   * Response to return immediately:
   *
   *   const denied = requireCronAuth(req)
   *   if (denied) return denied
   */
  export function requireCronAuth(req: Request): Response | null {
    const expected = process.env.CRON_SECRET
    if (!expected) {
      return Response.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 401 })
    }
    if (!isCronAuthorized(req, expected)) {
      return Response.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }
    return null
  }
  ```
- [ ] Step: run test, expect PASS — Run: `npx vitest run lib/cron/auth.test.ts` → expected: exit 0, 8 tests pass.
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  git add lib/cron/auth.ts lib/cron/auth.test.ts
  git commit -m "backport(cron): fail-closed CRON_SECRET guard (x-cron-secret + Vercel Bearer) with unit tests

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.13: `lib/cron/local-hour.ts` — per-tenant local-hour fan-out (TDD, fake timezones)

**Files:**
- Test: `/Users/luca/dev/winter-park/template/lib/cron/local-hour.test.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/cron/local-hour.ts` (generalized extraction of the hour-matching gate in `/Users/luca/dev/winter-park/irene/app/api/cron/digest/route.ts` — `currentHourInSalonTz` + the `localHour !== pref.sendHourLocal` skip loop; the digest *content* stays in irene)

**Interfaces:**
- Consumes: `partsInZone(instant: Date, timeZone: string): ZonedParts` from `@/lib/time/zoned` (phase 7 Task 7.4 — which explicitly promises it to this phase; invalid IANA zones fall back to UTC parts instead of throwing).
- Produces:
  - `currentHourInZone(timeZone: string, now?: Date): number` (0–23, tenant wall clock)
  - `type LocalHourTarget<T> = { tenant: T; timeZone: string; sendHourLocal: number }`
  - `dueAtLocalHour<T>(targets: ReadonlyArray<LocalHourTarget<T>>, now?: Date): T[]` — the fan-out filter an hourly cron maps over its tenants. Referenced by docs/cron.md (Task 9.15).

**Steps:**

- [ ] Step: dependency gate — Run: `test -f lib/time/zoned.ts && grep -q 'export function partsInZone' lib/time/zoned.ts && echo OK` → expected: `OK`. If not, STOP: phase 7 Task 7.4 has not landed; execute it first.
- [ ] Step: write failing test — Write `/Users/luca/dev/winter-park/template/lib/cron/local-hour.test.ts` with exactly:

  ```typescript
  import { describe, expect, it } from 'vitest'
  import { currentHourInZone, dueAtLocalHour } from './local-hour'

  // Fixed instant, no DST edge: 2026-01-15T12:00:00Z.
  // UTC 12h · America/Sao_Paulo (UTC-3) 9h · Asia/Tokyo (UTC+9) 21h ·
  // America/New_York (EST, UTC-5) 7h.
  const NOW = new Date('2026-01-15T12:00:00Z')

  describe('currentHourInZone', () => {
    it('returns the wall-clock hour of the zone, not UTC', () => {
      expect(currentHourInZone('UTC', NOW)).toBe(12)
      expect(currentHourInZone('America/Sao_Paulo', NOW)).toBe(9)
      expect(currentHourInZone('Asia/Tokyo', NOW)).toBe(21)
      expect(currentHourInZone('America/New_York', NOW)).toBe(7)
    })

    it('tracks DST: New York is UTC-4 in July', () => {
      expect(currentHourInZone('America/New_York', new Date('2026-07-15T12:00:00Z'))).toBe(8)
    })
  })

  describe('dueAtLocalHour', () => {
    const targets = [
      { tenant: 'utc-noon', timeZone: 'UTC',               sendHourLocal: 12 },
      { tenant: 'sp-nine',  timeZone: 'America/Sao_Paulo', sendHourLocal: 9 },
      { tenant: 'sp-eight', timeZone: 'America/Sao_Paulo', sendHourLocal: 8 },
      { tenant: 'tokyo-21', timeZone: 'Asia/Tokyo',        sendHourLocal: 21 },
      { tenant: 'ny-noon',  timeZone: 'America/New_York',  sendHourLocal: 12 },
    ]

    it('selects exactly the tenants whose OWN local hour matches right now', () => {
      expect(dueAtLocalHour(targets, NOW)).toEqual(['utc-noon', 'sp-nine', 'tokyo-21'])
    })

    it('one hourly sweep hits every tenant exactly once per day, each at its own hour', () => {
      const hits: string[] = []
      for (let h = 0; h < 24; h++) {
        hits.push(...dueAtLocalHour(targets, new Date(Date.UTC(2026, 0, 15, h))))
      }
      expect(hits.sort()).toEqual(['ny-noon', 'sp-eight', 'sp-nine', 'tokyo-21', 'utc-noon'])
    })

    it('normalizes hour 24 onto the 0–23 ring', () => {
      const t = [{ tenant: 'x', timeZone: 'UTC', sendHourLocal: 24 }]
      expect(dueAtLocalHour(t, new Date('2026-01-15T00:30:00Z'))).toEqual(['x'])
    })

    it('treats an invalid IANA zone as UTC (partsInZone fallback) instead of throwing', () => {
      const t = [{ tenant: 'bad', timeZone: 'Not/AZone', sendHourLocal: 12 }]
      expect(dueAtLocalHour(t, NOW)).toEqual(['bad'])
    })
  })
  ```
- [ ] Step: run test, expect FAIL — Run: `npx vitest run lib/cron/local-hour.test.ts` → expected: exit 1, "Cannot find module './local-hour'" (module does not exist yet).
- [ ] Step: implement — Write `/Users/luca/dev/winter-park/template/lib/cron/local-hour.ts` with exactly:

  ```typescript
  import { partsInZone } from '@/lib/time/zoned'

  /**
   * Per-tenant local-hour fan-out for HOURLY crons (see docs/cron.md).
   *
   * Pattern (extracted from a production hourly-digest cron): schedule ONE cron
   * every hour ("0 * * * *"); on each run, fan out only to the tenants whose
   * OWN wall clock currently reads their configured send hour. Every tenant
   * gets its job at its own local time (08:00 in São Paulo AND 08:00 in Tokyo)
   * from a single schedule — no per-tenant cron entries, DST handled by the
   * IANA zone database.
   */

  export type LocalHourTarget<T> = {
    tenant: T
    /** IANA timezone (e.g. 'America/Sao_Paulo'). Invalid zones fall back to
     *  UTC — inherited from partsInZone (lib/time/zoned.ts). */
    timeZone: string
    /** Local wall-clock hour (0–23) the tenant's job should fire at. Values
     *  outside the range wrap onto the 0–23 ring (24 → 0). */
    sendHourLocal: number
  }

  /** Current hour (0–23) on the tenant's own wall clock. */
  export function currentHourInZone(timeZone: string, now: Date = new Date()): number {
    return partsInZone(now, timeZone).hour
  }

  /** The tenants due RIGHT NOW: their own local hour equals their send hour. */
  export function dueAtLocalHour<T>(
    targets: ReadonlyArray<LocalHourTarget<T>>,
    now: Date = new Date(),
  ): T[] {
    return targets
      .filter((t) => currentHourInZone(t.timeZone, now) === normalizeHour(t.sendHourLocal))
      .map((t) => t.tenant)
  }

  /** Clamp any integer onto the 0–23 ring (24 → 0, -1 → 23). */
  function normalizeHour(hour: number): number {
    return ((Math.trunc(hour) % 24) + 24) % 24
  }
  ```
- [ ] Step: run test, expect PASS — Run: `npx vitest run lib/cron/local-hour.test.ts` → expected: exit 0, 6 tests pass.
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `npx vitest run lib/cron` → expected: exit 0 (both cron test files green).
- [ ] Step: commit —
  ```bash
  git add lib/cron/local-hour.ts lib/cron/local-hour.test.ts
  git commit -m "backport(cron): per-tenant local-hour fan-out helper with fake-timezone unit tests

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.14: Example retention route `app/api/cron/purge-spans/route.ts` + `vercel.json` skeleton

**Files:**
- Create: `/Users/luca/dev/winter-park/template/app/api/cron/purge-spans/route.ts` (port of `/Users/luca/dev/winter-park/irene/app/api/cron/purge-spans/route.ts`, 72 lines — inline `isAuthorized` replaced by Task 9.12's guard)
- Create: `/Users/luca/dev/winter-park/template/vercel.json` (NEW — skeleton only; irene's five salon crons do NOT port)

**Interfaces:**
- Consumes: `requireCronAuth` (Task 9.12); `traceSpan` from `@/db/schema` (phase 3 Task 3.2 — `created_at` timestamptz column); `db` from `@/db/drizzle`.
- Produces: `POST /api/cron/purge-spans` (+ `GET` alias for Vercel Cron, same gated handler) returning `{ ok: true, deleted, batches, retentionDays, hitMaxBatches }`; root `vercel.json` with `$schema` + empty `crons` array (apps add entries per docs/cron.md).

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/app/api/cron/purge-spans/route.ts` with exactly this content (irene port; enumerated changes: the fail-closed env check + `isAuthorized` helper (irene lines 26–33, 63–69) are replaced by `requireCronAuth` from `@/lib/cron/auth`; auth doc-comment paragraph now points at lib/cron/auth; chunked-DELETE logic, constants, and response shape verbatim):

  ```typescript
  import { NextResponse } from 'next/server'
  import { sql } from 'drizzle-orm'
  import { db } from '@/db/drizzle'
  import { traceSpan } from '@/db/schema'
  import { requireCronAuth } from '@/lib/cron/auth'

  /**
   * Daily-ish trace_span retention job.
   *
   * Wire to whichever scheduler you have — see `docs/cron.md` for setup.
   *
   * Auth: `requireCronAuth` (lib/cron/auth.ts) — fail-closed on missing
   * CRON_SECRET; accepts both `Authorization: Bearer <secret>` (Vercel Cron)
   * and `x-cron-secret: <secret>` (cron-job.org / curl).
   *
   * Chunked DELETE: a single unbounded `DELETE FROM trace_span WHERE created_at < ...`
   * locks the table for the full delete duration. At 1M+ stale rows that's 30–90s
   * of write blocking. Chunked deletion (`LIMIT 5000` per pass, repeated until
   * empty) keeps each lock-held window to ~50ms while still cleaning everything
   * old. Capped at MAX_BATCHES iterations to bound cron runtime.
   */
  const RETENTION_DAYS = 30
  const CHUNK_SIZE     = 5000
  const MAX_BATCHES    = 200   // 1M rows / pass max; safety ceiling

  export async function POST(req: Request) {
    const denied = requireCronAuth(req)
    if (denied) return denied

    let totalDeleted = 0
    let batches      = 0
    for (; batches < MAX_BATCHES; batches++) {
      // ctid-based chunked delete — fastest pattern in pg for "delete N old rows"
      // because the planner can use an index-only scan over the inner SELECT.
      const result = await db.execute(sql`
        DELETE FROM ${traceSpan}
        WHERE ctid IN (
          SELECT ctid FROM ${traceSpan}
          WHERE created_at < NOW() - INTERVAL '${sql.raw(String(RETENTION_DAYS))} days'
          LIMIT ${CHUNK_SIZE}
        )
      `)
      const deleted = (result as unknown as { rowCount?: number }).rowCount ?? 0
      totalDeleted += deleted
      if (deleted === 0) break
    }

    return NextResponse.json({
      ok:             true,
      deleted:        totalDeleted,
      batches:        batches + 1,
      retentionDays:  RETENTION_DAYS,
      hitMaxBatches:  batches >= MAX_BATCHES,
    })
  }

  // Vercel Cron invokes via GET; alias to the same handler (CRON_SECRET-gated).
  export const GET = POST
  ```
- [ ] Step: Write `/Users/luca/dev/winter-park/template/vercel.json` with exactly this content (skeleton per spec — the job catalog in docs/cron.md shows the purge-spans entry to add when deploying on Vercel):

  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "crons": []
  }
  ```
- [ ] Step: verification — Run: `npx tsc --noEmit` → expected: exit 0. Run: `node -e "const v = JSON.parse(require('fs').readFileSync('vercel.json','utf8')); if (!Array.isArray(v.crons) || v.crons.length !== 0) process.exit(1)"` → expected: exit 0. Run: `npx eslint app/api/cron --max-warnings=0` → expected: exit 0. Live run (`curl -X POST -H "x-cron-secret: ..." http://localhost:3000/api/cron/purge-spans`) defers to phase 13's gate (needs DB + dev server).
- [ ] Step: commit —
  ```bash
  git add app/api/cron/purge-spans/route.ts vercel.json
  git commit -m "backport(cron): purge-spans trace_span retention route + vercel.json crons skeleton

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9.15: `docs/cron.md` + CLAUDE.md doc row + .env.example CRON check

**Files:**
- Create: `/Users/luca/dev/winter-park/template/docs/cron.md` (adapted from `/Users/luca/dev/winter-park/irene/docs/cron.md`, 208 lines — salon job catalog (expire-bundles, book-recurring-finance, renew-memberships, digest) dropped; purge-spans kept as the single example; NEW section for the lib/cron kernels)
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (docs table)

**Interfaces:**
- Consumes: Tasks 9.12–9.14 (documents them).
- Produces: `docs/cron.md` served at `/docs/cron` (frontmatter `category: Infrastructure`, `order: 16`) — the convention every future `app/api/cron/*` route follows.

**Steps:**

- [ ] Step: Write `/Users/luca/dev/winter-park/template/docs/cron.md` with exactly this content:

  ````markdown
  ---
  title: Cron Jobs
  order: 16
  category: Infrastructure
  ---

  # Cron Jobs

  Background jobs that don't belong inside a user request — retention sweeps,
  periodic recomputes, scheduled cleanups — live as `POST` route handlers under
  `app/api/cron/<name>/route.ts`. They're invoked by an external scheduler
  (Vercel Cron, cron-job.org, a Linux cron, etc.) over HTTP, gated by a shared
  secret.

  This file explains the convention + lists every cron job in the repo + shows
  how to add a new one.

  ## The convention

  Every cron job:

  1. Lives at `app/api/cron/<name>/route.ts`.
  2. Exports `POST(req: Request)`. The ONLY permitted `GET` is the gated alias
     `export const GET = POST` — Vercel Cron invokes via GET; the alias runs the
     exact same `CRON_SECRET`-checked handler, so a casual visitor still can't
     trigger it.
  3. First line: `const denied = requireCronAuth(req); if (denied) return denied`
     (`lib/cron/auth.ts`). Fails closed (401) if `CRON_SECRET` is unset, 403 if
     the header doesn't match. Accepts both `x-cron-secret: <secret>` and
     `Authorization: Bearer <secret>`.
  4. Returns `NextResponse.json({ ok: true, ...metrics })` on success; the
     metrics fields (e.g. `deleted: N`) help with observability.
  5. Idempotent — safe to run twice in a row, safe to run during a deploy. No
     state in route-handler memory between calls.
  6. Bounded — never scan or mutate without a `WHERE created_at < ...` or
     similar predicate, and chunk big deletes. Don't delete `WHERE 1=1`.
  7. Documented here.

  ## Setup

  ### 1. Pick a `CRON_SECRET`

  Generate one (any 32+ character string is fine):

  ```bash
  openssl rand -hex 32
  ```

  Add to `.env` (and to your production env via your hosting provider's secrets
  UI). If you never set it, every cron route returns
  `401 { ok: false, error: 'CRON_SECRET not configured' }` — fails closed.
  Rotate it any time by updating both the env var and your scheduler config.

  ### 2. Wire to a scheduler

  #### Vercel Cron (recommended on Vercel)

  `vercel.json` at the repo root ships with an empty `crons` array. Add entries:

  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "crons": [
      { "path": "/api/cron/purge-spans", "schedule": "0 3 * * *" }
    ]
  }
  ```

  Vercel invokes the path via **GET** (hence the gated alias) and forwards
  `Authorization: Bearer $CRON_SECRET` automatically once `CRON_SECRET` is set
  in the project env — `requireCronAuth` accepts that convention as-is.

  #### cron-job.org / EasyCron / external scheduler

  ```
  POST https://<your-domain>/api/cron/purge-spans
  Header: x-cron-secret: <your CRON_SECRET>
  Schedule: every day at 03:00 UTC
  ```

  #### Local dev (manual)

  ```bash
  curl -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/purge-spans
  ```

  ## Job catalog

  ### `purge-spans`

  | | |
  |---|---|
  | **Path** | `/api/cron/purge-spans` |
  | **Source** | `app/api/cron/purge-spans/route.ts` |
  | **Schedule** | Daily at 03:00 (recommended) |
  | **What it does** | Deletes rows from `trace_span` older than 30 days, in `LIMIT 5000` chunks |
  | **Why** | OTel spans accumulate fast (every server action + cached query writes one). Without retention, the table grows unbounded |
  | **Returns** | `{ ok: true, deleted, batches, retentionDays, hitMaxBatches }` |
  | **Configurable** | `RETENTION_DAYS` / `CHUNK_SIZE` / `MAX_BATCHES` consts at the top of the route file |

  If you skip wiring this and the table grows too large, run manually:

  ```sql
  DELETE FROM trace_span WHERE created_at < NOW() - INTERVAL '30 days';
  ```

  ## Per-tenant local-hour fan-out

  For a job that must run "at each tenant's own 08:00" (digests, reminders):
  schedule ONE hourly cron (`"0 * * * *"`) and gate per tenant with
  `lib/cron/local-hour.ts`:

  ```ts
  import { dueAtLocalHour } from '@/lib/cron/local-hour'

  // rows: [{ workspaceId, timeZone, sendHourLocal }, ...] from your pref table
  const due = dueAtLocalHour(
    rows.map((r) => ({ tenant: r, timeZone: r.timeZone, sendHourLocal: r.sendHourLocal })),
  )
  for (const r of due) {
    // assemble + send for r.workspaceId only
  }
  ```

  Every tenant fires exactly once a day at its own wall-clock hour, DST handled
  by the IANA zone database (`partsInZone`, `lib/time/zoned.ts`); invalid zones
  fall back to UTC rather than crashing the sweep. Two useful escape hatches
  from the pattern's origin: support `?<tenant>Id=` to bypass the hour gate for
  a manual single-tenant run, and `?dryRun=1` to assemble without sending.

  ## Adding a new cron job

  ```bash
  mkdir -p "app/api/cron/<name>"
  touch    "app/api/cron/<name>/route.ts"
  ```

  Template:

  ```ts
  // app/api/cron/your-job/route.ts
  import { NextResponse } from 'next/server'
  import { sql } from 'drizzle-orm'
  import { db } from '@/db/drizzle'
  import { requireCronAuth } from '@/lib/cron/auth'

  export async function POST(req: Request) {
    const denied = requireCronAuth(req)
    if (denied) return denied

    // Your bounded work here. Always include a WHERE / LIMIT.
    const result = await db.execute(sql`...`)
    const affected = (result as unknown as { rowCount?: number }).rowCount ?? 0

    return NextResponse.json({ ok: true, affected })
  }

  // Vercel Cron invokes via GET; alias to the same handler (CRON_SECRET-gated).
  export const GET = POST
  ```

  Then:
  1. Add an entry to **Job catalog** above.
  2. Wire it to your scheduler (`vercel.json` `crons` on Vercel).
  3. Test locally with curl before deploying.

  ## Observability

  Cron runs go through the same OTel tracing as everything else — spans land in
  `trace_span`. To inspect recent runs:

  ```sql
  SELECT name, status, duration_ms, error_message, created_at
  FROM trace_span
  WHERE name LIKE '%cron%' OR attributes->>'http.target' LIKE '/api/cron/%'
  ORDER BY created_at DESC LIMIT 20;
  ```

  Set up a separate alert (Slack webhook, email, whatever) on `status = 'error'`
  rate spikes to catch crons silently failing.

  ## Anti-patterns to avoid

  - **No auth.** Don't ship a cron route that anyone on the internet can `POST`.
    The `requireCronAuth` check is mandatory and comes first.
  - **Ungated `GET` handlers.** A `GET` can be hit by a browser, a bot, or a
    link prefetcher. The only `GET` allowed is the `export const GET = POST`
    alias — same secret gate, needed because Vercel Cron invokes via GET.
  - **Unbounded deletes/updates.** Always include a `WHERE` predicate that
    limits scope, and chunk big mutations (see purge-spans' ctid pattern).
  - **Long-running synchronous work.** If the job needs >30s, chunk it (process
    N rows at a time, requeue) or move to a real background worker
    (BullMQ/Inngest/Trigger.dev).
  - **State in module-level variables.** Route handlers can be called by
    multiple instances; in-memory state doesn't survive deploys or replicas.
  - **Reads from `cookies()`/`headers()` for user context.** Crons run
    unauthenticated by design — they're system jobs. If you need to act *as a
    user*, look the user up via the DB and pass them through your domain
    functions explicitly.
  ````
- [ ] Step: edit `/Users/luca/dev/winter-park/template/CLAUDE.md` — append to the docs table after the `realtime.md` row (added by Task 9.11):

  ```markdown
  | [`cron.md`](docs/cron.md) | Cron convention: fail-closed `CRON_SECRET` gate, job catalog, per-tenant local-hour fan-out |
  ```
- [ ] Step: .env.example check (scope: CRON_SECRET row flips to active) — Run: `grep -cE '^CRON_SECRET=' .env.example` → expected: `1`, and Run: `grep -c 'docs/cron.md' .env.example` → expected: `1`. Phase 1 Task 1.3 pre-seeded the CRON group with a comment referencing `docs/cron.md` and the fail-closed 401 behavior — now accurate as written; **no edit needed**. If either grep fails, re-apply phase 1 Task 1.3's Cron block verbatim.
- [ ] Step: verification — Run: `head -5 docs/cron.md | grep -c 'order: 16'` → expected: `1`. Run: `grep -c 'cron.md' CLAUDE.md` → expected: ≥ 1. Run: `npx vitest run lib/cron` → expected: exit 0. Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```bash
  git add docs/cron.md CLAUDE.md
  git commit -m "docs(cron): cron convention (fail-closed gate, catalog, local-hour fan-out) + CLAUDE.md doc row

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

## Phase completion check

- [ ] Run: `npx tsc --noEmit` → exit 0.
- [ ] Run: `npx vitest run` → exit 0 (includes `lib/cron/auth.test.ts` 8 tests + `lib/cron/local-hour.test.ts` 6 tests, plus all earlier phases' suites).
- [ ] Run: `npx eslint lib/blob lib/realtime lib/cron components/ui/ImageUpload.tsx components/ui/useImageUpload.ts components/ui/AvatarField.tsx components/ui/useAvatarField.ts app/api/blob-image app/api/cron app/api/workspace --max-warnings=0` → exit 0.
- [ ] Run: `grep -rn 'salon\|irene\|#031' lib/blob lib/realtime lib/cron app/api/blob-image app/api/cron app/api/workspace components/ui/ImageUpload.tsx components/ui/useImageUpload.ts components/ui/AvatarField.tsx components/ui/useAvatarField.ts docs/blob.md docs/realtime.md docs/cron.md` → 0 matches.
- [ ] `npm run build` (migration runner + next build) and live route exercises (upload, `/api/blob-image`, SSE stream, purge-spans curl) → defer to phase 13's gate when no scratch `DATABASE_URL` is configured.
