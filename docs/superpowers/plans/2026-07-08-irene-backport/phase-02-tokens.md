# Phase 2: Design Tokens — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Port irene's triad + tone design-token architecture (spec F1) into the template with the pinned slot names, a neutral placeholder palette, runtime-composition safelist, shadow/radius/font tokens, and a `docs/design-tokens.md` that documents the palette-swap procedure and the soft-surface WCAG rule.

**Depends on phases:** 1

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE source repo: `/Users/luca/dev/winter-park/irene` (read-only reference — never modify).
- Design tokens: accent slots named `brand`, `accent`, `info`, `success`, `warning`, `destructive` — each a 4-role triad: `--<slot>`, `--<slot>-soft`, `--<slot>-deep`, `--<slot>-foreground`. Semantic tone scale keeps irene's mechanics with the pinned names: `tone-urgent`, `tone-attention`, `tone-positive`, `tone-info`, `tone-neutral` (CSS vars `--tone-*`, role suffixes `-soft`/`-deep`/`-fg`), tailwind alias `tone.*`. `shadow-bento` → `shadow-card`. Neutral placeholder hues (grayscale-leaning + one restrained brand hue), documented swap procedure. Fonts: keep the `--font-display`/`--font-kicker` aliasing pattern, no Fraunces/JetBrains defaults — alias to the template's existing `--font-geist`.
- Hard WCAG rule (document + enforce in comments): text on a `-soft` surface always uses `-deep`, never `-foreground`.
- Copy: English defaults everywhere; no pt-BR strings in code or comments.
- Docs travel with code: this phase writes `docs/design-tokens.md` and adds its row to the template `CLAUDE.md` doc table. No token-preview Storybook story exists in irene (verified — no `*.stories.tsx` there is a tokens/palette catalog), so `docs/storybook.md` is deliberately untouched in this phase.
- Verification gate for every task: at minimum `npx tsc --noEmit` clean; CSS/config tasks also compile Tailwind (`npx tailwindcss -c tailwind.config.ts -i app/globals.css -o /tmp/tw-check.css`); tested code runs `npx vitest run`; the phase closes with `npm run build-storybook`.
- Every task ends with a git commit whose message ends with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## What deliberately does NOT port (salon/brand-specific — verified against irene sources)

From `/Users/luca/dev/winter-park/irene/app/globals.css`:
- `--cd-*` token block (lines 110–128 light, 182–200 dark) — salon "customer detail" page tokens.
- `--sage/--terracotta/--honey/--charcoal/--charcoal-2/--charcoal-line/--plum/--lavender*` brand hues (lines 32–61, 153–180) — replaced by the neutral slots below.
- `--hero-from/-via/-to` + `.bg-hero-charcoal` (lines 106–108, 261–276) — irene's branded hero gradient.
- `.timeline-pulse` keyframes (lines 350–359) — salon customer-timeline widget.
- `.shadow-ai-glow` (lines 295–298) — rides the AI-widget port (phase 10), not F1.
- `.tabular-nums` re-declaration (lines 208–218) — redundant: Tailwind's own `tabular-nums` utility already sets `font-variant-numeric: tabular-nums`.
- `.shadow-bento`/`.shadow-bento-lg` plain-CSS classes (lines 288–294) — replaced by `boxShadow.card`/`card-lg` **in tailwind.config.ts only** (irene defined them in both places; the duplication does not port).

From `/Users/luca/dev/winter-park/irene/tailwind.config.ts`: `sage/terracotta/lavender/honey/charcoal/plum` color entries (lines 21–25, 29), `boxShadow.bento` warm hue (line 52).

---

