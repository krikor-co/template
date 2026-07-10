/**
 * TONE SCALE — the shared "color = meaning" vocabulary.
 *
 * Five semantic tones, each aliasing an accent triad (the `--tone-*` CSS
 * variables live in `app/globals.css`; the Tailwind `tone-*` color tokens +
 * the `tone-surface-*` convenience classes live in `tailwind.config.ts` /
 * `globals.css`). This module is the TYPED contract over those tokens so
 * code that DERIVES a tone from domain state and the chart primitives
 * (which need a raw color for an SVG stroke/fill) agree on names.
 *
 *   urgent    → destructive — ONLY genuine overdue / negative
 *   attention → warning     — needs-you-soon
 *   positive  → success     — healthy / clear / positive
 *   neutral   → grayscale   — plain info / counts / pulses
 *   info      → info        — informational / interactive / AI
 *
 * Reserve `urgent` for REAL alarm — most signals are positive or neutral.
 * Derive tone deterministically from domain state; never let an LLM or
 * free-form input pick color.
 */

export type Tone = 'urgent' | 'attention' | 'positive' | 'neutral' | 'info'

export const TONES = ['urgent', 'attention', 'positive', 'neutral', 'info'] as const

/** A tone-token role. base = the solid hue; soft/deep/fg per `globals.css`. */
export type ToneRole = 'base' | 'soft' | 'deep' | 'fg'

const VAR_SUFFIX: Record<ToneRole, string> = {
  base: '',
  soft: '-soft',
  deep: '-deep',
  fg:   '-fg',
}

/**
 * The bare CSS custom-property reference for a tone role, e.g.
 * `var(--tone-positive-soft)`. Use when you need to feed a CSS variable directly.
 */
export function toneVar(tone: Tone, role: ToneRole = 'base'): string {
  return `var(--tone-${tone}${VAR_SUFFIX[role]})`
}

/**
 * A ready-to-use `hsl(...)` color string for a tone role — drop straight into
 * an SVG `stroke` / `fill` or an inline gradient. Theme-aware automatically.
 *   <path stroke={toneColor(tone)} fill={toneColor(tone, 'soft')} />
 */
export function toneColor(tone: Tone, role: ToneRole = 'base'): string {
  return `hsl(${toneVar(tone, role)})`
}

/**
 * An `hsl(... / alpha)` color string for a tone role — for translucent fills
 * (area charts, gradient stops, hairline rings). `alpha` is 0–1.
 */
export function toneColorAlpha(tone: Tone, alpha: number, role: ToneRole = 'base'): string {
  return `hsl(${toneVar(tone, role)} / ${alpha})`
}

/**
 * The one-class soft toned surface (background + ink + hairline ring), e.g.
 * `tone-surface-positive`. Pair with `border` + `rounded-2xl` for a tile.
 */
export function toneSurface(tone: Tone): string {
  return `tone-surface-${tone}`
}

/**
 * Individual Tailwind color classes for a tone — compose as needed. The full
 * matrix is safelisted (see `tailwind.config.ts`), so building these from a
 * runtime `Tone` is safe even though the literals never appear in source.
 *   const t = toneClasses(tone)
 *   <div className={`${t.bgSoft} ${t.textDeep} border ${t.border}`}>
 */
export function toneClasses(tone: Tone) {
  return {
    /** Solid fill background (`bg-tone-x`). Pair with `textFg`. */
    bg:       `bg-tone-${tone}`,
    /** Tinted surface background (`bg-tone-x-soft`). Pair with `textDeep`. */
    bgSoft:   `bg-tone-${tone}-soft`,
    /** The solid hue as text/icon color (`text-tone-x`). */
    text:     `text-tone-${tone}`,
    /** Contrast-safe ink on the soft surface (`text-tone-x-deep`). */
    textDeep: `text-tone-${tone}-deep`,
    /** Text on the SOLID fill (`text-tone-x-fg`). */
    textFg:   `text-tone-${tone}-fg`,
    /** The solid hue as a border color (`border-tone-x`). */
    border:   `border-tone-${tone}`,
    /** The solid hue as a focus/accent ring (`ring-tone-x`). */
    ring:     `ring-tone-${tone}`,
  } as const
}

/** Type guard for narrowing an unknown string to a `Tone`. */
export function isTone(value: unknown): value is Tone {
  return typeof value === 'string' && (TONES as readonly string[]).includes(value)
}
