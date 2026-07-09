import { cn } from '@/lib/utils'

/**
 * Rounded-square icon container — the leading affordance on list rows, stat
 * tiles, and nav items (seen all over the references). Tinted by tone.
 */
const tones = {
  plain:       'bg-secondary text-foreground',
  brand:       'bg-brand-soft text-brand-deep',
  accent:      'bg-accent text-accent-foreground',
  info:        'bg-info-soft text-info-deep',
  success:     'bg-success-soft text-success-deep',
  warning:     'bg-warning-soft text-warning-deep',
  destructive: 'bg-destructive-soft text-destructive-deep',
} as const

const sizes = {
  sm: 'size-8 rounded-lg [&_svg]:size-4',
  md: 'size-10 rounded-xl [&_svg]:size-5',
  lg: 'size-12 rounded-2xl [&_svg]:size-6',
} as const

export function IconChip({
  tone = 'plain',
  size = 'md',
  className,
  children,
}: {
  tone?: keyof typeof tones
  size?: keyof typeof sizes
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center', tones[tone], sizes[size], className)}>
      {children}
    </span>
  )
}
