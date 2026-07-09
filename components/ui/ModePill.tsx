import { cn } from '@/lib/utils'

/**
 * ModePill — the *secondary* descriptor pill that rides beside a
 * {@link StatusPill}: a payment method, a role, a channel, a recurrence mode
 * ("monthly"). Deliberately quieter than a StatusPill — `outline`/`secondary`
 * tints only, never a status color — so the status pill keeps the eye and the
 * mode pill reads as context.
 *
 * Pairs with StatusPill, never used for status itself.
 */
const tones = {
  secondary: 'bg-secondary text-secondary-foreground',
  outline:   'border border-input text-muted-foreground',
} as const

export type ModePillProps = {
  label: React.ReactNode
  /** Optional tiny leading glyph (lucide icon). */
  icon?: React.ReactNode
  tone?: keyof typeof tones
  className?: string
}

export function ModePill({ label, icon, tone = 'secondary', className }: ModePillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3 [&_svg]:text-muted-foreground',
        tones[tone],
        className,
      )}
    >
      {icon}
      {label}
    </span>
  )
}
