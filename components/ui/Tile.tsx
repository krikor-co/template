import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Colored bento tile — the building block of the dashboard grid. `plain`
 * is the neutral card; **soft** tones tint the bg and set the base text to the
 * tone's *deep* accent (tonal & crisp — never washed-out grey ink) plus a
 * hairline ring of the deep tone for edge definition; **solid** tones fully
 * saturate with inverted text (commit to bold color blocks like the references
 * — a solid warning/brand/accent tile with a big white number). Very round
 * + generous padding so the grid breathes.
 *
 * Contrast rule (hard): on a soft fill, text/icons/numbers ride the tone's
 * `-deep` token via `text-current` inheritance — never `text-muted-foreground`
 * or the light `-foreground`. Sub-labels dim with `opacity`, not grey.
 */
export const tileVariants = cva('rounded-3xl p-6 shadow-card', {
  variants: {
    tone: {
      plain:           'bg-card text-card-foreground',
      brand:           'bg-brand-soft text-brand-deep ring-1 ring-inset ring-brand-deep/10',
      success:         'bg-success-soft text-success-deep ring-1 ring-inset ring-success-deep/10',
      warning:         'bg-warning-soft text-warning-deep ring-1 ring-inset ring-warning-deep/10',
      'brand-solid':   'bg-brand text-brand-foreground',
      'success-solid': 'bg-success text-success-foreground',
      'warning-solid': 'bg-warning text-warning-foreground',
      // Solid dark/neutral anchor block.
      accent:          'bg-accent text-accent-foreground',
      // Cool accent — AI / info surfaces ONLY (insight cards, info banners).
      info:            'bg-info-soft text-info-deep ring-1 ring-inset ring-info-deep/10',
      'info-solid':    'bg-info text-info-foreground',
      // Designed error-state surface (soft red, deep-red ink).
      destructive:     'bg-destructive-soft text-destructive-deep ring-1 ring-inset ring-destructive-deep/10',
    },
  },
  defaultVariants: { tone: 'plain' },
})

/** True for tones that render inverted (light) text on a saturated bg. */
export function isSolidTone(tone?: string | null): boolean {
  return tone === 'accent' || (typeof tone === 'string' && tone.endsWith('-solid'))
}

export type TileProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof tileVariants>

export function Tile({ className, tone, ...props }: TileProps) {
  return <div className={cn(tileVariants({ tone }), className)} {...props} />
}