### Task 2.1: Accent triads + tone scale + per-theme `color-scheme` in `app/globals.css`

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/app/globals.css` (current `:root` block lines 6–25, `.dark` block lines 26–44)
- Source reference (read-only): `/Users/luca/dev/winter-park/irene/app/globals.css` lines 5–101, 130–201

**Interfaces:**
- Consumes: nothing from other phases (template's stock shadcn vars already present).
- Produces (CSS custom properties, light + dark values):
  - Triads: `--brand`, `--brand-foreground`, `--brand-soft`, `--brand-deep`; `--accent-soft`, `--accent-deep` (completing the existing `--accent`/`--accent-foreground` slot); `--info`, `--info-foreground`, `--info-soft`, `--info-deep`; `--success`, `--success-foreground`, `--success-soft`, `--success-deep`; `--warning`, `--warning-foreground`, `--warning-soft`, `--warning-deep`; `--destructive-soft`, `--destructive-deep` (base + foreground already exist; base value retuned).
  - Tones (`:root` only — aliases resolve at use-time, so `.dark` flows through automatically): `--tone-urgent`, `--tone-urgent-soft`, `--tone-urgent-deep`, `--tone-urgent-fg`, and the same 4 roles for `tone-attention`, `tone-positive`, `tone-neutral`, `tone-info`.
  - `color-scheme: light` on `:root`, `color-scheme: dark` on `.dark` (consumed by phase 4's ThemeProvider for live mobile repaint).

**Steps:**

- [ ] Step: apply generalization edit 1 — add `color-scheme` to `:root`. In `/Users/luca/dev/winter-park/template/app/globals.css` replace:
  ```css
    :root {
      --background:   0 0% 100%;
  ```
  with:
  ```css
    :root {
      color-scheme: light;          /* tell the browser (incl. mobile) the scheme so it recomputes natively */
      --background:   0 0% 100%;
  ```
- [ ] Step: apply generalization edit 2 — extend the `:root` block with triads + tone scale. Replace (current lines 19–25):
  ```css
      --destructive:  0 84.2% 60.2%;
      --destructive-foreground: 210 40% 98%;
      --border:       214.3 31.8% 91.4%;
      --input:        214.3 31.8% 91.4%;
      --ring:         222.2 84% 4.9%;
      --radius:       0.5rem;
    }
  ```
  with:
  ```css
      --destructive:  0 65% 45%;    /* darkened from stock shadcn so white text is ≥4.5:1 on the solid */
      --destructive-foreground: 210 40% 98%;
      --destructive-soft:       0 60% 93%;
      --destructive-deep:       0 55% 32%;
      --border:       214.3 31.8% 91.4%;
      --input:        214.3 31.8% 91.4%;
      --ring:         222 45% 42%;  /* brand-hue focus ring */
      --radius:       0.5rem;

      /* ── Accent triads (neutral placeholder palette — see docs/design-tokens.md
         for the swap procedure). Each slot is a 4-role triad:
           (base)       the solid hue   → solid fills, chart strokes, icon accents
           -soft        tinted surface  → tile / badge background
           -deep        ink on -soft    → contrast-safe text on the soft surface
           -foreground  text on (base)  → text on the SOLID fill only
         HARD RULE (WCAG): text on a -soft surface uses -deep, NEVER -foreground. */
      --brand:            222 45% 42%;   /* the one restrained brand hue */
      --brand-foreground: 210 40% 98%;
      --brand-soft:       222 40% 93%;
      --brand-deep:       222 47% 28%;
      --accent-soft:      210 40% 94%;   /* completes the shadcn accent slot as a triad */
      --accent-deep:      222.2 47.4% 24%;
      /* Cool informational accent — info banners / links / AI surfaces; never decorative. */
      --info:             212 50% 42%;
      --info-foreground:  210 44% 97%;
      --info-soft:        210 45% 93%;
      --info-deep:        214 50% 28%;
      --success:          150 30% 34%;
      --success-foreground: 150 40% 97%;
      --success-soft:     148 25% 89%;
      --success-deep:     152 35% 22%;
      --warning:          40 65% 52%;    /* light base — uses a DARK foreground */
      --warning-foreground: 32 55% 14%;
      --warning-soft:     42 65% 89%;
      --warning-deep:     32 50% 26%;

      /* ── TONE SCALE (semantic meaning, not decoration) ─────────────────────
         Color = signal. Five tones alias the accent triads above so there is
         ONE source of truth and both themes swap automatically (the aliases
         resolve the underlying var at use-time, so the .dark overrides flow
         through — no separate dark block needed here).

           urgent    → destructive — ONLY genuine overdue / negative
           attention → warning     — needs-you-soon
           positive  → success     — healthy / clear / positive
           neutral   → grayscale   — plain info / counts / pulses
           info      → info        — informational / interactive / AI

         Roles per tone:
           (base)  the solid hue   → chart strokes, icon accents, solid fills
           -soft   tinted surface  → tile / badge background
           -deep   ink on -soft    → contrast-safe text on the soft surface
           -fg     text on (base)  → text on the SOLID fill only
         Consume via Tailwind tokens (`bg-tone-positive-soft text-tone-positive-deep
         border-tone-positive`) or raw color for SVG (`hsl(var(--tone-positive))`). */
      --tone-urgent:         var(--destructive);
      --tone-urgent-soft:    var(--destructive-soft);
      --tone-urgent-deep:    var(--destructive-deep);
      --tone-urgent-fg:      var(--destructive-foreground);
      --tone-attention:      var(--warning);
      --tone-attention-soft: var(--warning-soft);
      --tone-attention-deep: var(--warning-deep);
      --tone-attention-fg:   var(--warning-foreground);
      --tone-positive:       var(--success);
      --tone-positive-soft:  var(--success-soft);
      --tone-positive-deep:  var(--success-deep);
      --tone-positive-fg:    var(--success-foreground);
      --tone-neutral:        var(--muted-foreground);
      --tone-neutral-soft:   var(--secondary);
      --tone-neutral-deep:   var(--foreground);
      --tone-neutral-fg:     var(--secondary-foreground);
      --tone-info:           var(--info);
      --tone-info-soft:      var(--info-soft);
      --tone-info-deep:      var(--info-deep);
      --tone-info-fg:        var(--info-foreground);
    }
  ```
- [ ] Step: apply generalization edit 3 — add `color-scheme` to `.dark`. Replace:
  ```css
    .dark {
      --background:   222.2 84% 4.9%;
  ```
  with:
  ```css
    .dark {
      color-scheme: dark;           /* paired with :root's color-scheme so the theme toggle repaints live on mobile */
      --background:   222.2 84% 4.9%;
  ```
- [ ] Step: apply generalization edit 4 — dark-theme triad overrides. Replace (current lines 39–44):
  ```css
      --destructive:  0 62.8% 30.6%;
      --destructive-foreground: 210 40% 98%;
      --border:       217.2 32.6% 17.5%;
      --input:        217.2 32.6% 17.5%;
      --ring:         212.7 26.8% 83.9%;
    }
  ```
  with:
  ```css
      --destructive:  0 55% 50%;    /* brightened so the solid stays legible on dark */
      --destructive-foreground: 210 40% 98%;
      --destructive-soft:       0 30% 22%;
      --destructive-deep:       0 60% 82%;
      --border:       217.2 32.6% 17.5%;
      --input:        217.2 32.6% 17.5%;
      --ring:         222 50% 68%;

      /* Accent triads — dark. soft = dark tinted surface; deep = light ink on it. */
      --brand:            222 50% 64%;
      --brand-foreground: 222 45% 12%;
      --brand-soft:       222 30% 22%;
      --brand-deep:       220 50% 80%;
      --accent-soft:      217.2 32.6% 20%;
      --accent-deep:      210 40% 88%;
      --info:             210 60% 64%;
      --info-foreground:  214 40% 12%;
      --info-soft:        212 30% 22%;
      --info-deep:        210 55% 80%;
      --success:          150 30% 56%;
      --success-foreground: 150 35% 10%;
      --success-soft:     150 18% 21%;
      --success-deep:     148 35% 78%;
      --warning:          40 60% 58%;
      --warning-foreground: 32 55% 12%;
      --warning-soft:     38 25% 22%;
      --warning-deep:     42 55% 78%;
    }
  ```
- [ ] Step: verify Tailwind still compiles and the vars are emitted — Run: `cd /Users/luca/dev/winter-park/template && npx tailwindcss -c tailwind.config.ts -i app/globals.css -o /tmp/tw-check.css && grep -c -- '--tone-positive' /tmp/tw-check.css` → expected: exit 0 and a count ≥ 1. Then Run: `grep -c 'color-scheme: dark' /tmp/tw-check.css` → expected: `1`.
- [ ] Step: Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0, no output.
- [ ] Step: commit — `git -C /Users/luca/dev/winter-park/template add app/globals.css && git -C /Users/luca/dev/winter-park/template commit -m "$(cat <<'EOF'
Add accent triads, semantic tone scale, per-theme color-scheme

