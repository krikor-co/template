import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** Pill badge — soft tinted fills from the accent-slot palette. */
export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3',
  {
    variants: {
      // Soft fills always use the -deep (dark) accent text — never -foreground
      // (that's the LIGHT text for solid backgrounds).
      variant: {
        default:     'bg-secondary text-secondary-foreground',
        brand:       'bg-brand-soft text-brand-deep',
        accent:      'bg-accent text-accent-foreground',
        info:        'bg-info-soft text-info-deep',
        success:     'bg-success-soft text-success-deep',
        warning:     'bg-warning-soft text-warning-deep',
        destructive: 'bg-destructive-soft text-destructive-deep',
        outline:     'border border-input text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
