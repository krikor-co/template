'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { useListSearch } from '@/lib/list/useListSearch'

/**
 * ListSearchBox — debounced `?q=` search input for server-paginated LIST pages. Pushes the
 * query into the URL (resetting to page 1); the server section re-runs its
 * filtered + paginated query. Owns no business state — a pure navigation widget.
 */
export function ListSearchBox({
  initialValue,
  placeholder,
  className,
}: {
  initialValue?: string
  placeholder:   string
  className?:    string
}) {
  const { value, setValue } = useListSearch(initialValue)

  return (
    <div className={cn('relative max-w-xs', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-10"
      />
    </div>
  )
}
