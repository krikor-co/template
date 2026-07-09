import { cn } from '@/lib/utils'
import { Tile, type TileProps, isSolidTone } from './Tile'
import { IconChip } from './IconChip'
import { Delta } from './Delta'
import { Sparkline } from './Sparkline'

/**
 * The canonical KPI tile (matches the references): a tiny mono label +
 * optional leading icon-chip on top, then a DOMINANT tabular number, with an
 * optional sub-line, delta pill, and sparkline. The number is the hero of the
 * tile — large + bold, like every reference dashboard. Color-block via `tone`
 * (use `*-solid`/`accent` for bold blocks with inverted white numbers).
 */
export function StatTile({
  label,
  value,
  delta,
  deltaInvert,
  sub,
  icon,
  iconTone,
  spark,
  tone = 'plain',
  size = 'md',
  className,
  ...rest
}: {
  label:    React.ReactNode
  value:    React.ReactNode
  delta?:   string
  deltaInvert?: boolean
  sub?:     React.ReactNode
  icon?:    React.ReactNode
  iconTone?: React.ComponentProps<typeof IconChip>['tone']
  spark?:   number[]
  size?:    'md' | 'lg'
  className?: string
} & Pick<TileProps, 'tone'>) {
  const solid = isSolidTone(tone)
  // A soft tinted tile (not plain, not solid): the Tile sets the base text to
  // the tone's `-deep` accent, so everything inherits via `text-current` — never
  // grey `muted-foreground` (washed-out) on a pastel fill.
  const soft = !solid && tone !== 'plain'
  // On solid + soft fills the label/sub/sparkline ride the tile's own text color
  // (deep accent or inverted), dimmed by opacity rather than switched to grey.
  const onTint = solid || soft
  // Value font. Capped at `text-4xl` on desktop (was `text-5xl` for `lg`) so a
  // 5–6 figure currency value (e.g. "$26,705.06", "-$1,179.50") fits inside
  // a NARROW stat card (the 4-across services header / the analysis right rail)
  // without clipping. The number may now wrap onto a second line for the widest
  // values (see the `<p>` below) instead of truncating with an ellipsis.
  const valueCls = size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl lg:text-4xl'
  return (
    <Tile tone={tone} className={cn('flex flex-col justify-between gap-5', className)} {...rest}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <IconChip
              tone={onTint ? 'plain' : (iconTone ?? 'plain')}
              size="sm"
              className={
                solid
                  ? 'bg-white/15 text-current'
                  : soft
                    ? 'bg-card/70 text-current ring-1 ring-inset ring-current/10'
                    : undefined
              }
            >
              {icon}
            </IconChip>
          )}
          {/* Label wraps to ~2 lines (no `truncate`): a KPI eyebrow like
              "GROSS REVENUE" or "TEAM MEMBERS" is identity — clipping it to
              "GROSS REV…" makes the tile unreadable. `break-words` guards
              against an unbroken token overflowing the min-w-0 column.
              `leading-snug` keeps a wrapped 2-line label looking intentional. */}
          <span className={cn('label-micro break-words leading-snug', onTint && 'text-current opacity-90')}>{label}</span>
        </div>
        {delta && <Delta value={delta} invert={deltaInvert} />}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {/* The value is the hero datum. It must show IN FULL — never clipped
              with an ellipsis (an unreadable "$26.7…" headline). We allow it
              to WRAP, but only at the space after the currency symbol: with the
              default `overflow-wrap: normal` (no `break-words`) the digit token
              "26,705.06" has no internal break opportunity, so "$ 26,705.06"
              breaks to "$" / "26,705.06" and the number itself stays intact —
              it can never split mid-digit. `leading-tight` keeps a wrapped
              2-line value from colliding; `tabular-nums` aligns digits; the
              capped `valueCls` font keeps a 5–6 figure value inside even the
              narrowest stat card. */}
          <p className={cn('min-w-0 font-semibold leading-tight tracking-tight tabular-nums', valueCls)}>{value}</p>
          {sub && <p className={cn('mt-2 break-words text-sm', onTint ? 'text-current opacity-90' : 'text-muted-foreground')}>{sub}</p>}
        </div>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} width={100} height={40} className={cn('shrink-0', onTint ? 'text-current' : 'text-brand')} />
        )}
      </div>
    </Tile>
  )
}