Ports irene's 4-role triad + tone-alias token architecture (F1) with the
pinned slot names (brand/accent/info/success/warning/destructive) and a
neutral placeholder palette. Tones: urgent/attention/positive/neutral/info.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"`

---

### Task 2.2: Utility classes — `label-micro` / `display-text` / `kicker-text`, tone surfaces, `.otp-caret`

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/app/globals.css` (insert after the `@layer base` block; anchors below reflect the file state after Task 2.1)
- Source reference (read-only): `/Users/luca/dev/winter-park/irene/app/globals.css` lines 220–237 (`.label-mono`), 239–259 (`.display-serif`/`.kicker-mono`), 278–286 (`.tone-surface-*`), 361–369 (`.otp-caret`)

**Interfaces:**
- Consumes: `--tone-*`, `--muted-foreground`, `--border` vars (Task 2.1); `--font-display`/`--font-kicker` tokens (aliased in Task 2.4 — the classes only reference the vars, so order is safe).
- Produces (CSS classes, relied on by phases 5, 7, 8, 10):
  - `.label-micro` (rename of irene's `.label-mono`) — uppercase tracked micro-label, muted by default, overridable by Tailwind `text-*`.
  - `.display-text` (rename of irene's `.display-serif`) — display face via `var(--font-display)`.
  - `.kicker-text` (rename of irene's `.kicker-mono`) — kicker face via `var(--font-kicker)`.
  - `.tone-surface-urgent`, `.tone-surface-attention`, `.tone-surface-positive`, `.tone-surface-neutral`, `.tone-surface-info` — one-class soft tile (bg + ink + hairline border color).
  - `.otp-caret` + `@keyframes otp-caret-blink` (consumed by phase 5's OtpInput), reduced-motion safe.

**Enumerated irene-isms removed in this port:** `.label-mono` → `.label-micro`; `.display-serif` → `.display-text`; `.kicker-mono` → `.kicker-text`; comment examples `RECENTLY WATCHED` / `:: ALTITUDE` → `RECENTLY ADDED` / `:: OVERVIEW`; comment references to "JetBrains Mono", "SectionLabel primitive" (arrives phase 8), "Control Panel", "Trek / Learning-hub idiom", "warm editorial SERIF" dropped or neutralized; `tone-surface-calm` → `tone-surface-positive`; `tone-surface-accent` → `tone-surface-info`; font stacks keep the same system fallbacks.

**Steps:**

- [ ] Step: insert the utility sections. In `/Users/luca/dev/winter-park/template/app/globals.css` replace:
  ```css
    * { @apply border-border; }
    body {
      @apply bg-background text-foreground antialiased;
    }
  }

  /* ── rehype-pretty-code ────────────────────────────────── */
  ```
  with:
  ```css
    * { @apply border-border; }
    body {
      @apply bg-background text-foreground antialiased;
    }
  }

  /* ── Design system: micro-labels ──────────────────────────
     Uppercase, letter-spaced micro-label — the section-kicker idiom
     (`RECENTLY ADDED`, `:: OVERVIEW`). Use directly on a span/h2.
     In @layer components so Tailwind text-* utilities (utilities layer) can
     OVERRIDE the default color — e.g. `label-micro text-current` on a solid
     tile renders the tile's foreground, not the muted gray. NOTE: @layer
     components classes are tree-shaken; this only ships once source uses it. */
  @layer components {
    .label-micro {
      text-transform: uppercase;
      letter-spacing: 0.09em;
      font-size: 0.6875rem;
      line-height: 1rem;
      font-weight: 600;
      color: hsl(var(--muted-foreground));
    }
  }

  /* ── Display typography (scoped opt-ins) ───────────────────
     The app is single-font everywhere EXCEPT surfaces that opt into these two
     classes (hero/greeting display + kicker). Both resolve through the
     `--font-display` / `--font-kicker` tokens, which alias the app font by
     default — load real display fonts in app/layout.tsx and repoint the
     variables to swap the look (docs/design-tokens.md "Swapping the palette"). */
  .display-text {
    font-family: var(--font-display), 'Iowan Old Style', Georgia, 'Times New Roman', serif;
    font-weight: 500;
    letter-spacing: -0.015em;
    line-height: 1.04;
    font-optical-sizing: auto;
  }
  .kicker-text {
    font-family: var(--font-kicker), ui-monospace, 'SF Mono', Menlo, monospace;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.6875rem;
    line-height: 1rem;
    font-weight: 500;
  }

  /* ── Tone surfaces (one-class soft tile: bg + ink + hairline ring) ─────────
     Convenience for color-blocked tiles. Compose the Tailwind `tone-*` tokens
     directly when you need finer control. Defined as plain CSS (not @layer) so
     they survive purge regardless of how class names are built. */
  .tone-surface-urgent    { background-color: hsl(var(--tone-urgent-soft));    color: hsl(var(--tone-urgent-deep));    border-color: hsl(var(--tone-urgent) / 0.20); }
  .tone-surface-attention { background-color: hsl(var(--tone-attention-soft)); color: hsl(var(--tone-attention-deep)); border-color: hsl(var(--tone-attention) / 0.22); }
  .tone-surface-positive  { background-color: hsl(var(--tone-positive-soft));  color: hsl(var(--tone-positive-deep));  border-color: hsl(var(--tone-positive) / 0.20); }
  .tone-surface-neutral   { background-color: hsl(var(--tone-neutral-soft));   color: hsl(var(--tone-neutral-deep));   border-color: hsl(var(--border)); }
  .tone-surface-info      { background-color: hsl(var(--tone-info-soft));      color: hsl(var(--tone-info-deep));      border-color: hsl(var(--tone-info) / 0.22); }

  /* ── OTP segmented-input active caret ─────────────────── */
  @keyframes otp-caret-blink {
    0%, 70%, 100% { opacity: 1; }
    20%, 50%      { opacity: 0; }
  }
  .otp-caret { animation: otp-caret-blink 1s ease-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .otp-caret { animation: none; }
  }

  /* ── rehype-pretty-code ────────────────────────────────── */
  ```
- [ ] Step: verify emission — Run: `cd /Users/luca/dev/winter-park/template && npx tailwindcss -c tailwind.config.ts -i app/globals.css -o /tmp/tw-check.css && grep -c 'tone-surface-positive' /tmp/tw-check.css && grep -c 'otp-caret-blink' /tmp/tw-check.css && grep -c 'display-text' /tmp/tw-check.css` → expected: exit 0, each count ≥ 1 (`.label-micro` is intentionally absent until a component uses it — it lives in `@layer components`).
- [ ] Step: Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit — `git -C /Users/luca/dev/winter-park/template add app/globals.css && git -C /Users/luca/dev/winter-park/template commit -m "$(cat <<'EOF'
Add label-micro/display-text/kicker-text, tone surfaces, otp-caret keyframes

