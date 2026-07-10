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
