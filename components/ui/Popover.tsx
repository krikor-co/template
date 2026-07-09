'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

/**
 * Radix-backed popover, styled with the card tokens. Used to float a
 * calendar (or any small panel) above a trigger button. The content surface is
 * a `bg-card` surface with `shadow-card`, rounded-2xl — never a flat white box.
 */
export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-auto rounded-2xl border border-border bg-card p-3 text-foreground shadow-card outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