Neutral renames of irene's label-mono/display-serif/kicker-mono utilities,
the one-class tone-surface tiles (tones renamed calm->positive,
accent->info), and the OTP caret blink used by phase 5's OtpInput.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"`

---

### Task 2.3: `tailwind.config.ts` — triad colors, tone aliases + safelist, `shadow-card`, radius scale, font tokens

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/tailwind.config.ts` (whole file — full replacement content below; current file is 27 lines)
- Source reference (read-only): `/Users/luca/dev/winter-park/irene/tailwind.config.ts` lines 8–72

**Interfaces:**
- Consumes: CSS vars from Task 2.1; `--font-geist` (already set in `app/layout.tsx` line 5); `--font-display`/`--font-kicker` (aliased in Task 2.4).
- Produces (Tailwind tokens, relied on by phases 5, 7, 8, 10):
  - Colors: `brand`/`accent`/`info`/`success`/`warning`/`destructive`, each with `DEFAULT`, `foreground`, `soft`, `deep` → classes like `bg-brand`, `text-warning-deep`, `bg-info-soft`.
  - `tone.{urgent,attention,positive,neutral,info}` with `DEFAULT`/`soft`/`deep`/`fg` → classes `bg-tone-urgent`, `text-tone-positive-deep`, `fill-tone-info`, ….
  - Safelist regex (exact): `/^(bg|text|border|ring|fill|stroke)-tone-(urgent|attention|positive|neutral|info)(-soft|-deep|-fg)?$/` — keeps runtime-composed classes (`` `bg-tone-${tone}-soft` ``) alive through purge.
  - `boxShadow.card` and `boxShadow['card-lg']` → `shadow-card`, `shadow-card-lg` (replaces irene's `shadow-bento`/`shadow-bento-lg`).
  - `borderRadius.xl/2xl/3xl` driven by `--radius` (`+4px`/`+8px`/`+16px` — matches Tailwind's stock 12/16/24px at `--radius: 0.5rem`, unlike irene's `+6/+14/+28` which assumed a 1rem base).
  - `fontFamily.sans/serif/mono` → `var(--font-geist)`; `fontFamily.display` → `var(--font-display)`; `fontFamily.kicker` → `var(--font-kicker)`.

**Enumerated irene-isms removed in this port:** color entries `sage`, `terracotta`, `lavender`, `honey`, `charcoal` (incl. `charcoal.2`), `plum` dropped; tone keys `calm` → `positive`, `accent` → `info` (in both the `tone` map and the safelist regex); `boxShadow.bento` (warm hue `hsl(24 16% 14% / …)`) → `boxShadow.card`/`card-lg` (neutral hue `hsl(220 15% 10% / …)`); `borderRadius` `md: -4px`/`sm: -8px` NOT adopted (they assume `--radius: 1rem`; template keeps its `-2px`/`-4px`) and `xl/2xl/3xl` offsets retuned to `+4/+8/+16`; fontFamily comment "Control Panel" → neutral; "Geist" naming kept (template already uses `--font-geist`).

**Steps:**

- [ ] Step: replace the full contents of `/Users/luca/dev/winter-park/template/tailwind.config.ts` with:
  ```ts
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
  ```
- [ ] Step: verify safelist emission — Run: `cd /Users/luca/dev/winter-park/template && npx tailwindcss -c tailwind.config.ts -i app/globals.css -o /tmp/tw-check.css && grep -c '\.bg-tone-positive-soft' /tmp/tw-check.css && grep -c '\.text-tone-urgent-deep' /tmp/tw-check.css && grep -c '\.stroke-tone-info' /tmp/tw-check.css` → expected: exit 0, each count = 1 (safelisted classes emitted with zero source usage).
- [ ] Step: Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit — `git -C /Users/luca/dev/winter-park/template add tailwind.config.ts && git -C /Users/luca/dev/winter-park/template commit -m "$(cat <<'EOF'
Extend tailwind theme: triads, tone aliases + safelist, shadow-card, radius, fonts

