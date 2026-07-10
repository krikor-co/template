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

- **Workspace-gated** — the blob pathname is `<folder>/<workspaceId>/…` by
  construction, so the proxy parses the `workspaceId` segment and requires an
  active `owner`/`member` membership (`requireWorkspaceRole`). 401 without a
  session, 403 without membership or for any pathname outside the convention
  (fail closed). Session-only gating is NOT enough — it would let any
  signed-in user read any workspace's assets. If an app adds a new
  private-blob namespace (e.g. per-user avatars), extend the route with the
  matching ownership rule.
- **Unguessable pathnames** — uploads pass `addRandomSuffix: true`, so URLs
  can't be reconstructed by enumeration (defense in depth on top of the
  membership gate).
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
