import { cn } from '@/lib/utils'

/**
 * Editorial uppercase, letter-spaced micro-label (`.label-micro`). The
 * section kicker used across the app (`RECENTLY ADDED`, `:: OVERVIEW`).
 * Renders an accessible heading by default; pass `as="span"` for inline use.
 */
export function SectionLabel({
  as: Tag = 'h2',
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: 'h2' | 'h3' | 'span' | 'p' }) {
  return <Tag className={cn('label-micro', className)} {...props} />
}
