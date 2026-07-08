import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary:     { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary:   { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted:       { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        card:        { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        // ── Accent triads — 4 roles each (see docs/design-tokens.md).
        // HARD RULE: text on a *-soft surface is ALWAYS *-deep, never *-foreground.
        brand:       { DEFAULT: 'hsl(var(--brand))',       foreground: 'hsl(var(--brand-foreground))',       soft: 'hsl(var(--brand-soft))',       deep: 'hsl(var(--brand-deep))' },
        accent:      { DEFAULT: 'hsl(var(--accent))',      foreground: 'hsl(var(--accent-foreground))',      soft: 'hsl(var(--accent-soft))',      deep: 'hsl(var(--accent-deep))' },
        // Cool informational accent — info / links / AI surfaces ONLY (never decorative).
        info:        { DEFAULT: 'hsl(var(--info))',        foreground: 'hsl(var(--info-foreground))',        soft: 'hsl(var(--info-soft))',        deep: 'hsl(var(--info-deep))' },
        success:     { DEFAULT: 'hsl(var(--success))',     foreground: 'hsl(var(--success-foreground))',     soft: 'hsl(var(--success-soft))',     deep: 'hsl(var(--success-deep))' },
        warning:     { DEFAULT: 'hsl(var(--warning))',     foreground: 'hsl(var(--warning-foreground))',     soft: 'hsl(var(--warning-soft))',     deep: 'hsl(var(--warning-deep))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))', soft: 'hsl(var(--destructive-soft))', deep: 'hsl(var(--destructive-deep))' },
        // ── TONE SCALE — semantic tones (color = meaning). Each tone aliases an
        // accent triad (see globals.css `--tone-*`), so bg/border/text + opacity
        // modifiers all work and both themes swap automatically.
        // base = bg-tone-x / text-tone-x (solid hue), -soft = tinted surface,
        // -deep = ink on soft, -fg = text on the solid fill.
        tone: {
          urgent:    { DEFAULT: 'hsl(var(--tone-urgent))',    soft: 'hsl(var(--tone-urgent-soft))',    deep: 'hsl(var(--tone-urgent-deep))',    fg: 'hsl(var(--tone-urgent-fg))' },
          attention: { DEFAULT: 'hsl(var(--tone-attention))', soft: 'hsl(var(--tone-attention-soft))', deep: 'hsl(var(--tone-attention-deep))', fg: 'hsl(var(--tone-attention-fg))' },
          positive:  { DEFAULT: 'hsl(var(--tone-positive))',  soft: 'hsl(var(--tone-positive-soft))',  deep: 'hsl(var(--tone-positive-deep))',  fg: 'hsl(var(--tone-positive-fg))' },
          neutral:   { DEFAULT: 'hsl(var(--tone-neutral))',   soft: 'hsl(var(--tone-neutral-soft))',   deep: 'hsl(var(--tone-neutral-deep))',   fg: 'hsl(var(--tone-neutral-fg))' },
          info:      { DEFAULT: 'hsl(var(--tone-info))',      soft: 'hsl(var(--tone-info-soft))',      deep: 'hsl(var(--tone-info-deep))',      fg: 'hsl(var(--tone-info-fg))' },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Extended scale, still driven by --radius so one variable retunes the
        // whole app. Offsets match Tailwind's stock 12/16/24px at --radius: 0.5rem.
        xl:    'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
        '3xl': 'calc(var(--radius) + 16px)',
      },
      boxShadow: {
        // Soft card elevation for tiles/popovers (neutral hue — retint on palette swap).
        card:      '0 1px 2px hsl(220 15% 10% / 0.04), 0 6px 20px -8px hsl(220 15% 10% / 0.10)',
        'card-lg': '0 2px 4px hsl(220 15% 10% / 0.05), 0 14px 40px -12px hsl(220 15% 10% / 0.14)',
      },
      fontFamily: {
        // ONE font for the whole app. serif/mono alias to the sans variable so
        // any stray font-serif/font-mono class still resolves to the single family.
        sans:  ['var(--font-geist)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-geist)', 'system-ui', 'sans-serif'],
        // Scoped opt-in display faces (see globals.css `.display-text` /
        // `.kicker-text`). They alias the app font by default; swap by loading
        // real fonts in app/layout.tsx and repointing --font-display/--font-kicker.
        display: ['var(--font-display)', 'Iowan Old Style', 'Georgia', 'serif'],
        kicker:  ['var(--font-kicker)', 'ui-monospace', 'SF Mono', 'monospace'],
      },
    },
  },
  // Tone utilities are often composed from a `Tone` value at runtime
  // (`bg-tone-${tone}-soft`), so the literals never appear in source — keep
  // the full tone matrix regardless of how the class string is built.
  safelist: [
    { pattern: /^(bg|text|border|ring|fill|stroke)-tone-(urgent|attention|positive|neutral|info)(-soft|-deep|-fg)?$/ },
  ],
  plugins: [require('@tailwindcss/typography')],
}
export default config
