import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Styled native `<select>` — Input chrome + chevron affordance. Native keeps it
 * accessible + form-compatible (name/defaultValue/onChange). Pass `<option>`s
 * as children.
 */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm shadow-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}
