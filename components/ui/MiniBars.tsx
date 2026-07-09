import { cn } from '@/lib/utils'

/**
 * Pure-SVG mini bar chart (the weekday bars seen across the references). One
 * bar can be highlighted (`activeIndex`) in the accent tone; the rest render
 * muted. Optional `labels` row underneath. No deps, SSR-safe.
 */
export function MiniBars({
  data,
  labels,
  activeIndex,
  height = 64,
  className,
}: {
  data:   number[]
  labels?: string[]
  activeIndex?: number
  height?: number
  className?: string
}) {
  const max = Math.max(...data, 1)
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((v, i) => {
          // A real zero renders as a thin flat tick on the baseline — never the
          // 6% "tiny bar" that, repeated across empty weeks, reads as a dotted
          // broken chart. Only non-zero weeks get a proportional (≥6%) bar.
          const isZero = v <= 0
          return (
            <div key={i} className="flex flex-1 items-end" style={{ height }}>
              <div
                className={cn(
                  'w-full transition-colors',
                  isZero ? 'rounded-full opacity-40' : 'rounded-full',
                  i === activeIndex ? 'bg-brand' : 'bg-secondary',
                )}
                style={{ height: isZero ? '2px' : `${Math.max((v / max) * 100, 6)}%` }}
              />
            </div>
          )
        })}
      </div>
      {labels && (
        <div className="mt-1.5 flex gap-1.5">
          {labels.map((l, i) => (
            <span
              key={i}
              className={cn(
                'flex-1 text-center text-[10px] leading-tight line-clamp-2 break-words',
                i === activeIndex ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
