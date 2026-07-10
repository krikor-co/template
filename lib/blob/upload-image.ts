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
        // `addRandomSuffix` keeps pathnames unguessable (defense in depth on
        // top of the proxy's per-workspace authz — deterministic paths would
        // otherwise be enumerable: sequential workspaceId + slugified name +
        // millisecond timestamp). The `<folder>/<workspaceId>/…` prefix is
        // LOAD-BEARING: `/api/blob-image` parses the second segment to gate
        // reads on workspace membership.
        put(`${folder}/${workspaceId}/${Date.now()}-${safeName(file.name)}`, file, {
          access,
          addRandomSuffix: true,
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
