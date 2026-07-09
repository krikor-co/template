import { cn } from '@/lib/utils'

const SIZE = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-sm' } as const

/** Tone palette for initial-avatars — deterministic per name. */
const TONES = ['bg-success-soft text-success-deep', 'bg-brand-soft text-brand-deep', 'bg-warning-soft text-warning-deep', 'bg-info-soft text-info-deep']

function toneFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return TONES[Math.abs(h) % TONES.length]
}

function initials(name: string) {
  const all = name.trim().split(/\s+/)
  // Only build initials from word-like tokens — skip parenthetical/suffix
  // tokens that don't start with a letter (e.g. "Luca Baires (PRO)" → "LB",
  // not "L(").
  const parts = all.filter((p) => /^\p{L}/u.test(p))
  const src = parts.length ? parts : all
  return ((src[0]?.[0] ?? '') + (src.length > 1 ? src[src.length - 1][0] : '')).toUpperCase() || '?'
}

/**
 * Avatar — renders the person's uploaded profile picture (`src`) when present,
 * otherwise a round initials chip tinted deterministically by name. `src` is a
 * stored blob URL; pass `toSrc` to route it through an authed proxy (e.g. the
 * blob-image proxy once the Blob integration lands), and an empty/unresolved src
 * falls back to initials — so existing call sites that pass only `name` are unchanged.
 */
export function Avatar({ name, src, toSrc, size = 'md', className }: { name: string; src?: string | null; /** Optional URL mapper (e.g. an authed blob proxy) applied to a non-empty `src`. */ toSrc?: (src: string) => string | null; size?: keyof typeof SIZE; className?: string }) {
  const imgSrc = src ? (toSrc ? toSrc(src) : src) : null
  if (imgSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- proxy URL, not an optimizable next/image source
      <img
        src={imgSrc}
        alt={name}
        title={name}
        className={cn('inline-block shrink-0 rounded-full object-cover ring-2 ring-card', SIZE[size].split(' ')[0], className)}
      />
    )
  }
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-medium ring-2 ring-card', SIZE[size], toneFor(name), className)}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  )
}

/** Overlapping avatar stack with a +N overflow chip. */
export function AvatarGroup({
  names,
  srcs,
  toSrc,
  max = 4,
  size = 'md',
  className,
}: {
  names: string[]
  /** Optional avatar image URLs, parallel to `names`. Missing/null → initials. */
  srcs?: (string | null | undefined)[]
  toSrc?: (src: string) => string | null
  max?:  number
  size?: keyof typeof SIZE
  className?: string
}) {
  const shown = names.slice(0, max)
  const extra = names.length - shown.length
  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {shown.map((n, i) => <Avatar key={i} name={n} src={srcs?.[i]} toSrc={toSrc} size={size} />)}
      {extra > 0 && (
        <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-muted-foreground ring-2 ring-card tabular-nums', SIZE[size])}>
          +{extra}
        </span>
      )}
    </div>
  )
}
