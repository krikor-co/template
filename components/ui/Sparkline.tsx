import { cn } from '@/lib/utils'

/**
 * Lightweight pure-SVG sparkline (line + soft area fill). No deps, SSR-safe —
 * use inside stat tiles. `data` is a series of numbers; it auto-scales. Color
 * defaults to currentColor so it inherits the tile's text tone.
 */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  strokeWidth = 2,
  fill = true,
  className,
}: {
  data:   number[]
  width?: number
  height?: number
  strokeWidth?: number
  fill?:  boolean
  className?: string
}) {
  if (data.length < 2) return <div style={{ width, height }} className={className} aria-hidden />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const stepX = width / (data.length - 1)
  const pad = strokeWidth
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span)
  const pts = data.map((v, i) => `${i * stepX},${y(v)}`)
  const line = `M${pts.join(' L')}`
  const area = `${line} L${width},${height} L0,${height} Z`
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={cn('overflow-visible text-current', className)}
      aria-hidden
    >
      {fill && <path d={area} fill="currentColor" opacity={0.12} />}
      <path d={line} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) * stepX} cy={y(data[data.length - 1])} r={strokeWidth + 0.5} fill="currentColor" />
    </svg>
  )
}
