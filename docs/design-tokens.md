---
title: Design Tokens
order: 10
category: Patterns
---

# Design Tokens

The template ships a three-layer token system on top of the stock shadcn slots. Components reference **tokens, never hues** — swapping the palette is a CSS-variable edit, not a component sweep.

```
Base slots      →  background · foreground · card · primary · secondary · muted · border · input · ring
Accent triads   →  brand · accent · info · success · warning · destructive   (4 roles each)
Tone scale      →  tone-urgent · tone-attention · tone-positive · tone-neutral · tone-info  (aliases over triads)
```

All values live in `app/globals.css` (`:root` = light, `.dark` = dark); Tailwind tokens live in `tailwind.config.ts`. Both theme blocks declare `color-scheme` so the browser recomputes native UI (scrollbars, form controls, mobile viewport chrome) on theme change.

## Accent triads — 4 roles

Every accent slot is a triad of four CSS variables:

| Role | Variable | Use for | Tailwind |
|------|----------|---------|----------|
| base | `--<slot>` | solid fills, chart strokes, icon accents | `bg-info`, `text-info`, `border-info` |
| soft | `--<slot>-soft` | tinted surfaces: tiles, badges, banners | `bg-info-soft` |
| deep | `--<slot>-deep` | **ink on the soft surface** | `text-info-deep` |
| foreground | `--<slot>-foreground` | text on the **solid** base fill only | `text-info-foreground` |

> **HARD RULE (WCAG):** text on a `-soft` surface always uses `-deep`, never `-foreground`. Foregrounds are tuned against the *solid* base (usually near-white); on the pale soft tint they fail contrast. `bg-success-soft text-success-deep` ✓ — `bg-success-soft text-success-foreground` ✗.

Slot semantics:

- `brand` — the product's one restrained brand hue. Also drives `--ring` (focus).
- `accent` — the quiet hover/selected surface (stock shadcn slot, completed into a triad).
- `info` — cool informational accent: info banners, links, AI surfaces. Never decorative.
- `success` / `warning` / `destructive` — status semantics. `destructive` doubles as the danger-action color; its base is darkened from stock shadcn so white text passes 4.5:1.

## Tone scale — color = meaning

Five semantic tones alias the triads (see the `--tone-*` block in `app/globals.css`), so there is ONE source of truth and dark mode flows through automatically. Tones are for *state communication* (status pills, KPI tiles, chart marks) — decoration uses the triads directly.

| Tone | Aliases | Meaning |
|------|---------|---------|
| `tone-urgent` | `destructive` | genuine overdue / negative — reserve for real alarm |
| `tone-attention` | `warning` | needs-you-soon |
| `tone-positive` | `success` | healthy / clear / positive |
| `tone-neutral` | grayscale (`muted-foreground` / `secondary` / `foreground`) | plain info, counts, pulses |
| `tone-info` | `info` | informational / interactive / AI |

Tone roles mirror the triads with `-fg` shorthand: `bg-tone-positive` (solid) + `text-tone-positive-fg`, or `bg-tone-positive-soft` + `text-tone-positive-deep`. The same WCAG rule applies.

### Runtime composition + safelist

Tone classes are usually composed from a `Tone` value at runtime, so the literals never appear in source. `tailwind.config.ts` safelists the full matrix:

```
/^(bg|text|border|ring|fill|stroke)-tone-(urgent|attention|positive|neutral|info)(-soft|-deep|-fg)?$/
```

Always go through the typed contract in `lib/theme/tone.ts`:

```tsx
import { toneClasses, toneColor, type Tone } from '@/lib/theme/tone'

const t = toneClasses(tone)                    // Tailwind classes, safelisted
<div className={`${t.bgSoft} ${t.textDeep} border ${t.border}`}>…</div>

<path stroke={toneColor(tone)} fill={toneColorAlpha(tone, 0.15)} />  // raw color for SVG
```

If you extend the tone union, update **all three together**: the `--tone-*` vars, the safelist regex, and `lib/theme/tone.ts` (`TONES`) — the vitest suite `lib/theme/tone.test.ts` checks tone/safelist agreement.

### One-class tone surfaces

`tone-surface-<tone>` (plain CSS in `globals.css`, purge-safe) sets bg + ink + hairline border-color in one class — pair with `border rounded-2xl` for a toned tile. Compose raw `tone-*` tokens when you need finer control.

## Elevation, radius, typography

- **Shadows:** `shadow-card` (resting tile/card) and `shadow-card-lg` (floating: popovers, palettes). Neutral-hue; retint alongside a palette swap if your brand is warm/cool.
- **Radius:** the whole scale derives from `--radius` (`sm`/`md`/`lg`/`xl`/`2xl`/`3xl` = −4/−2/0/+4/+8/+16 px). Retune the entire app by editing `--radius` once.
- **Fonts:** one family app-wide (`--font-geist`); Tailwind `font-serif`/`font-mono` alias it so stray classes never introduce a second family. Two swappable display slots exist as *tokens*: `--font-display` and `--font-kicker`, consumed by the `.display-text` / `.kicker-text` classes and the `font-display` / `font-kicker` utilities. By default both alias the app font (body `style` in `app/layout.tsx`).
- **Micro-labels:** `.label-micro` — uppercase, letter-spaced 11px label (section kickers, table headers). Muted by default; override with any `text-*` utility (e.g. `label-micro text-current` on a solid tile).

## Swapping the placeholder palette

The shipped hues are deliberate placeholders: grayscale-leaning neutrals plus one restrained brand hue. To re-theme an app built on the template:

1. **Pick the brand hue.** Edit the `--brand` triad (light + dark) in `app/globals.css`; update `--ring` to match.
2. **Retune the status triads** (`info`, `success`, `warning`, `destructive`) toward the brand's temperature — keep each hue family recognizable (blue-ish info, green-ish success, amber warning, red destructive).
3. **Retune the base slots** (`background`, `card`, `secondary`, `muted`, `border`) if the brand wants a tinted canvas — e.g. warm cream instead of pure white.
4. **Validate contrast for every triad, both themes:** base vs `-foreground` ≥ 4.5:1, `-soft` vs `-deep` ≥ 4.5:1. (The soft-uses-deep rule only holds if you keep `-deep` dark enough on light soft tints, and light enough on dark ones.)
5. **Optional:** retint `shadow-card`/`shadow-card-lg` in `tailwind.config.ts` toward the brand hue; adjust `--radius` for a rounder/sharper feel.
6. **Display fonts:** load real display/kicker fonts in `app/layout.tsx` via `next/font` with `variable: '--font-display'` / `'--font-kicker'`, and remove the matching body-style aliases.
7. **Never rename token slots.** Components reference `brand`/`info`/`tone-positive`/… — the names are the API; only the values change. Tone *names* stay semantic (`positive`, not `green`).

## Adding a new accent slot

Add all four roles in both theme blocks of `globals.css`, register the triad in `tailwind.config.ts` colors, and document its semantics here. If it also needs a tone, extend the tone union (see above). Keep the slot semantic — name it for what it *means*, not its hue.