Ports irene's tailwind design-system stanza with pinned slot names, the
tone.* alias matrix + runtime-composition safelist regex, shadow-bento ->
shadow-card(-lg) on a neutral hue, a --radius-driven xl/2xl/3xl scale, and
the single-font + display/kicker font-token strategy.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"`

---

### Task 2.4: Font-token aliasing in `app/layout.tsx` (`--font-display`/`--font-kicker` → `--font-geist`)

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/app/layout.tsx` (lines 5 and 15)
- Source reference (read-only): `/Users/luca/dev/winter-park/irene/app/layout.tsx` lines 9–32, 61 (the aliasing pattern + comment block; Fraunces/JetBrains_Mono loading does NOT port per pinned constraint)

**Interfaces:**
- Consumes: `--font-geist` (already defined at line 5).
- Produces: runtime values for `--font-display` and `--font-kicker` (both `var(--font-geist)`, set as body inline style) — consumed by `.display-text`/`.kicker-text` (Task 2.2) and `font-display`/`font-kicker` Tailwind tokens (Task 2.3). Later root-layout provider wiring (phase 4) must preserve this body `style` attribute.

**Steps:**

- [ ] Step: apply generalization edits. In `/Users/luca/dev/winter-park/template/app/layout.tsx` replace:
  ```tsx
  const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
  ```
  with:
  ```tsx
  // ONE font for the whole app (`--font-geist`); Tailwind's font-serif/font-mono
  // aliases resolve to it too (tailwind.config.ts fontFamily), so stray classes
  // never introduce a second family. The display/kicker font TOKENS
  // (`--font-display` / `--font-kicker`, consumed by `.display-text` /
  // `.kicker-text` and the `font-display` / `font-kicker` utilities) alias the
  // same family by default — to give the app a real display face, load it here
  // with next/font (variable: '--font-display', display: 'swap') and remove the
  // matching body-style alias below. See docs/design-tokens.md.
  const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
  ```
  and replace:
  ```tsx
        <body className={`${geist.variable} font-sans antialiased`}>
  ```
  with:
  ```tsx
        <body
          className={`${geist.variable} font-sans antialiased`}
          style={{ ['--font-display' as string]: 'var(--font-geist)', ['--font-kicker' as string]: 'var(--font-geist)' }}
        >
  ```
- [ ] Step: Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
- [ ] Step: Run: `cd /Users/luca/dev/winter-park/template && npx eslint app/layout.tsx` → expected: exit 0, no errors.
- [ ] Step: commit — `git -C /Users/luca/dev/winter-park/template add app/layout.tsx && git -C /Users/luca/dev/winter-park/template commit -m "$(cat <<'EOF'
Alias --font-display/--font-kicker font tokens to the app font

