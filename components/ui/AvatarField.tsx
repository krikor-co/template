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
