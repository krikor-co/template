'use client'

import { cn } from '@/lib/utils'

/**
 * Pill segmented control (Day/Week/Month/Year, Overview/Invoices/…). Controlled:
 * pass `value` + `onChange`. For a non-interactive / link-based segmented look,
 * use the `SegmentedLinks` markup pattern instead.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: { value: T; label: React.ReactNode }[]
  value:   T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex items-center gap-1 rounded-full bg-secondary p-1', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-full font-medium transition-colors',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
