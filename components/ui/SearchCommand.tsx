'use client'

import { Search, CornerDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconChip } from './IconChip'
import { useSearchCommand } from './useSearchCommand'

/**
 * SearchCommand — the topbar quick-search trigger pill (⌘F / Ctrl+F) plus a
 * command-palette overlay. v1 is navigational only: it filters a flat list of
 * jump-to-screen / recent entities (each carrying a typed `href` from
 * `route.exits.*()`) — it is NOT a query surface and builds no URLs itself.
 *
 * The trigger reads as a quiet pill ("Search… ⌘F"); the overlay is a centered
 * `bg-card shadow-card-lg` dialog with an `info`-tinted focus ring (the cool
 * accent's allowed AI/info/search use), arrow-key navigation, and
 * `aria-activedescendant`.
 */
export type CommandItem = {
  id: string
  label: string
  /** Optional secondary line (entity meta / route group). */
  hint?: string
  icon?: React.ReactNode
  href?: string
  onSelect?: () => void
  /** Free-text keywords to match besides the label. */
  keywords?: string
  /** A non-result affordance (e.g. an "Ask AI about '…'" fallback) pinned to
   *  the bottom — excluded from the "has a real match" test that gates whether
   *  Enter navigates vs. hands the query to the inline assistant. */
  pinned?: boolean
}

export type CommandGroup = {
  heading?: string
  items: CommandItem[]
}

export function SearchCommand({
  groups,
  placeholder = 'Search…',
  triggerLabel = 'Search',
  emptyLabel = 'No results',
  loadingLabel = 'Searching…',
  dialogLabel = 'Quick search',
  className,
  loading = false,
  serverDriven = false,
  renderTrigger = true,
  onQueryChange,
  subscribeOpen,
  headerSlot,
  footer,
  onSubmitQuery,
}: {
  groups: CommandGroup[]
  placeholder?: string
  triggerLabel?: string
  /** No-results copy. */
  emptyLabel?: string
  /** In-flight copy (server-driven mode). */
  loadingLabel?: string
  /** a11y name for the palette dialog. */
  dialogLabel?: string
  className?: string
  /** True while a server query for the current input is in flight. */
  loading?: boolean
  /** When true, `groups` are ALREADY filtered server-side — skip client filtering
   *  (just flatten for keyboard nav) so we don't double-narrow the hits. */
  serverDriven?: boolean
  /** Render the built-in trigger pill. Set false when an external trigger (e.g.
   *  the sidebar rail button via `subscribeOpen`) opens the palette instead. */
  renderTrigger?: boolean
  /** Notified on every input change — the host fetches server results from it. */
  onQueryChange?: (q: string) => void
  /** Subscribe to an external open signal (the search bus). Returns unsubscribe. */
  subscribeOpen?: (open: () => void) => () => void
  /** Rendered ABOVE the result list (e.g. the inline ✨ AI answer block). */
  headerSlot?: React.ReactNode
  /** Rendered as a sticky FOOTER below the list (e.g. the AI toggles). */
  footer?: React.ReactNode
  /** Called on Enter with the trimmed query + whether any non-pinned result
   *  matched. Return `true` to mark the submit HANDLED (the host took over, e.g.
   *  ran the inline assistant) so the palette does NOT also navigate. */
  onSubmitQuery?: (query: string, hasRealResult: boolean) => boolean
}) {
  const {
    open, setOpen, query, activeIndex, setActiveIndex,
    inputRef, listId, filtered, activeId,
    openPalette, onKeyDown, runItem, onInputChange,
  } = useSearchCommand({ groups, serverDriven, onQueryChange, subscribeOpen, onSubmitQuery })

  return (
    <>
      {renderTrigger && (
        <button
          type="button"
          onClick={openPalette}
          aria-haspopup="dialog"
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-input bg-card px-3.5 py-2 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-secondary/60',
            className,
          )}
        >
          <Search aria-hidden className="size-4" />
          <span>{triggerLabel}</span>
          <kbd className="ml-1 rounded-md border border-input bg-secondary px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
            ⌘F
          </kbd>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 p-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-card-lg"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search aria-hidden className="size-4 shrink-0 text-info" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder={placeholder}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={activeId}
                className="w-full bg-transparent py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              />
            </div>

            {headerSlot}

            <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto p-2">
              {loading && (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground" aria-live="polite">
                  {loadingLabel}
                </li>
              )}
              {!loading && !headerSlot && filtered.view.length === 0 && query.trim().length > 0 && (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground" aria-live="polite">
                  {emptyLabel}
                </li>
              )}
              {!loading && filtered.view.map((g, gi) => (
                <li key={g.heading ?? gi}>
                  {g.heading && (
                    <div className="px-3 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                      {g.heading}
                    </div>
                  )}
                  <ul>
                    {g.items.map((it) => {
                      const flatIndex = filtered.flat.indexOf(it)
                      const isActive = flatIndex === activeIndex
                      const inner = (
                        <>
                          {it.icon && (
                            <IconChip tone={isActive ? 'info' : 'plain'} size="sm" aria-hidden>
                              {it.icon}
                            </IconChip>
                          )}
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium">{it.label}</span>
                            {it.hint && (
                              <span className="truncate text-xs text-muted-foreground">{it.hint}</span>
                            )}
                          </span>
                          {isActive && (
                            <CornerDownLeft aria-hidden className="ml-auto size-3.5 text-info" />
                          )}
                        </>
                      )
                      const rowClass = cn(
                        'flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                        isActive ? 'bg-info-soft' : 'hover:bg-secondary/60',
                      )
                      return (
                        <li
                          key={it.id}
                          id={`${listId}-opt-${it.id}`}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                        >
                          {it.href ? (
                            <a href={it.href} onClick={() => setOpen(false)} className={rowClass}>
                              {inner}
                            </a>
                          ) : (
                            <button type="button" onClick={() => runItem(it)} className={cn(rowClass, 'w-full')}>
                              {inner}
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>

            {footer}
          </div>
        </div>
      )}
    </>
  )
}
