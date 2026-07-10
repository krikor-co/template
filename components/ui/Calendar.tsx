'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/**
 * react-day-picker styled with the template tokens: `bg-card` surface,
 * `bg-secondary`/`muted` for nav + hover, `primary` for the selected day,
 * rounded-xl cells. Numbers are tabular.
 *
 * Used inside {@link DatePicker} (popover) but generic — pass any DayPicker
 * props (`mode`, `selected`, `onSelect`, `disabled`, `defaultMonth`, …).
 */
export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const defaults = getDefaultClassNames()
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-1', className)}
      classNames={{
        root: cn(defaults.root, 'text-foreground'),
        months: 'relative flex flex-col gap-4',
        month: 'space-y-3',
        month_caption: 'flex h-9 items-center justify-center px-10',
        caption_label: 'text-sm font-semibold tracking-tight tabular-nums',
        nav: 'absolute inset-x-1 top-0 flex items-center justify-between',
        button_previous: cn(
          'inline-flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground',
          'transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40',
        ),
        button_next: cn(
          'inline-flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground',
          'transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground',
        weeks: '',
        week: 'mt-1 flex w-full',
        day: cn('size-9 p-0 text-center text-sm tabular-nums', defaults.day),
        day_button: cn(
          'inline-flex size-9 items-center justify-center rounded-xl font-normal',
          'transition-colors hover:bg-muted hover:text-foreground',
          'aria-selected:font-semibold',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        ),
        selected: cn(
          '[&>button]:bg-primary [&>button]:text-primary-foreground',
          '[&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
        ),
        today: '[&>button]:bg-secondary [&>button]:text-foreground',
        outside: 'text-muted-foreground/50',
        disabled: 'text-muted-foreground/40 [&>button]:pointer-events-none [&>button]:opacity-40',
        range_start: '[&>button]:bg-primary [&>button]:text-primary-foreground',
        range_end: '[&>button]:bg-primary [&>button]:text-primary-foreground',
        range_middle: '[&>button]:rounded-none [&>button]:bg-muted [&>button]:text-foreground',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass }) =>
          orientation === 'left'
            ? <ChevronLeft className={cn('size-4', chevronClass)} />
            : <ChevronRight className={cn('size-4', chevronClass)} />,
      }}
      {...props}
    />
  )
}