Keeps irene's font-token strategy (display/kicker are swappable slots)
without shipping Fraunces/JetBrains Mono defaults.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"`

---

### Task 2.5: Typed tone contract — `lib/theme/tone.ts` (+ safelist consistency test)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/theme/tone.ts`
- Test: `/Users/luca/dev/winter-park/template/lib/theme/tone.test.ts`
- Source reference (read-only): `/Users/luca/dev/winter-park/irene/lib/control-panel/tone.ts` (whole file, 99 lines)

**Interfaces:**
- Consumes: vitest runner from phase 1 (`npx vitest run` with the `@/` alias configured); safelist regex in `tailwind.config.ts` (Task 2.3); `--tone-*` vars (Task 2.1).
- Produces (imported by phases 8 and 10 — chart kit, StatusPill, AI widgets):
  - `type Tone = 'urgent' | 'attention' | 'positive' | 'neutral' | 'info'`
  - `const TONES: readonly ['urgent', 'attention', 'positive', 'neutral', 'info']`
  - `type ToneRole = 'base' | 'soft' | 'deep' | 'fg'`
  - `toneVar(tone: Tone, role?: ToneRole): string` — e.g. `var(--tone-positive-soft)`
  - `toneColor(tone: Tone, role?: ToneRole): string` — e.g. `hsl(var(--tone-positive))`
  - `toneColorAlpha(tone: Tone, alpha: number, role?: ToneRole): string` — e.g. `hsl(var(--tone-info) / 0.2)`
  - `toneSurface(tone: Tone): string` — e.g. `tone-surface-positive`
  - `toneClasses(tone: Tone): { bg: string; bgSoft: string; text: string; textDeep: string; textFg: string; border: string; ring: string }`
  - `isTone(value: unknown): value is Tone`

