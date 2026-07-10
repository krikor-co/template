import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * CVA button — the template's single button primitive. `default` rides the
 * primary token; `brand`/`accent` ride the accent-slot triads (swap hues via
 * the token palette, never here); plus secondary, outline, ghost, destructive,
 * link. `block` defaults to full-width (historical template behaviour);
 * `className` still wins via tailwind-merge.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ' +
    'transition-[opacity,transform,background-color,color,box-shadow] duration-150 ease-out ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 ' +
    '[&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground shadow-sm hover:opacity-90',
        brand:       'bg-brand text-brand-foreground shadow-sm hover:opacity-90',
        accent:      'bg-accent text-accent-foreground shadow-sm hover:opacity-90',
        secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        outline:     'border border-input bg-transparent text-foreground hover:bg-secondary/60',
        ghost:       'text-foreground hover:bg-secondary/60',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:opacity-90',
        link:        'text-foreground underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 text-sm',
        sm:      'h-9 px-4 text-xs',
        lg:      'h-12 px-7 text-base',
        icon:    'h-10 w-10 p-0',
      },
      block: {
        true:  'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      block: true,
    },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
  )
}
