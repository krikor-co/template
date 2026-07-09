import { cn } from '@/lib/utils'
import { SectionLabel } from './SectionLabel'

/**
 * Editorial page header — big grotesk display title with an optional mono
 * kicker, subtitle, and a right-aligned actions slot. The canonical top of
 * every page in the editorial design language.
 */
export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  className,
}: {
  kicker?:   React.ReactNode
  title:     React.ReactNode
  subtitle?: React.ReactNode
  actions?:  React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="space-y-1.5">
        {kicker && <SectionLabel>{kicker}</SectionLabel>}
        <h1 className="text-3xl font-semibold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="max-w-prose text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex min-w-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