**Enumerated irene-isms removed in this port:** module moves `lib/control-panel/tone.ts` → `lib/theme/tone.ts`; `Tone` union `'calm'` → `'positive'`, `'accent'` → `'info'` (and `TONES` order updated); doc-comment "Control Panel", "Warm-Editorial accent", "the composer … a signal's kind + severity", tone table rows "terracotta/destructive", "honey/amber", "sage/green", "cream/charcoal-on-light", "info/blue — AI brief" rewritten to the neutral slot mapping; "the LLM never picks color" generalized.

**Steps (TDD):**

- [ ] Step: write the failing test — create `/Users/luca/dev/winter-park/template/lib/theme/tone.test.ts` with:
  ```ts
  import { describe, expect, it } from 'vitest'
  import { readFileSync } from 'node:fs'
  import { join } from 'node:path'
  import { TONES, isTone, toneClasses, toneColor, toneColorAlpha, toneSurface, toneVar } from './tone'

  describe('tone token contract', () => {
    it('builds CSS variable references per role', () => {
      expect(toneVar('positive')).toBe('var(--tone-positive)')
      expect(toneVar('positive', 'soft')).toBe('var(--tone-positive-soft)')
      expect(toneVar('urgent', 'deep')).toBe('var(--tone-urgent-deep)')
      expect(toneVar('info', 'fg')).toBe('var(--tone-info-fg)')
    })

    it('builds hsl() colors and alpha variants for SVG', () => {
      expect(toneColor('attention')).toBe('hsl(var(--tone-attention))')
      expect(toneColor('neutral', 'soft')).toBe('hsl(var(--tone-neutral-soft))')
      expect(toneColorAlpha('info', 0.2)).toBe('hsl(var(--tone-info) / 0.2)')
    })

    it('narrows unknown values with isTone (old irene names must NOT validate)', () => {
      expect(isTone('positive')).toBe(true)
      expect(isTone('neutral')).toBe(true)
      expect(isTone('calm')).toBe(false)
      expect(isTone('accent')).toBe(false)
      expect(isTone(42)).toBe(false)
    })

    it('every runtime-composed class is covered by the tailwind safelist regex', () => {
      const configSource = readFileSync(join(process.cwd(), 'tailwind.config.ts'), 'utf8')
      const match = configSource.match(/pattern:\s*\/(.+)\/\s*\}/)
      expect(match).not.toBeNull()
      const safelist = new RegExp(match![1])
      for (const tone of TONES) {
        const c = toneClasses(tone)
        for (const cls of [c.bg, c.bgSoft, c.text, c.textDeep, c.textFg, c.border, c.ring]) {
          expect(cls, `${cls} must match the safelist pattern`).toMatch(safelist)
        }
        expect(toneSurface(tone)).toBe(`tone-surface-${tone}`)
      }
    })
  })
  ```
