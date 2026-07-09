'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/utils'
import { NavBadge } from './NavBadge'

/**
 * Tabs — a pill tab group for content-section switching (the "Top Performers /
 * Needs Attention / AI Insights" pattern). One tab is filled (active =
 * `bg-card shadow-sm` on a `bg-secondary` track), the rest are quiet. Distinct
 * from {@link SegmentedControl}: Tabs is the richer content switcher — supports
 * per-tab counts (via {@link NavBadge}) and icons, and an `ai`-flavored tab
 * whose label reads `text-info` (the only blue tab, for AI views).
 *
 * Controlled (pass `value` + `onChange`) or uncontrolled (owns its own
 * selection via `defaultValue`). Roving `role=tablist`/`tab` semantics with
 * arrow-key navigation.
 */
export type TabItem<T extends string = string> = {
  value: T
  label: React.ReactNode
  /** Optional leading glyph (lucide icon). */
  icon?: React.ReactNode
  /** Optional count → rendered as a trailing NavBadge. */
  count?: number
  /** AI tab — label tints `text-info` with a ✨-ready info accent. */
  ai?: boolean
}

export function Tabs<T extends string>({
  tabs,
  value,
  defaultValue,
  onChange,
  size = 'md',
  className,
}: {
  tabs: TabItem<T>[]
  value?: T
  defaultValue?: T
  onChange?: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  const baseId = useId()
  const [internal, setInternal] = useState<T>(defaultValue ?? tabs[0]?.value)
  const active = value ?? internal

  function select(v: T) {
    if (value === undefined) setInternal(v)
    onChange?.(v)
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = (index + dir + tabs.length) % tabs.length
    select(tabs[next].value)
    document.getElementById(`${baseId}-tab-${tabs[next].value}`)?.focus()
  }

  return (
    <div
      role="tablist"
      className={cn('inline-flex items-center gap-1 rounded-full bg-secondary p-1', className)}
    >
      {tabs.map((t, i) => {
        const isActive = t.value === active
        return (
          <button
            key={t.value}
            id={`${baseId}-tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => select(t.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors [&_svg]:size-3.5',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
              isActive
                ? 'bg-card shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              isActive && t.ai && 'text-info',
              isActive && !t.ai && 'text-foreground',
            )}
          >
            {t.icon}
            {t.label}
            {t.count != null && t.count > 0 && (
              <NavBadge
                count={t.count}
                tone="neutral"
                className={cn(t.ai && 'bg-info-soft text-info-deep')}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
