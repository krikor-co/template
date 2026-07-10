import { isTone, toneColor } from '@/lib/theme/tone'

/**
 * Accent-SLOT → CSS color for the SVG chart kit. Semantic tones (urgent /
 * attention / positive / neutral / info) are NOT re-declared here — they
 * resolve through the typed tone contract in `lib/theme/tone.ts`. Slots are
 * identity hues (brand/accent/…); `muted` is the quiet fill. (`info` the
 * semantic tone and `info` the slot alias the same triad by design.)
 */
const SLOT_COLOR: Record<string, string> = {
  brand:       'hsl(var(--brand))',
  accent:      'hsl(var(--accent))',
  info:        'hsl(var(--info))',
  success:     'hsl(var(--success))',
  warning:     'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))',
  muted:       'hsl(var(--muted))',
}

/**
 * Resolve a chart `tone` string to a CSS color: a semantic tone name → its
 * `--tone-*` var (via `toneColor`), an accent-slot name → its slot var, and
 * anything else passes through as a raw CSS color (e.g. `#7c4dff`).
 */
export function chartColor(tone: string): string {
  if (isTone(tone)) return toneColor(tone)
  return SLOT_COLOR[tone] ?? tone
}