- [ ] Step: run the test, expect FAIL — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/theme/tone.test.ts` → expected: failure with `Cannot find module './tone'` (module not yet written).
- [ ] Step: implement — create `/Users/luca/dev/winter-park/template/lib/theme/tone.ts` with:
  ```ts
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
  ```
- [ ] Step: run the test, expect PASS — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/theme/tone.test.ts` → expected: exit 0, 4 tests passed.
- [ ] Step: Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit — `git -C /Users/luca/dev/winter-park/template add lib/theme/tone.ts lib/theme/tone.test.ts && git -C /Users/luca/dev/winter-park/template commit -m "$(cat <<'EOF'
Add typed tone-token contract (lib/theme/tone) with safelist consistency test

Port of irene's lib/control-panel/tone.ts with tones renamed
calm->positive / accent->info. The test asserts every runtime-composed
class from toneClasses() matches the tailwind.config.ts safelist regex.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"`

---

### Task 2.6: `docs/design-tokens.md` + CLAUDE.md doc-table row + phase gate

**Files:**
- Create: `/Users/luca/dev/winter-park/template/docs/design-tokens.md`
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (doc table, after the `storybook.md` row at line 30)

**Interfaces:**
- Consumes: everything produced in Tasks 2.1–2.5 (documented, not imported).
- Produces: `docs/design-tokens.md` (served at `/docs/design-tokens`; frontmatter `category: Patterns`, `order: 10`) — later phases link to it from component JSDoc and docs sweeps.

**Steps:**

- [ ] Step: create `/Users/luca/dev/winter-park/template/docs/design-tokens.md` with exactly:
  ````markdown
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
  ````
- [ ] Step: add the CLAUDE.md doc-table row. In `/Users/luca/dev/winter-park/template/CLAUDE.md` replace:
  ```markdown
  | [`storybook.md`](docs/storybook.md) | Story patterns, co-location, running |
  ```
  with:
  ```markdown
  | [`storybook.md`](docs/storybook.md) | Story patterns, co-location, running |
  | [`design-tokens.md`](docs/design-tokens.md) | Accent triads, tone scale, typography/radius/shadow tokens, palette swap procedure |
  ```
- [ ] Step: Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
- [ ] Step: phase gate — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run && npm run build-storybook` → expected: vitest green (tone suite + any phase-1 tests), Storybook static build exits 0 (compiles `globals.css` + `tailwind.config.ts` through the real pipeline).
- [ ] Step: commit — `git -C /Users/luca/dev/winter-park/template add docs/design-tokens.md CLAUDE.md && git -C /Users/luca/dev/winter-park/template commit -m "$(cat <<'EOF'
Document the design-token system and palette swap procedure

docs/design-tokens.md covers the triad roles, the soft-surface-uses-deep
WCAG rule, the tone scale + safelist contract, and the step-by-step
placeholder-palette swap; CLAUDE.md doc table gains its row.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"`
