# Phase 8: Component Catalog — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Port irene's `components/ui/` catalog (Button CVA, form kit, Toast, ConfirmDialog, DatePicker cluster, list-filter cluster, SearchCommand, Reveal, downscale-image, the 11-primitive SVG chart kit, the editorial catalog, Money/PhoneInput, WidgetRefresh) into the template with neutral tokens, English defaults, and their Storybook stories.

**Depends on phases:** 2 (design tokens), 4 (i18n/theme + root-layout state), 7 (useScrollLock, lib/list/normalize).

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE source: `/Users/luca/dev/winter-park/irene` (read-only reference). All `cp` commands go irene → template.
- Design tokens (phase 2 provides; this phase only consumes): accent slots `brand`, `accent`, `info`, `success`, `warning`, `destructive`, each a 4-role triad → tailwind classes `bg-<slot>`, `bg-<slot>-soft`, `text-<slot>-deep`, `text-<slot>-foreground` (and `ring-`, `from-`, `to-` prefixes); CSS vars `--<slot>`, `--<slot>-soft`, `--<slot>-deep`, `--<slot>-foreground` as hsl triplets consumed via `hsl(var(--<slot>))`. Semantic tone CSS vars: `--tone-urgent`, `--tone-attention`, `--tone-positive`, `--tone-info`, `--tone-neutral`. `shadow-bento` → `shadow-card`, `shadow-bento-lg` → `shadow-card-lg`. Soft surfaces always pair with `-deep` text (WCAG rule).
- **Canonical irene→template hue mapping (use EVERYWHERE in this phase, no exceptions):** `terracotta`→`brand` · `sage`→`success` · `honey`→`warning` · `info`→`info` · `destructive`→`destructive` · `charcoal` (solid dark anchor)→`accent` (solid: `bg-accent text-accent-foreground`) · `plum`/`lavender`→dropped (no slot; chart tone props accept raw CSS colors for extra hues) · `charcoal-2`/`charcoal-line`/`onDark` support→**dropped** (irene-hero-specific; the `onDark` prop is removed from ported components).
- **Tone contract (binding):** semantic tone colors come ONLY from phase 2's `lib/theme/tone.ts` (`Tone`, `TONES`, `isTone(v): v is Tone`, `toneColor(tone, role?): string`) — ported components NEVER re-declare tone→CSS-var tables. The chart kit funnels every tone-string→color resolution through one shared module, `components/ui/chart-tone.ts` (created in Task 8.12), which delegates semantic tones to `toneColor` and keeps only the accent-SLOT lookup local. (Tailwind-CLASS maps like Badge/Tile/GradientBar tone maps are class maps, not CSS-var tables — those stay per-component.)
- **Utility-class renames fixed by phase 2 (apply in EVERY ported file, code + JSDoc):** `label-mono` → `label-micro` · `display-serif` → `display-text` · `kicker-mono` → `kicker-text`. Phase 2 already defines `.label-micro` in `app/globals.css` (`@layer components`) and `shadow-card`/`shadow-card-lg` as `boxShadow` tokens in `tailwind.config.ts` — this phase adds NO fallback CSS. In-scope files that carry `label-mono` in irene: SectionLabel (13), Gauge (13, 94), Donut (125), AreaTrend (107), Heatmap (181), Rating (98), StatTile (77), Kanban (82).
- Copy: English defaults, all user-facing copy overridable via props. No hardcoded pt-BR anywhere. pt-BR examples in JSDoc/stories are translated.
- Effect naming (consumed indirectly): template `Tag` registries come from `createTagRegistry` in `lib/cache-registry.ts` (per-section registries — the template has NO central tag file; `refreshTags` gets an app-growable empty registry, see Task 8.19).
- Docs travel with code; every component that had a co-located `*.stories.tsx` in irene gets it ported (in scope: SearchCommand, MultiBar, Gauge, Heatmap, GradientBar, Tabs, NavBadge, Stepper, StatusPill, ModePill, Kanban).
- Verification gate: every task ends with `npx tsc --noEmit` → exit 0, plus task-appropriate command (`npx vitest run` for tested code, `npm run build-storybook` for story batches), and a git commit with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Template current state (verified 2026-07-08): `components/ui/` holds exactly `Button.tsx`, `Input.tsx`, `Label.tsx`. `package.json` already has `class-variance-authority`, `@radix-ui/react-dialog`, `framer-motion`, `lucide-react`, `tailwind-merge`, `clsx`. **New deps this phase:** `react-day-picker@^10.0.1`, `@radix-ui/react-popover@^1.1.17` (Task 8.6), `libphonenumber-js@^1.13.7` (Task 8.18).
- Template radii: `tailwind.config.ts` overrides only `lg/md/sm`; `rounded-xl/2xl/3xl` resolve to Tailwind defaults — keep them in ported classes as-is (unless phase 2 extended the scale; either way the classes compile). Form-control chrome uses the TEMPLATE's tokens: `rounded-md border-input bg-background` + `focus:ring-2 focus:ring-ring focus:ring-offset-1` — NOT irene's `rounded-xl bg-card border-ring/60 ring-ring/40`.

### Consumed interfaces (must exist before this phase)

| From | Interface |
|---|---|
| phase 2 | tailwind classes for the 6 slot triads + `shadow-card`/`shadow-card-lg`; CSS vars `--<slot>*`, `--tone-*`; `.label-micro` utility class |
| phase 2 | `type Tone`, `const TONES`, `isTone(value: unknown): value is Tone`, `toneColor(tone: Tone, role?: ToneRole): string` at `lib/theme/tone.ts` |
| phase 7 | `useScrollLock(active: boolean): void` at `lib/hooks/useScrollLock.ts` |
| phase 7 | `normalizeText(value: string): string`, `matchesQuery(haystack: string, query: string): boolean` at `lib/list/normalize.ts` |
| phase 1 | vitest runnable via `npx vitest run` (`.test.ts` files) |
| template | `cn(...inputs: ClassValue[]): string` at `lib/utils.ts` |
| template | `getSession(): Promise<SessionPayload \| null>` at `lib/auth/session.ts` |
| template | `entry.href()` from `app/dashboard/entry.ts` and `app/auth/identify/entry.ts` |

---

### Task 8.1: CVA Button

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/components/ui/Button.tsx` (replace whole file — currently 15 lines)

**Interfaces:**
- Consumes: `cn` (`@/lib/utils`), `cva`/`VariantProps` (`class-variance-authority`), phase-2 classes `bg-brand`, `text-brand-foreground`, `bg-accent`, `text-accent-foreground`, `bg-destructive`, `text-destructive-foreground`.
- Produces: `buttonVariants` (cva), `type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>` with `variant?: 'default'|'brand'|'accent'|'secondary'|'outline'|'ghost'|'destructive'|'link'`, `size?: 'default'|'sm'|'lg'|'icon'`, `block?: boolean` (default **true**), `function Button(props: ButtonProps): JSX.Element`.

Existing template call sites (`LoginForm.tsx`, `VerifyForm.tsx`, `RegisterForm.tsx` — no `variant`/`size` props passed) stay source-compatible: defaults render a full-width primary button exactly like today.

- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/Button.tsx` with this exact content (irene `components/ui/Button.tsx` with: pill `rounded-full` → template `rounded-md`; `terracotta` variant → `brand`; `sage` variant → `accent`; doc comment de-irene'd):

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * CVA button — the template's single button primitive. `default` rides the
 * primary token; `brand`/`accent` ride the accent-slot triads (swap hues via
 * the token palette, never here); plus secondary, outline, ghost, destructive,
 * link. `block` defaults to full-width (historical template behaviour);
 * `className` still wins via tailwind-merge.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ' +
    'transition-[opacity,transform,background-color,color,box-shadow] duration-150 ease-out ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 ' +
    '[&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground shadow-sm hover:opacity-90',
        brand:       'bg-brand text-brand-foreground shadow-sm hover:opacity-90',
        accent:      'bg-accent text-accent-foreground shadow-sm hover:opacity-90',
        secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        outline:     'border border-input bg-transparent text-foreground hover:bg-secondary/60',
        ghost:       'text-foreground hover:bg-secondary/60',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:opacity-90',
        link:        'text-foreground underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 text-sm',
        sm:      'h-9 px-4 text-xs',
        lg:      'h-12 px-7 text-base',
        icon:    'h-10 w-10 p-0',
      },
      block: {
        true:  'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      block: true,
    },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
  )
}
```

- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/Button.tsx && git commit -m "$(cat <<'EOF'
backport(components): CVA Button with variant/size/block on neutral slots

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.2: inputChrome + form kit (Field / Select / Textarea / Checkbox+Radio / Switch)

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/components/ui/Input.tsx` (extract `inputChrome`, keep template tokens)
- Create: `/Users/luca/dev/winter-park/template/components/ui/Field.tsx`, `Select.tsx`, `Textarea.tsx`, `Checkbox.tsx`, `Switch.tsx`

**Interfaces:**
- Consumes: `cn`, `Label` (existing `components/ui/Label.tsx`), `ChevronDown` (`lucide-react`).
- Produces: `export const inputChrome: string`; `Input(props: React.InputHTMLAttributes<HTMLInputElement>)`; `Field({ htmlFor?, label?, required?, hint?, error?, className?, children })`; `Select(props: React.SelectHTMLAttributes<HTMLSelectElement>)`; `Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>)`; `Checkbox(props: React.InputHTMLAttributes<HTMLInputElement>)`; `Radio(props: React.InputHTMLAttributes<HTMLInputElement>)`; `Switch({ checked: boolean, onCheckedChange: (next: boolean) => void, disabled?, className?, 'aria-label'? })`.

- [ ] Rewrite `/Users/luca/dev/winter-park/template/components/ui/Input.tsx` to (the classes are the template's CURRENT Input classes verbatim, extracted into the exported constant — do not adopt irene's `rounded-xl bg-card` chrome):

```tsx
import { cn } from '@/lib/utils'

/** Shared input chrome — the template's form-control surface. Reused by
 *  Textarea, DatePicker's trigger, MoneyInput and PhoneInput so every
 *  text-like control shares one look. */
export const inputChrome =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors ' +
  'placeholder:text-muted-foreground ' +
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputChrome, className)} {...props} />
}
```

- [ ] Copy source: `cp /Users/luca/dev/winter-park/irene/components/ui/Field.tsx /Users/luca/dev/winter-park/template/components/ui/Field.tsx` — then apply edits: **none needed** (token-clean; verify the JSDoc example `t.email` — replace the JSDoc example line ``*   <Field htmlFor="email" label={t.email} error={errors.email}>`` with ``*   <Field htmlFor="email" label="Email" error={errors.email}>`` so no i18n `t` is implied).
- [ ] Copy source: `cp /Users/luca/dev/winter-park/irene/components/ui/Textarea.tsx /Users/luca/dev/winter-park/template/components/ui/Textarea.tsx` — edits: line 4 JSDoc `mirrors Input's warm chrome` → `mirrors Input's chrome`. Nothing else (imports `inputChrome` from `./Input` which now exists).
- [ ] Copy source: `cp /Users/luca/dev/winter-park/irene/components/ui/Checkbox.tsx /Users/luca/dev/winter-park/template/components/ui/Checkbox.tsx` — edits: **none** (exports both `Checkbox` and `Radio`; uses only `accent-primary`, `border-input`, `ring-ring` — token-clean).
- [ ] Copy source: `cp /Users/luca/dev/winter-park/irene/components/ui/Switch.tsx /Users/luca/dev/winter-park/template/components/ui/Switch.tsx` — edits: **none** (uses `bg-primary`/`bg-input`/`bg-background` — token-clean).
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/Select.tsx` (irene `Select.tsx` with its inline chrome swapped to the template `inputChrome` tokens):

```tsx
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Styled native `<select>` — Input chrome + chevron affordance. Native keeps it
 * accessible + form-compatible (name/defaultValue/onChange). Pass `<option>`s
 * as children.
 */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm shadow-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}
```

- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/Input.tsx components/ui/Field.tsx components/ui/Select.tsx components/ui/Textarea.tsx components/ui/Checkbox.tsx components/ui/Switch.tsx && git commit -m "$(cat <<'EOF'
backport(components): form kit — Field/Select/Textarea/Checkbox/Radio/Switch + exported inputChrome

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.3: Editorial base — Card, Badge, IconChip, SectionLabel, Stat, PageHeader, Tile

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/Card.tsx`, `Badge.tsx`, `IconChip.tsx`, `SectionLabel.tsx`, `Stat.tsx`, `PageHeader.tsx`, `Tile.tsx`

**Interfaces:**
- Consumes: `cn`, `cva`; phase-2 classes `bg-{success,brand,warning,info,destructive}-soft`, `text-{...}-deep`, `bg-accent`, `text-accent-foreground`, `ring-{...}-deep/10`, `shadow-card`; phase-2 CSS utility `.label-micro`.
- Produces: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` (all `React.HTMLAttributes<HTMLDivElement>`-shaped); `badgeVariants`, `type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>` with `variant?: 'default'|'brand'|'accent'|'info'|'success'|'warning'|'destructive'|'outline'`, `Badge`; `IconChip({ tone?: 'plain'|'brand'|'accent'|'info'|'success'|'warning'|'destructive', size?: 'sm'|'md'|'lg', className?, children })`; `SectionLabel({ as?: 'h2'|'h3'|'span'|'p', ...HTMLAttributes })`; `Stat({ label?, value, sub?, size?: 'sm'|'md'|'lg', className? })`; `PageHeader({ kicker?, title, subtitle?, actions?, className? })`; `tileVariants`, `type TileProps` with `tone?: 'plain'|'brand'|'success'|'warning'|'info'|'destructive'|'brand-solid'|'success-solid'|'warning-solid'|'info-solid'|'accent'`, `Tile`, `isSolidTone(tone?: string | null): boolean`.

- [ ] Guard step — verify phase 2's outputs exist (dependency check, NOT a fallback): `grep -n "label-micro" /Users/luca/dev/winter-park/template/app/globals.css` → expected ≥1 match; `grep -n "card-lg" /Users/luca/dev/winter-park/template/tailwind.config.ts` → expected ≥1 match (`boxShadow['card-lg']`). If either is missing, STOP — phase 2 has not landed; do NOT add fallback CSS here.
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Card.tsx /Users/luca/dev/winter-park/template/components/ui/Card.tsx` — edits:
  1. line 3 JSDoc `warm card` → `card surface`
  2. line 5 `shadow-bento` → `shadow-card`
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/SectionLabel.tsx /Users/luca/dev/winter-park/template/components/ui/SectionLabel.tsx` — edits:
  1. line 13 `cn('label-mono', className)` → `cn('label-micro', className)`
  2. JSDoc lines 4-6 `uppercase, letter-spaced JetBrains Mono` → `uppercase, letter-spaced micro-label (\`.label-micro\`)`; example kickers `RECENTLY WATCHED`, `:: ALTITUDE` → `RECENTLY ADDED`, `:: OVERVIEW` (match phase 2's globals.css comment examples).
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Stat.tsx /Users/luca/dev/winter-park/template/components/ui/Stat.tsx` — edits: **none** (token-clean; uses SectionLabel + tabular-nums).
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/PageHeader.tsx /Users/luca/dev/winter-park/template/components/ui/PageHeader.tsx` — edits: JSDoc line 8 `the warm design language` → `the editorial design language`. Code unchanged.
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/IconChip.tsx /Users/luca/dev/winter-park/template/components/ui/IconChip.tsx` — edits (the `tones` record, lines 7–15, becomes exactly):

```ts
const tones = {
  plain:       'bg-secondary text-foreground',
  brand:       'bg-brand-soft text-brand-deep',
  accent:      'bg-accent text-accent-foreground',
  info:        'bg-info-soft text-info-deep',
  success:     'bg-success-soft text-success-deep',
  warning:     'bg-warning-soft text-warning-deep',
  destructive: 'bg-destructive-soft text-destructive-deep',
} as const
```
  (i.e. `sage`→`success`, `terracotta`→`brand`, `honey`→`warning`, `charcoal`→`accent` solid. Key order as shown.)
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Badge.tsx /Users/luca/dev/winter-park/template/components/ui/Badge.tsx` — edits (replace the `variant` map, lines 11–24, with exactly — drops irene's duplicate semantic aliases `primary/success/warning` since the slot names ARE semantic now):

```ts
      variant: {
        default:     'bg-secondary text-secondary-foreground',
        brand:       'bg-brand-soft text-brand-deep',
        accent:      'bg-accent text-accent-foreground',
        info:        'bg-info-soft text-info-deep',
        success:     'bg-success-soft text-success-deep',
        warning:     'bg-warning-soft text-warning-deep',
        destructive: 'bg-destructive-soft text-destructive-deep',
        outline:     'border border-input text-muted-foreground',
      },
```
  Also line 4 JSDoc `Warm pill badge — soft tinted fills from the organic accent palette.` → `Pill badge — soft tinted fills from the accent-slot palette.`
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Tile.tsx /Users/luca/dev/winter-park/template/components/ui/Tile.tsx` — edits:
  1. Replace the `tone` map (lines 19–33) with exactly:
```ts
    tone: {
      plain:           'bg-card text-card-foreground',
      brand:           'bg-brand-soft text-brand-deep ring-1 ring-inset ring-brand-deep/10',
      success:         'bg-success-soft text-success-deep ring-1 ring-inset ring-success-deep/10',
      warning:         'bg-warning-soft text-warning-deep ring-1 ring-inset ring-warning-deep/10',
      'brand-solid':   'bg-brand text-brand-foreground',
      'success-solid': 'bg-success text-success-foreground',
      'warning-solid': 'bg-warning text-warning-foreground',
      // Solid dark/neutral anchor block (irene's charcoal analog).
      accent:          'bg-accent text-accent-foreground',
      info:            'bg-info-soft text-info-deep ring-1 ring-inset ring-info-deep/10',
      'info-solid':    'bg-info text-info-foreground',
      destructive:     'bg-destructive-soft text-destructive-deep ring-1 ring-inset ring-destructive-deep/10',
    },
```
  2. line 17 `shadow-bento` → `shadow-card`
  3. `isSolidTone` body (line 40): `return tone === 'charcoal' || (typeof tone === 'string' && tone.endsWith('-solid'))` → `return tone === 'accent' || (typeof tone === 'string' && tone.endsWith('-solid'))`
  4. JSDoc: `warm dashboard grid` → `dashboard grid`; `a solid honey/terracotta/charcoal tile` → `a solid warning/brand/accent tile`; delete the `// Cool accent — AI / info surfaces ONLY …` inline comment's salon references (keep the rule: `// Cool accent — AI / info surfaces ONLY (insight cards, info banners).` stays as-is, it is generic).
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/Card.tsx components/ui/Badge.tsx components/ui/IconChip.tsx components/ui/SectionLabel.tsx components/ui/Stat.tsx components/ui/PageHeader.tsx components/ui/Tile.tsx && git commit -m "$(cat <<'EOF'
backport(components): editorial base — Card, Badge, IconChip, SectionLabel, Stat, PageHeader, Tile

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.4: Toast system + root-layout mount

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/Toast.tsx`, `/Users/luca/dev/winter-park/template/components/ui/useToastProvider.ts`
- Modify: `/Users/luca/dev/winter-park/template/app/layout.tsx` (mount `ToastProvider`)

**Interfaces:**
- Consumes: `IconChip` (8.3), `Button` (8.1), `cn`; lucide `CheckCircle2, AlertCircle, Info, X`.
- Produces: `type ToastTone = 'default' | 'success' | 'destructive'`; `type ToastAction = { label: string; onClick: () => void }`; `type ToastInput = { message: string; tone?: ToastTone; action?: ToastAction; duration?: number }`; `type ToastItem = ToastInput & { id: number }`; `useToast(): { toast: (t: ToastInput) => void; dismiss: (id: number) => void }`; `ToastProvider({ children })`; `useToastProvider()`, `useToastEnterAnimation()` (hook file). **Later phases (9, 10) call `useToast` for upload/AI feedback.**

- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/useToastProvider.ts /Users/luca/dev/winter-park/template/components/ui/useToastProvider.ts` — edits: **none** (pure hook logic, no irene-isms).
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Toast.tsx /Users/luca/dev/winter-park/template/components/ui/Toast.tsx` — edits:
  1. JSDoc lines 12–14: `action confirmations ("Check-in registrado"), the 5-second "Desfazer" undo affordance` → `action confirmations ("Saved"), the 5-second undo affordance`
  2. `TONE_CHIP` (lines 75–79): `success: 'sage',` → `success: 'success',` (keys `default: 'info'` and `destructive: 'destructive'` unchanged — they exist in the new IconChip tone union)
  3. line 92 `shadow-bento` → `shadow-card`
  4. `aria-label="Dismiss"` (line 113) — already English; add a `dismissLabel?: string` prop is NOT needed (it is a per-card constant); leave as-is.
- [ ] Modify `/Users/luca/dev/winter-park/template/app/layout.tsx` — **anchor on JSX structure, NOT line numbers** (phases 2 and 4 both touched this file; preserve phase 2's font/className/body-style changes and phase 4's imports, viewport export, `lang={DEFAULT_LOCALE}`, `<TimezoneSync />` and `<ThemeProvider>` wrapping untouched):
  1. Add `import { ToastProvider } from '@/components/ui/Toast'` after the existing provider imports.
  2. Nest `ToastProvider` as the INNERMOST wrapper around `{children}`. After phase 4 the body reads `<TimezoneSync />` followed by `<ThemeProvider>{children}</ThemeProvider>`, so the wrapping becomes:

```tsx
        <TimezoneSync />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
```
  (Skip if `ToastProvider` is already present. If phase 4 has NOT landed yet — dependency violation — stop and run phase 4 first.)
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx next build 2>&1 | tail -5` → expected: build completes (layout is a server component wrapping a client provider — must compile). The build script runs the migration runner first; if no scratch `DATABASE_URL` is configured, defer this build check to phase 13's gate (note that in the commit body) and rely on tsc here + storybook build in 8.10.
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/Toast.tsx components/ui/useToastProvider.ts app/layout.tsx && git commit -m "$(cat <<'EOF'
backport(components): Toast system with undo action slot; mount ToastProvider in root layout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.5: ConfirmDialog + useConfirmDialog

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/ConfirmDialog.tsx`

**Interfaces:**
- Consumes: `Button` (8.1), `IconChip` (8.3), `@radix-ui/react-dialog` (already in package.json), lucide `AlertTriangle`.
- Produces: `type ConfirmDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; confirmLabel?: string; cancelLabel?: string; tone?: 'destructive' | 'default'; pending?: boolean; onConfirm: () => void }`; `ConfirmDialog(props)`; `useConfirmDialog(): { confirm: (request: Omit<ConfirmDialogProps, 'open'|'onOpenChange'|'onConfirm'|'pending'>) => Promise<boolean>; dialog: JSX.Element }`.

- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/ConfirmDialog.tsx /Users/luca/dev/winter-park/template/components/ui/ConfirmDialog.tsx` — edits (**English defaults via props, no i18n import**):
  1. DELETE line 7 `import { useLocale } from '@/lib/i18n/LocaleProvider'` and line 8 `import type { Locale } from '@/lib/i18n/types'`
  2. DELETE the `FALLBACK_COPY` block (lines 30–34)
  3. In the `ConfirmDialog` destructuring (lines 54–64): `confirmLabel,` → `confirmLabel = 'Confirm',` and `cancelLabel,` → `cancelLabel = 'Cancel',`
  4. DELETE lines 65–66 (`const locale = useLocale()` and `const fallback = FALLBACK_COPY[locale] ?? FALLBACK_COPY['pt-BR']`)
  5. line 108 `{cancelLabel ?? fallback.cancel}` → `{cancelLabel}`; line 118 `{confirmLabel ?? fallback.confirm}` → `{confirmLabel}`
  6. line 78 `shadow-bento` → `shadow-card`
  7. JSDoc: line 14-15 `styled with the warm tokens (\`bg-card\` bento, \`shadow-bento\`, rounded-3xl)` → `styled with the card tokens (\`bg-card\`, \`shadow-card\`, rounded-3xl)`; prop docs line 39 example `"Excluir cliente?"` → `"Delete item?"`; line 41 `"Esta ação não pode ser desfeita."` → `"This action cannot be undone."`; lines 43-45 `Defaults to a localized "Confirmar"/"Cancelar"` → `Defaults to "Confirm"` / `Defaults to "Cancel"`; useConfirmDialog JSDoc line 136 `confirm({ title: 'Excluir?', description: '…' })` → `confirm({ title: 'Delete?', description: '…' })`
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/ConfirmDialog.tsx && git commit -m "$(cat <<'EOF'
backport(components): ConfirmDialog + useConfirmDialog promise API (English defaults)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.6: Popover + Calendar + DatePicker (+ useDatePicker)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/Popover.tsx`, `Calendar.tsx`, `DatePicker.tsx`, `useDatePicker.ts`
- Modify: `/Users/luca/dev/winter-park/template/package.json` (via npm install)

**Interfaces:**
- Consumes: `inputChrome` (8.2), `cn`; new deps `react-day-picker@^10.0.1`, `@radix-ui/react-popover@^1.1.17`.
- Produces: `Popover`, `PopoverTrigger`, `PopoverAnchor`, `PopoverContent`; `Calendar(props: React.ComponentProps<typeof DayPicker>)`, `type CalendarProps`; `parseIsoDate(iso: string | undefined): Date | undefined`; `toIsoDate(date: Date | undefined): string`; `useDatePicker(defaultValue: string | undefined)`; `DatePicker({ name?, id?, defaultValue?, value?, onChange?, required?, disabled?, min?, max?, placeholder?, className?, onValueChange?, locale?: string })` — hidden-input `YYYY-MM-DD` form contract preserved.

- [ ] Install deps: `cd /Users/luca/dev/winter-park/template && npm install react-day-picker@^10.0.1 @radix-ui/react-popover@^1.1.17` → expected: exit 0, both appear in `package.json` dependencies (idempotent if phase 1 pre-installed).
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Popover.tsx /Users/luca/dev/winter-park/template/components/ui/Popover.tsx` — edits:
  1. line 27 `shadow-bento` → `shadow-card`
  2. JSDoc lines 7-9: `styled with the warm design tokens` → `styled with the card tokens`; `a \`bg-card\` bento with \`shadow-bento\`` → `a \`bg-card\` surface with \`shadow-card\``
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Calendar.tsx /Users/luca/dev/winter-park/template/components/ui/Calendar.tsx` — edits (the old `--accent` hover-surface role is now a saturated slot; hovers move to `muted`):
  1. line 32 and line 36: `hover:bg-accent hover:text-foreground` → `hover:bg-muted hover:text-foreground` (both `button_previous` and `button_next`)
  2. line 46 (`day_button`): `hover:bg-accent hover:text-foreground` → `hover:bg-muted hover:text-foreground`
  3. line 59 (`range_middle`): `[&>button]:bg-accent` → `[&>button]:bg-muted`
  4. JSDoc lines 10-13: `styled with Irene's WARM design tokens (NOT default shadcn slate): \`bg-card\` surface, \`bg-secondary\`/\`accent\` for nav + hover, terracotta \`ring\`/\`primary\` for the selected day` → `styled with the template tokens: \`bg-card\` surface, \`bg-secondary\`/\`muted\` for nav + hover, \`primary\` for the selected day`
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/useDatePicker.ts /Users/luca/dev/winter-park/template/components/ui/useDatePicker.ts` — edits: **none** (pure date-string helpers + local state, no irene-isms).
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/DatePicker.tsx /Users/luca/dev/winter-park/template/components/ui/DatePicker.tsx` — edits (**locale prop defaulting to Intl**):
  1. DELETE line 5 `import { useLocale } from '@/lib/i18n/LocaleProvider'`
  2. Add to `Props` (after `onValueChange`): `/** BCP-47 locale for the trigger's date label. Defaults to the runtime locale — pass the app locale for SSR-stable output. */\n  locale?: string`
  3. Add `locale,` to the destructured props (after `onValueChange,`)
  4. line 61 `const locale = useLocale()` → `const resolvedLocale = locale ?? new Intl.DateTimeFormat().resolvedOptions().locale`
  5. line 87 `selected.toLocaleDateString(locale, {...})` → `selected.toLocaleDateString(resolvedLocale, {...})`
  6. JSDoc line 39 `Warm shadcn-style date picker` → `Shadcn-style date picker`
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add package.json package-lock.json components/ui/Popover.tsx components/ui/Calendar.tsx components/ui/DatePicker.tsx components/ui/useDatePicker.ts && git commit -m "$(cat <<'EOF'
backport(components): DatePicker/Calendar/Popover with YYYY-MM-DD hidden-input contract

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.7: ListSearch + useListFilter + FilterableList

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/ListSearch.tsx`, `useListFilter.ts`, `FilterableList.tsx`

**Interfaces:**
- Consumes: `Input` (8.2), `Card` (8.3), `matchesQuery` from `@/lib/list/normalize` (phase 7), lucide `Search, X, SearchX`.
- Produces: `ListSearch({ value, onValueChange, placeholder?, clearLabel?, className? })` (English defaults); `type FilterEntry = { key: string; keywords: string }`; `useListFilter(entries: FilterEntry[]): { query, setQuery, clear, isFiltering, isEmpty, matchCount, isVisible }`; `type FilterableRow = { key: string; keywords: string; node: ReactNode }`; `FilterableList({ rows, placeholder?, clearLabel?, noResults?, variant?, listClassName?, listProps?, toolbarClassName? })`.

- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/useListFilter.ts /Users/luca/dev/winter-park/template/components/ui/useListFilter.ts` — edits: **none** (imports `matchesQuery` from `@/lib/list/normalize` — same path in template after phase 7).
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/ListSearch.tsx /Users/luca/dev/winter-park/template/components/ui/ListSearch.tsx` — edits (**English defaults**):
  1. Props type (lines 6-14): `placeholder: string` → `placeholder?: string`, `clearLabel: string` → `clearLabel?: string`
  2. Destructuring (line 24): `placeholder, clearLabel` → `placeholder = 'Search…', clearLabel = 'Clear search'`
  3. JSDoc lines 20-23: delete the sentence `this matches the design system's \`Input\` chrome (warm card surface, terracotta focus ring) and the existing \`CustomerSearchBox\` placement.` → replace with `Styled by the shared \`Input\` chrome.`
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/FilterableList.tsx /Users/luca/dev/winter-park/template/components/ui/FilterableList.tsx` — edits:
  1. Props (lines 20-25): `placeholder: string` → `placeholder?: string`; `clearLabel: string` → `clearLabel?: string`; `noResults: string` → `noResults?: string`
  2. Destructuring (lines 56-65): `placeholder,` → `placeholder = 'Search…',`; `clearLabel,` → `clearLabel = 'Clear search',`; `noResults,` → `noResults = 'No results for “{q}”',`
  3. JSDoc/prop comments: line 21 `(pt-BR "Buscar…")` → deleted; keep the `{q}` token doc.
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/ListSearch.tsx components/ui/useListFilter.ts components/ui/FilterableList.tsx && git commit -m "$(cat <<'EOF'
backport(components): ListSearch + useListFilter + FilterableList on lib/list/normalize

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.8: downscale-image (verbatim)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/downscale-image.ts`

**Interfaces:**
- Produces: `downscaleImage(file: File, maxDim?: number, quality?: number): Promise<File>` — **phase 9 (Blob ImageUpload/AvatarField) imports this.**

- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/downscale-image.ts /Users/luca/dev/winter-park/template/components/ui/downscale-image.ts` — edits: **none** (verbatim per spec; already English, zero salon references).
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/downscale-image.ts && git commit -m "$(cat <<'EOF'
backport(components): downscale-image client-side pre-upload downscaler (verbatim)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.9: Reveal (verbatim)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/Reveal.tsx`

**Interfaces:**
- Consumes: `framer-motion` (already in package.json), `cn`.
- Produces: `Reveal({ children, delay?, index?, className?, as?: 'div' | 'section' })`.

- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Reveal.tsx /Users/luca/dev/winter-park/template/components/ui/Reveal.tsx` — edits: **none** (verbatim per spec; token-free, reduced-motion aware, English docs).
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/Reveal.tsx && git commit -m "$(cat <<'EOF'
backport(components): Reveal mount-animation primitive (verbatim)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.10: SearchCommand + useSearchCommand + story

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/SearchCommand.tsx`, `useSearchCommand.ts`, `SearchCommand.stories.tsx`

**Interfaces:**
- Consumes: `IconChip` (8.3), `useScrollLock` from `@/lib/hooks/useScrollLock` (phase 7), `cn`; story consumes `entry` from `@/app/dashboard/entry` and `@/app/auth/identify/entry` (typed-exit-only hrefs).
- Produces: `type CommandItem = { id, label, hint?, icon?, href?, onSelect?, keywords?, pinned? }`; `type CommandGroup = { heading?, items: CommandItem[] }`; `SearchCommand({ groups, placeholder?, triggerLabel?, emptyLabel?, loadingLabel?, dialogLabel?, className?, loading?, serverDriven?, renderTrigger?, onQueryChange?, subscribeOpen?, headerSlot?, footer?, onSubmitQuery? })`; `useSearchCommand(opts)` — **phase 10 (AI widgets) reuses headerSlot/footer/onSubmitQuery slots.**

- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/useSearchCommand.ts /Users/luca/dev/winter-park/template/components/ui/useSearchCommand.ts` — edits: **none** (imports `@/lib/hooks/useScrollLock` — same template path; logic is generic).
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/SearchCommand.tsx /Users/luca/dev/winter-park/template/components/ui/SearchCommand.tsx` — edits:
  1. Defaults (lines 42-47): `placeholder = 'Buscar telas, clientes, serviços…'` → `placeholder = 'Search…'`; `triggerLabel = 'Buscar'` → `triggerLabel = 'Search'`; `emptyLabel = 'Nada encontrado'` → `emptyLabel = 'No results'`; `loadingLabel = 'Buscando…'` → `loadingLabel = 'Searching…'`
  2. Add prop `dialogLabel = 'Quick search'` to the destructuring + `/** a11y name for the palette dialog. */ dialogLabel?: string` to the props type; line 119 `aria-label="Busca rápida"` → `aria-label={dialogLabel}`
  3. line 113 overlay `bg-charcoal/40` → `bg-foreground/40`
  4. line 120 `shadow-bento-lg` → `shadow-card-lg`
  5. JSDoc: line 29-31 `the "Ask Irene about '…'" fallback` → `an "Ask AI about '…'" fallback`; line 16-17 `02-component-catalog §3.4.` → deleted; line 13-14 `\`bg-card shadow-bento-lg\` dialog` → `\`bg-card shadow-card-lg\` dialog`; useSearchCommand JSDoc mention of "the inline assistant" stays (generic).
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/SearchCommand.stories.tsx` (rewrite of irene's story: two-item example wired to TEMPLATE routes through typed entries — no raw URL strings):

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { LayoutDashboard, LogIn } from 'lucide-react'
import { SearchCommand } from './SearchCommand'
import { entry as dashboardEntry } from '@/app/dashboard/entry'
import { entry as identifyEntry } from '@/app/auth/identify/entry'

const meta: Meta<typeof SearchCommand> = {
  component: SearchCommand,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof SearchCommand>

/** Items carry typed hrefs from the RouteRegistry entries — never raw URL strings. */
export const Default: Story = {
  args: {
    groups: [
      {
        heading: 'Screens',
        items: [
          { id: 'dashboard', label: 'Dashboard', hint: 'Overview', icon: <LayoutDashboard />, href: dashboardEntry.href() },
          { id: 'sign-in', label: 'Sign in', hint: 'Auth', icon: <LogIn />, href: identifyEntry.href() },
        ],
      },
    ],
  },
}
```
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npm run build-storybook` → expected: exit 0, `storybook-static/` built (first story of the phase — catches config drift early).
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/SearchCommand.tsx components/ui/useSearchCommand.ts components/ui/SearchCommand.stories.tsx && git commit -m "$(cat <<'EOF'
backport(components): SearchCommand palette with typed-exit items + story

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.11: Chart kit A — Delta, Sparkline, Progress, MiniBars

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/Delta.tsx`, `Sparkline.tsx`, `Progress.tsx`, `MiniBars.tsx`

**Interfaces:**
- Consumes: `cn`; phase-2 classes `bg-success-soft text-success-deep`, `bg-destructive-soft text-destructive-deep`, `bg-brand`, `bg-warning`, `bg-success`.
- Produces: `Delta({ value: string, invert?, className? })`; `Sparkline({ data: number[], width?, height?, strokeWidth?, fill?, className? })`; `Progress({ value, max?, tone?: 'brand'|'success'|'warning'|'primary', label?, valueLabel?, className? })`; `MiniBars({ data: number[], labels?, activeIndex?, height?, className? })`.

- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Delta.tsx /Users/luca/dev/winter-park/template/components/ui/Delta.tsx` — edits:
  1. line 29 `good === true && 'bg-sage-soft text-sage-deep',` → `good === true && 'bg-success-soft text-success-deep',`
  2. JSDoc line 6 `toned sage (up/good) or destructive (down/bad)` → `toned success (up/good) or destructive (down/bad)`
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Sparkline.tsx /Users/luca/dev/winter-park/template/components/ui/Sparkline.tsx` — edits: **none** (currentColor-driven, token-free).
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Progress.tsx /Users/luca/dev/winter-park/template/components/ui/Progress.tsx` — edits:
  1. `FILL` map (lines 3-8) becomes exactly:
```ts
const FILL = {
  brand:   'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  primary: 'bg-primary',
} as const
```
  2. Default (line 23): `tone = 'terracotta'` → `tone = 'brand'`
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/MiniBars.tsx /Users/luca/dev/winter-park/template/components/ui/MiniBars.tsx` — edits:
  1. line 36 `i === activeIndex ? 'bg-terracotta' : 'bg-secondary',` → `i === activeIndex ? 'bg-brand' : 'bg-secondary',`
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/Delta.tsx components/ui/Sparkline.tsx components/ui/Progress.tsx components/ui/MiniBars.tsx && git commit -m "$(cat <<'EOF'
backport(components): chart kit A — Delta, Sparkline, Progress, MiniBars

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.12: Chart kit B — chart-tone resolver, MultiBar (+story), Donut, Gauge (+story)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/chart-tone.ts`, `MultiBar.tsx`, `MultiBar.stories.tsx`, `Donut.tsx`, `Gauge.tsx`, `Gauge.stories.tsx`

**Interfaces:**
- Consumes: `cn`, `Delta` (8.11), `Tile` (8.3, stories only); `isTone`, `toneColor` from `@/lib/theme/tone` (phase 2 Task 2.5); CSS vars `--brand --accent --info --success --warning --destructive --tone-* --muted --muted-foreground --border`.
- Produces: `chartColor(tone: string): string` (`chart-tone.ts` — consumed by 8.13); `type MultiBarSeries = { label: string; tone: string; values: number[] }`, `MultiBar({ series, labels, signed?, height?, barWidth?, barGap?, groupGap?, radius?, showLegend?, format?, className?, 'aria-label'? })`; `shortenName(name: React.ReactNode): React.ReactNode`, `type DonutSegment`, `type DonutLegendRow`, `Donut({ segments, size?, thickness?, centerLabel?, centerSub?, legend?, legendTopShare?, className? })`; `type GaugeTone = 'success'|'warning'|'destructive'|'brand'|'info'`, `Gauge({ value, label?, sub?, delta?, deltaInvert?, tone?: GaugeTone, variant?: 'semi'|'ring', size?, format?, className? })` — **no `onDark` prop** (dropped).

Per the binding tone-contract rule (Global Constraints): irene's per-file `TONE` records are NOT re-declared. One shared resolver delegates semantic tones to `lib/theme/tone` and keeps only the accent-slot lookup:

- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/chart-tone.ts` with this exact content:

```ts
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
```
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/MultiBar.tsx /Users/luca/dev/winter-park/template/components/ui/MultiBar.tsx` — edits:
  1. DELETE the `TONE` record (lines 26-35) entirely; add `import { chartColor } from './chart-tone'` after the `cn` import.
  2. line 124 `const color = TONE[s.tone] ?? s.tone` → `const color = chartColor(s.tone)`; line 161 legend swatch `style={{ backgroundColor: TONE[s.tone] ?? s.tone }}` → `style={{ backgroundColor: chartColor(s.tone) }}`
  3. `MultiBarSeries.tone` (lines 38-40): type `tone: keyof typeof TONE | string` → `tone: string`; doc `/** Token key (\`sage\` | \`terracotta\` | …) or any CSS color string. */` → `/** Tone name (semantic \`positive\`/… or slot \`brand\`/\`success\`/…) or any raw CSS color string — resolved by \`chartColor\`. */`
  4. line 104 `aria-label={\`Comparação por período — ${series.map((s) => s.label).join(', ')}\`}` → add an `'aria-label'?: string` prop (destructure as `'aria-label': ariaLabel`) and use `aria-label={ariaLabel ?? \`Grouped bars — ${series.map((s) => s.label).join(', ')}\`}`
  5. JSDoc example (lines 11-23): translate — `'Entradas'`→`'Income'`, `'Saídas'`→`'Expenses'`, `tone: 'sage'`→`tone: 'success'`, `tone: 'terracotta'`→`tone: 'destructive'`, `format={(n) => \`R$ ${Math.abs(n)}\`}` → `` format={(n) => `$${Math.abs(n)}`} ``, `labels={['Seg','Ter','Qua']} … { label: 'Cortes', tone: 'info', values: [4,7,3] }` → `labels={['Mon','Tue','Wed']} … { label: 'Sessions', tone: 'info', values: [4,7,3] }`
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Donut.tsx /Users/luca/dev/winter-park/template/components/ui/Donut.tsx` — edits:
  1. DELETE the `TONE` record (lines 3-11); add `import { chartColor } from './chart-tone'` after the `cn` import.
  2. line 14 `const PALETTE = ['sage', 'terracotta', 'honey', 'info', 'plum', 'charcoal'] as const` → `const PALETTE = ['brand', 'accent', 'info', 'success', 'warning', 'neutral'] as const`; its comment `/** Default warm-editorial cycle when a segment omits its \`tone\`. */` → `/** Default categorical cycle when a segment omits its \`tone\`. */`
  3. `DonutSegment` (line 30) and the `legendTopShare` row type (line 38): `tone?: keyof typeof TONE | string` → `tone?: string` (both occurrences)
  4. line 108 `stroke={TONE[segTone] ?? segTone}` → `stroke={chartColor(segTone)}`; line 141 `const dot = TONE[(row.tone as string) ?? PALETTE[i % PALETTE.length]] ?? (row.tone as string)` → `const dot = chartColor((row.tone as string) ?? PALETTE[i % PALETTE.length])`
  5. line 89 `? 'maior'` → `? 'largest'` (the top-share sub fallback); JSDoc line 49 `with a "maior" sub` → `with a "largest" sub`
  6. line 125 `className="label-mono mt-0.5 text-muted-foreground"` → `className="label-micro mt-0.5 text-muted-foreground"`
  7. `shortenName` + everything else: unchanged.
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Gauge.tsx /Users/luca/dev/winter-park/template/components/ui/Gauge.tsx` — edits (**drop `onDark`, no local color table**):
  1. DELETE the `ARC_TONE` record (lines 20-26); add `import { chartColor } from './chart-tone'` after the `cn` import; in its place define:
```ts
export type GaugeTone = 'success' | 'warning' | 'destructive' | 'brand' | 'info'
```
  2. `bandTone` (lines 29-33): return type `keyof typeof ARC_TONE` → `GaugeTone`; `return 'sage'` → `return 'success'`; `return 'honey'` → `return 'warning'`; comment `≥0.7 good, ≥0.4 watch, else bad` stays.
  3. line 56 prop `tone?: keyof typeof ARC_TONE` → `tone?: GaugeTone`
  4. line 73 `const arcColor = ARC_TONE[tone ?? bandTone(fraction)]` → `const arcColor = chartColor(tone ?? bandTone(fraction))`
  5. Remove `onDark = false,` from the destructuring (line 44) and the `/** Recolor the track… */ onDark?: boolean` prop (lines 60-61).
  6. line 74 `const trackColor = onDark ? 'hsl(var(--charcoal-2))' : 'hsl(var(--muted))'` → `const trackColor = 'hsl(var(--muted))'`
  7. line 75 `const capColor = onDark ? 'hsl(var(--charcoal-foreground))' : 'hsl(var(--muted-foreground))'` → `const capColor = 'hsl(var(--muted-foreground))'`
  8. line 78 `const centerCls = onDark ? 'text-current' : 'text-foreground'` → `const centerCls = 'text-foreground'`
  9. line 79 `const subCls = onDark ? 'text-current opacity-75' : 'text-muted-foreground'` → `const subCls = 'text-muted-foreground'`
  10. line 94 `{label && <p className={cn('label-mono mt-1', onDark && 'text-current opacity-90')}>{label}</p>}` → `{label && <p className="label-micro mt-1">{label}</p>}`
  11. JSDoc: line 11 `(good → sage, watch → honey, bad → destructive)` → `(good → success, watch → warning, bad → destructive)`; line 13 `` `.label-mono` sub `` → `` `.label-micro` sub ``; delete line 14-15 sentence `Track is \`muted\` on light, \`charcoal-2\` on a dark anchor.`; line 17 example `<Gauge value={0.82} label="Occupancy" delta="+4%" />` stays; line 18 `tone="info"` stays.
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/Gauge.stories.tsx` (irene story, English, OnDark story dropped):

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Gauge } from './Gauge'

const meta: Meta<typeof Gauge> = {
  component: Gauge,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof Gauge>

export const Good: Story = {
  args: { value: 0.72, label: 'Return rate', sub: 'last 30 days', delta: '+4%' },
}

export const Watch: Story = {
  args: { value: 0.52, label: 'Occupancy', sub: 'this week' },
}

export const Bad: Story = {
  args: { value: 0.21, label: 'Monthly goal', delta: '-8%' },
}

export const Forced: Story = {
  args: { value: 0.66, label: 'Readiness', tone: 'success' },
}

export const Ring: Story = {
  args: { variant: 'ring', value: 64, label: 'Setup', tone: 'info' },
}

export const Empty: Story = {
  args: { value: NaN, label: 'Return rate' },
}
```
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/MultiBar.stories.tsx` (irene story, English labels + new tones):

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { MultiBar } from './MultiBar'
import { Tile } from './Tile'

const meta: Meta<typeof MultiBar> = {
  component: MultiBar,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof MultiBar>

export const IncomeVsExpense: Story = {
  render: (args) => (
    <Tile tone="plain" className="w-[420px] p-5">
      <MultiBar {...args} />
    </Tile>
  ),
  args: {
    labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
    signed: true,
    format: (n) => `$${Math.abs(n)}`,
    series: [
      { label: 'Income', tone: 'success', values: [1200, 1800, 900, 2100] },
      { label: 'Expenses', tone: 'destructive', values: [-700, -500, -1100, -650] },
    ],
  },
}

export const GroupedPlain: Story = {
  render: (args) => (
    <Tile tone="plain" className="w-[420px] p-5">
      <MultiBar {...args} />
    </Tile>
  ),
  args: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    series: [
      { label: 'Sessions', tone: 'info', values: [4, 7, 3, 6, 9, 12] },
      { label: 'Sign-ups', tone: 'warning', values: [2, 3, 1, 4, 5, 6] },
    ],
  },
}

export const SingleSeries: Story = {
  render: (args) => (
    <Tile tone="plain" className="w-[360px] p-5">
      <MultiBar {...args} />
    </Tile>
  ),
  args: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    showLegend: false,
    series: [{ label: 'Revenue', tone: 'success', values: [3200, 4100, 3800, 5200, 4900, 6100] }],
  },
}
```
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/chart-tone.ts components/ui/MultiBar.tsx components/ui/MultiBar.stories.tsx components/ui/Donut.tsx components/ui/Gauge.tsx components/ui/Gauge.stories.tsx && git commit -m "$(cat <<'EOF'
backport(components): chart kit B — chartColor resolver on lib/theme/tone; MultiBar, Donut, Gauge + stories

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.13: Chart kit C — AreaTrend, Heatmap (+story), GradientBar (+story), Rating

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/AreaTrend.tsx`, `Heatmap.tsx`, `Heatmap.stories.tsx`, `GradientBar.tsx`, `GradientBar.stories.tsx`, `Rating.tsx`

**Interfaces:**
- Consumes: `cn`, `Tile` (stories), lucide `Star`; `chartColor(tone: string): string` from `./chart-tone` (Task 8.12 — the ONLY tone→color source; no per-file TONE records).
- Produces: `AreaTrend({ data, tone?, baseline?, width?, height?, strokeWidth?, fill?, showDot?, emptyLabel?, className?, 'aria-label'? })`; `type HeatmapDatum = { date: string | Date; value: number }`, `Heatmap({ data, tone?, weekdayLabels?, cell?, gap?, radius?, emptyLabel?, className? })`; `type GradientBarDatum = { label: string; value: number }`, `GradientBar({ data, activeIndex?, valueLabel?, tone?: 'brand'|'success'|'warning'|'info', height?, className? })` (no `onDark`); `Rating({ value, max?, display?, label?, count?, countLabel?, tone?, size?, className? })` (no `onDark`).

(GradientBar's `TONE_FILL` is a Tailwind-CLASS map — `from-*-soft to-*` gradient classes, not CSS-var colors — so it stays a local per-component map per the Global Constraints tone-contract rule.)

- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/AreaTrend.tsx /Users/luca/dev/winter-park/template/components/ui/AreaTrend.tsx` — edits:
  1. DELETE the `TONE` record (lines 23-31); add `import { chartColor } from './chart-tone'` after the `cn` import.
  2. line 66 `const color = TONE[tone as string] ?? (tone as string)` → `const color = tone === 'muted' ? 'hsl(var(--muted-foreground))' : chartColor(tone as string)` with the comment `// 'muted' strokes with muted-foreground — a bg-muted line would be invisible.`
  3. tone prop type (line ~50) `tone?: keyof typeof TONE | (string & {})` → `tone?: string`; its doc `/** Token name (sage/terracotta/honey/charcoal/info/plum/muted) or any raw CSS color. */` → `/** Tone name (semantic or accent-slot, e.g. \`success\`/\`brand\`/\`muted\`) or any raw CSS color — resolved by \`chartColor\`. */`
  4. Default tone stays `'info'` (line 36).
  5. line 62 `emptyLabel = 'Sem movimento',` → `emptyLabel = 'No movement',`; prop doc line 60-61 `(defaults to "Sem movimento")` → `(defaults to "No movement")`
  6. line 91 `aria-label={ariaLabel ?? (typeof emptyLabel === 'string' ? emptyLabel : 'Sem movimento')}` → `… : 'No movement')}`
  7. line 107 `className="label-mono text-[10px] text-muted-foreground"` → `className="label-micro text-[10px] text-muted-foreground"`
  8. JSDoc lines 11-15: `Color is driven entirely by \`tone\`: a known token name (sage/terracotta/honey/charcoal/info/plum/muted) maps to its CSS var, OR pass any raw CSS color string.` → `Color is driven entirely by \`tone\`: a semantic tone or accent-slot name resolves via \`chartColor\`, OR pass any raw CSS color string.`; line 76 comment `synthesized for "Faturamento de hoje R$ 0,00"` → `synthesized for a zero-revenue day`; line 77 `a muted "sem movimento" caption` → `a muted "no movement" caption`; line 19-21 examples: `tone="sage"` → `tone="success"`.
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Heatmap.tsx /Users/luca/dev/winter-park/template/components/ui/Heatmap.tsx` — edits:
  1. DELETE the `TONE` record (lines 27-36); add `import { chartColor } from './chart-tone'` after the `cn` import.
  2. line 88 `const color = TONE[tone] ?? tone` → `const color = chartColor(tone)`; tone prop type (line 76) `tone?: keyof typeof TONE | string` → `tone?: string`
  3. line 66 default `tone = 'terracotta',` → `tone = 'brand',`
  4. line 71 `emptyLabel = 'Sem agendamentos',` → `emptyLabel = 'No activity',`; prop doc line 82-83 `(defaults to "Sem agendamentos")` → `(defaults to "No activity")`
  5. line 119 `aria-label={total > 0 ? \`Mapa de densidade — ${weeks} semanas, ${total} no total\` : 'Sem agendamentos'}` → `aria-label={total > 0 ? \`Density map — ${weeks} weeks, ${total} total\` : 'No activity'}`
  6. line 181 `className="label-mono rounded-full bg-card/70 …"` → `className="label-micro rounded-full bg-card/70 …"` (only the `label-mono` token changes)
  7. JSDoc: line 17-24 examples — `// appointments per day over the last 12 weeks, busy-day terracotta scale` → `// events per day over the last 12 weeks, busy-day brand scale`; `tone="terracotta"` → `tone="brand"`; `weekdayLabels={['D','S','T','Q','Q','S','S']}` → `weekdayLabels={['S','M','T','W','T','F','S']}`; `<Heatmap tone="sage" …>` → `<Heatmap tone="success" …>`
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/GradientBar.tsx /Users/luca/dev/winter-park/template/components/ui/GradientBar.tsx` — edits (**drop `onDark`, neutral pill**):
  1. `TONE_FILL` (lines 17-22) becomes exactly:
```ts
const TONE_FILL = {
  brand:   'from-brand-soft to-brand',
  success: 'from-success-soft to-success',
  warning: 'from-warning-soft to-warning',
  info:    'from-info-soft to-info',
} as const
```
  2. Default (line 30): `tone = 'terracotta',` → `tone = 'brand',`
  3. Remove `onDark = false,` from destructuring (line 31) and the `/** Recolor quiet bars… */ onDark?: boolean` prop (lines 39-40).
  4. lines 45-50 collapse to:
```ts
  const activeFill = cn('bg-gradient-to-t', TONE_FILL[tone])
  const quietFill = 'bg-secondary'
  const labelMuted = 'text-muted-foreground'
  const labelActive = 'text-foreground font-medium'
```
  5. line 62 value pill: `bg-charcoal px-2 py-0.5 text-[11px] font-semibold tabular-nums text-charcoal-foreground shadow-bento` → `bg-foreground px-2 py-0.5 text-[11px] font-semibold tabular-nums text-background shadow-card`
  6. JSDoc lines 3-14: rewrite tone sentences → `Tones: the highlighted bar fills with a soft→solid vertical gradient of its accent slot; quiet bars are \`secondary\`. The value pill rides above the highlighted fill height. Numbers are tabular.` (drop the charcoal/onDark sentences; keep the first descriptive sentence and "Pure CSS, SSR-safe.")
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Rating.tsx /Users/luca/dev/winter-park/template/components/ui/Rating.tsx` — edits (**drop `onDark`, English copy, no local color table**):
  1. DELETE the `TONE` record (lines 19-25); add `import { chartColor } from './chart-tone'` after the `cn` import.
  2. line 57 `const color = TONE[tone] ?? tone` → `const color = chartColor(tone)`; tone prop type (line 51) `tone?: keyof typeof TONE | string` → `tone?: string`
  3. Default (line 36): `tone = 'honey',` → `tone = 'warning',`
  4. Remove `onDark = false,` (line 38) and the `/** Recolor text… */ onDark?: boolean` prop (lines 52-53).
  5. lines 62-64 collapse to: `const figCls = 'text-foreground'`, `const subCls = 'text-muted-foreground'`, `const trackCls = 'text-muted-foreground/30'`
  6. line 67 aria: `\`… ${typeof max === 'number' ? 'de ' + max : ''}\`` → `'of ' + max`
  7. line 72: remove `font-serif` from the fig classes (becomes `'font-semibold leading-none tracking-tight tabular-nums'`)
  8. line 98: `{label != null && <p className={cn('label-mono', onDark && 'text-current opacity-90')}>{label}</p>}` → `{label != null && <p className="label-micro">{label}</p>}`
  9. lines 100-103 count line: `em {count} {countLabel}` → `{count} {countLabel}` (renders e.g. "8 reviews"); prop docs line 46-49: `Review count → renders "em N {countLabel}".` → `Review count → renders "N {countLabel}" (e.g. "8 reviews").`; `Plural noun for the count (e.g. "avaliações")` → `Plural noun for the count (e.g. "reviews")`
  10. JSDoc lines 5-17: `("4,9" + ★★★★★ out of 5) … a 4,9/5 shown as "98%" is misleading` — translate decimals to dots: `("4.9" + ★★★★★ out of 5) … a 4.9/5 shown as "98%" is misleading`; delete `the control-panel composer routes the \`growth.reputation.score\` signal here instead of \`Gauge\`` sentence; example line 17 → `<Rating value={4.9} display="4.9" count={8} countLabel="reviews" />`
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/Heatmap.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Heatmap } from './Heatmap'

const meta: Meta<typeof Heatmap> = {
  component: Heatmap,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof Heatmap>

const weeks = 12
// Flat column-major series: 7 cells per column (one weekday each), `weeks` cols.
const data = Array.from({ length: weeks * 7 }).map((_, i) =>
  Math.max(0, Math.round(Math.sin(i / 4) * 3 + (i % 5))),
)

const ROWS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export const Default: Story = {
  args: { data, weekdayLabels: ROWS, tone: 'brand' },
}

export const Success: Story = {
  args: { data, weekdayLabels: ROWS, tone: 'success' },
}

export const DateKeyed: Story = {
  args: {
    tone: 'info',
    weekdayLabels: ROWS,
    data: Array.from({ length: 30 }).map((_, i) => ({
      date: new Date(2026, 5, i + 1).toISOString(),
      value: Math.max(0, Math.round(Math.cos(i / 3) * 4 + 4)),
    })),
  },
}

export const Empty: Story = {
  args: { data: [], weekdayLabels: ROWS, tone: 'success' },
}
```
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/GradientBar.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { GradientBar } from './GradientBar'

const meta: Meta<typeof GradientBar> = {
  component: GradientBar,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof GradientBar>

const week = [
  { label: 'Mon', value: 320 },
  { label: 'Tue', value: 480 },
  { label: 'Wed', value: 410 },
  { label: 'Thu', value: 690 },
  { label: 'Fri', value: 540 },
  { label: 'Sat', value: 760 },
  { label: 'Sun', value: 210 },
]

export const Default: Story = {
  args: { data: week, activeIndex: 5, valueLabel: '$760' },
}

export const Info: Story = {
  args: { data: week, activeIndex: 3, valueLabel: '$690', tone: 'info' },
}

export const Empty: Story = {
  args: { data: week.map((d) => ({ ...d, value: 0 })), activeIndex: 0 },
}
```
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/AreaTrend.tsx components/ui/Heatmap.tsx components/ui/Heatmap.stories.tsx components/ui/GradientBar.tsx components/ui/GradientBar.stories.tsx components/ui/Rating.tsx && git commit -m "$(cat <<'EOF'
backport(components): chart kit C — AreaTrend, Heatmap, GradientBar, Rating + stories

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.14: StatTile + NavBadge + Tabs + SegmentedControl (+ stories)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/StatTile.tsx`, `NavBadge.tsx`, `NavBadge.stories.tsx`, `Tabs.tsx`, `Tabs.stories.tsx`, `SegmentedControl.tsx`

**Interfaces:**
- Consumes: `Tile`/`TileProps`/`isSolidTone` (8.3), `IconChip` (8.3), `Delta` (8.11), `Sparkline` (8.11), `cn`.
- Produces: `StatTile({ label, value, delta?, deltaInvert?, sub?, icon?, iconTone?, spark?, tone?, size?, className? })`; `type NavBadgeProps = { count: number; tone?: 'overdue'|'pending'|'neutral'; max?: number; className?; 'aria-label'?: string }`, `NavBadge`; `type TabItem<T extends string> = { value: T; label; icon?; count?; ai? }`, `Tabs<T>({ tabs, value?, defaultValue?, onChange?, size?, className? })`; `SegmentedControl<T>({ options, value, onChange, size?, className? })`.

NavBadge is ported here as Tabs' count-pill dependency (irene co-located them; it is fully generic).

- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/NavBadge.tsx /Users/luca/dev/winter-park/template/components/ui/NavBadge.tsx` — edits:
  1. `tones` map (lines 11-15): `overdue: 'bg-destructive-soft text-destructive-deep',` stays; `pending: 'bg-honey-soft text-honey-deep',` → `pending: 'bg-warning-soft text-warning-deep',`; `neutral` stays.
  2. line 30 `aria-label={\`${count} pendentes\`}` → make it a prop: add `'aria-label'?: string` to `NavBadgeProps`, destructure as `'aria-label': ariaLabel`, render `aria-label={ariaLabel}` (no default — the visible count is already accessible text).
  3. JSDoc lines 4-9: `(receivables overdue, pending commissions, today's appointments, pending invites)` → `(overdue items, pending approvals, unread counts)`; delete `02-component-catalog §3.2.` line.
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/SegmentedControl.tsx /Users/luca/dev/winter-park/template/components/ui/SegmentedControl.tsx` — edits: **none** (token-clean, English).
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Tabs.tsx /Users/luca/dev/winter-park/template/components/ui/Tabs.tsx` — edits:
  1. lines 92-98 (count badge): `tone={t.ai ? 'neutral' : 'neutral'}` → `tone="neutral"` (keep the `className={cn(t.ai && 'bg-info-soft text-info-deep')}` override).
  2. JSDoc line 17: delete `02-component-catalog §3.4.`
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/StatTile.tsx /Users/luca/dev/winter-park/template/components/ui/StatTile.tsx` — edits:
  1. line 98 Sparkline fallback color: `onTint ? 'text-current' : 'text-terracotta'` → `onTint ? 'text-current' : 'text-brand'`
  2. line 77 `cn('label-mono break-words leading-snug', onTint && 'text-current opacity-90')` → `cn('label-micro break-words leading-snug', onTint && 'text-current opacity-90')`
  3. Comment translations: line 50-51 `(e.g. "R$ 26.705,06", "-R$ 1.179,50")` → `(e.g. "$26,705.06", "-$1,179.50")`; line 73-74 `"FATURAMENTO BRUTO" or "PROFISSIONAIS" … "FATURAMENTO…"` → `"GROSS REVENUE" or "TEAM MEMBERS" … "GROSS REV…"`; line 88-92 `"26.705,06" … "R$ 26.705,06" breaks to "R$" / "26.705,06" … "R$ 26.7…"` → `"26,705.06" … "$ 26,705.06" breaks to "$" / "26,705.06" … "$26.7…"` (keep the technical explanation intact).
  4. Everything else unchanged (`tone`/`iconTone` unions now come from the ported Tile/IconChip).
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/NavBadge.stories.tsx` (irene story verbatim — tones/args are already generic):

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { NavBadge } from './NavBadge'

const meta: Meta<typeof NavBadge> = {
  component: NavBadge,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof NavBadge>

export const Overdue: Story = { args: { count: 3, tone: 'overdue' } }
export const Pending: Story = { args: { count: 7, tone: 'pending' } }
export const Neutral: Story = { args: { count: 12, tone: 'neutral' } }
export const Clamped: Story = { args: { count: 42, tone: 'overdue', max: 9 } }
/** Renders nothing when count is 0. */
export const Zero: Story = { args: { count: 0, tone: 'pending' } }
```
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/Tabs.stories.tsx` (irene story, English labels):

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Sparkles, Trophy, AlertTriangle } from 'lucide-react'
import { Tabs } from './Tabs'

const meta: Meta<typeof Tabs> = {
  component: Tabs,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof Tabs>

export const Basic: Story = {
  args: {
    defaultValue: 'top',
    tabs: [
      { value: 'top', label: 'Top performers' },
      { value: 'attention', label: 'Needs attention' },
      { value: 'all', label: 'All' },
    ],
  },
}

export const WithCountsAndIcons: Story = {
  args: {
    defaultValue: 'attention',
    tabs: [
      { value: 'top', label: 'Top', icon: <Trophy /> },
      { value: 'attention', label: 'Attention', icon: <AlertTriangle />, count: 4 },
      { value: 'ai', label: 'AI insights', icon: <Sparkles />, count: 2, ai: true },
    ],
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
    defaultValue: 'a',
    tabs: [
      { value: 'a', label: 'Day' },
      { value: 'b', label: 'Week' },
      { value: 'c', label: 'Month' },
    ],
  },
}
```
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/StatTile.tsx components/ui/NavBadge.tsx components/ui/NavBadge.stories.tsx components/ui/Tabs.tsx components/ui/Tabs.stories.tsx components/ui/SegmentedControl.tsx && git commit -m "$(cat <<'EOF'
backport(components): StatTile, NavBadge, Tabs, SegmentedControl + stories

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.15: Avatar + Stepper/Timeline + StatusPill + ModePill (+ stories)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/Avatar.tsx`, `Stepper.tsx`, `Stepper.stories.tsx`, `StatusPill.tsx`, `StatusPill.stories.tsx`, `ModePill.tsx`, `ModePill.stories.tsx`

**Interfaces:**
- Consumes: `cn`, `Badge`/`BadgeProps` (8.3), lucide `Check`.
- Produces: `Avatar({ name: string, src?: string | null, toSrc?: (src: string) => string | null, size?: 'sm'|'md'|'lg', className? })`, `AvatarGroup({ names, srcs?, toSrc?, max?, size?, className? })` — **phase 9 re-points call sites at `toSrc={blobImageSrc}` when the Blob proxy lands**; `type StepStatus`, `type Step`, `Stepper({ steps, orientation?, className? })`, `type TimelineEvent`, `Timeline({ events, className? })` (no `onDark`); `type StatusPillProps`, `StatusPill({ status, label?, size?, dot?, className?, 'aria-label'? })`; `type ModePillProps`, `ModePill({ label, icon?, tone?: 'secondary'|'outline', className? })`.

- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Avatar.tsx /Users/luca/dev/winter-park/template/components/ui/Avatar.tsx` — edits:
  1. DELETE line 2 `import { blobImageSrc } from '@/lib/blob/image-src'`
  2. `TONES` (line 7) → `const TONES = ['bg-success-soft text-success-deep', 'bg-brand-soft text-brand-deep', 'bg-warning-soft text-warning-deep', 'bg-info-soft text-info-deep']` (irene duplicated honey twice; the 4th slot becomes info for an even spread)
  3. `Avatar` signature (line 32): `{ name, src, size = 'md', className }: { name: string; src?: string | null; size?: keyof typeof SIZE; className?: string }` → `{ name, src, toSrc, size = 'md', className }: { name: string; src?: string | null; /** Optional URL mapper (e.g. an authed blob proxy) applied to a non-empty `src`. */ toSrc?: (src: string) => string | null; size?: keyof typeof SIZE; className?: string }`
  4. line 33 `const imgSrc = blobImageSrc(src)` → `const imgSrc = src ? (toSrc ? toSrc(src) : src) : null`
  5. JSDoc lines 26-31: `it's routed through \`blobImageSrc\` (the authed /api/blob-image proxy) for the PRIVATE store` → `pass \`toSrc\` to route it through an authed proxy (e.g. the blob-image proxy once the Blob integration lands)`
  6. `AvatarGroup`: add `toSrc` to the props (`toSrc?: (src: string) => string | null`) and thread it: line 75 `<Avatar key={i} name={n} src={srcs?.[i]} size={size} />` → `<Avatar key={i} name={n} src={srcs?.[i]} toSrc={toSrc} size={size} />`; prop doc line 64 `Optional avatar blob URLs` → `Optional avatar image URLs`
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Stepper.tsx /Users/luca/dev/winter-park/template/components/ui/Stepper.tsx` — edits (**drop `onDark` throughout, retone**):
  1. `markerTone` (lines 27-31): `done: 'bg-sage-soft text-sage-deep ring-1 ring-inset ring-sage-deep/15',` → `done: 'bg-success-soft text-success-deep ring-1 ring-inset ring-success-deep/15',`; `current: 'bg-terracotta text-terracotta-foreground',` → `current: 'bg-brand text-brand-foreground',`; `upcoming` unchanged.
  2. `Marker` (lines 39-52): remove the `onDark` param and the `onDark && step.status === 'upcoming' && 'bg-charcoal-2 text-charcoal-foreground/70'` line — signature becomes `function Marker({ step, index }: { step: Step; index: number })`.
  3. `Stepper` (lines 54-66): remove `onDark = false,` and its prop docs; line 66 `const lineCls = onDark ? 'bg-[hsl(var(--charcoal-line))]' : 'bg-border'` → `const lineCls = 'bg-border'`.
  4. All `onDark` usages in the horizontal + vertical branches (lines 81, 85, 87, 113, 115, 117): `<Marker step={step} index={i} onDark={onDark} />` → `<Marker step={step} index={i} />`; `cn('text-sm', labelTone[step.status], onDark && 'text-current')` → `cn('text-sm', labelTone[step.status])` (and the `leading-tight` variant); `onDark ? 'text-current opacity-70' : 'text-muted-foreground'` → `'text-muted-foreground'`.
  5. `TimelineEvent.tone` union (line 136): `'plain' | 'sage' | 'terracotta' | 'honey' | 'info' | 'destructive'` → `'plain' | 'success' | 'brand' | 'warning' | 'info' | 'destructive'`; `dotTone` map (lines 139-146) keys/classes retoned accordingly (`sage`→`success: 'bg-success-soft text-success-deep'`, `terracotta`→`brand: 'bg-brand-soft text-brand-deep'`, `honey`→`warning: 'bg-warning-soft text-warning-deep'`).
  6. `Timeline` (lines 153-198): remove `onDark` prop + `lineCls` ternary (→ `'bg-border'`) + the `onDark && (ev.tone ?? 'plain') === 'plain' && …charcoal…` line + all `onDark ? … : …` text-color ternaries (keep the non-dark side).
  7. JSDoc lines 5-9: `**done** = sage … **current** = terracotta` → `**done** = success … **current** = brand`; `(the SETO module-timeline DNA) for multi-step create flows (TransactionHub, appointment, receipt)` → `for multi-step create flows`; Timeline JSDoc line 150-151 `(customer visits, service history, receipt lines)` → `(entity history, activity feeds)`.
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/StatusPill.tsx /Users/luca/dev/winter-park/template/components/ui/StatusPill.tsx` — edits:
  1. `STATUS_TONE` (lines 39-54): every `'sage'` → `'success'`; every `'honey'` → `'warning'`; `urgent: 'charcoal',` → `urgent: 'accent',`; `destructive`/`info`/`default` unchanged. (The `Tone` type derives from `BadgeProps['variant']` — the new Badge union from 8.3 covers `success|warning|destructive|accent|info|default`.)
  2. `DOT_CLASS` (lines 57-65): `sage: 'bg-sage-deep',` → `success: 'bg-success-deep',`; `honey: 'bg-honey-deep',` → `warning: 'bg-warning-deep',`; delete `terracotta: 'bg-terracotta-deep',` and add `brand: 'bg-brand-deep',`; `charcoal: 'bg-current',` → `accent: 'bg-current',`; `destructive`/`info`/`default` unchanged.
  3. JSDoc taxonomy block (lines 8-16): `→ sage (positive)` → `→ success (positive)`; `→ honey (warning)` → `→ warning`; `urgent → charcoal (neutral-strong inverse)` → `urgent → accent (neutral-strong inverse)`; `info → info (AI / informativo — never a money status)` → `info → info (AI / informational — never a money status)`; delete `(02-component-catalog §3.1 / §3.2)`.
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/ModePill.tsx /Users/luca/dev/winter-park/template/components/ui/ModePill.tsx` — edits:
  1. JSDoc lines 4-11: `a payment method (Pix/Cartão), a role (Owner/Attendant/Pro), a channel, a recurrence mode ("mensal")` → `a payment method, a role, a channel, a recurrence mode ("monthly")`; delete `02-component-catalog §3.2.` line (keep `Pairs with StatusPill, never used for status itself.`). Code unchanged.
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/Stepper.stories.tsx` (English, OnCharcoal dropped, tones remapped):

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { CreditCard, ShoppingBag, User, ClipboardCheck, Package } from 'lucide-react'
import { Stepper, Timeline, type Step, type TimelineEvent } from './Stepper'

const meta: Meta<typeof Stepper> = {
  component: Stepper,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof Stepper>

const steps: Step[] = [
  { label: 'Customer', status: 'done' },
  { label: 'Items', description: '2 selected', status: 'current' },
  { label: 'Extras', status: 'upcoming' },
  { label: 'Payment', status: 'upcoming' },
  { label: 'Review', status: 'upcoming' },
]

export const Vertical: Story = { args: { steps } }

export const Horizontal: Story = { args: { steps, orientation: 'horizontal' } }

export const WithIcons: Story = {
  args: {
    steps: [
      { label: 'Customer', icon: <User className="size-4" />, status: 'done' },
      { label: 'Items', icon: <Package className="size-4" />, status: 'current' },
      { label: 'Extras', icon: <ShoppingBag className="size-4" />, status: 'upcoming' },
      { label: 'Payment', icon: <CreditCard className="size-4" />, status: 'upcoming' },
      { label: 'Review', icon: <ClipboardCheck className="size-4" />, status: 'upcoming' },
    ],
  },
}

const events: TimelineEvent[] = [
  { when: '14:32', title: 'Receipt issued', meta: '$180.00 · Card', tone: 'success' },
  { when: '13:10', title: 'Session completed', meta: 'Consultation', tone: 'brand' },
  { when: 'yesterday', title: 'Booking created', meta: 'by Ana', tone: 'info' },
  { when: 'Jun 12', title: 'Customer registered', tone: 'plain' },
]

export const TimelineDefault: StoryObj<typeof Timeline> = {
  render: (args) => <Timeline {...args} />,
  args: { events },
}
```
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/StatusPill.stories.tsx` (English labels):

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { StatusPill } from './StatusPill'

const meta: Meta<typeof StatusPill> = {
  component: StatusPill,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof StatusPill>

export const Paid: Story = { args: { status: 'paid' } }
export const Pending: Story = { args: { status: 'pending' } }
export const Overdue: Story = { args: { status: 'overdue' } }
export const Urgent: Story = { args: { status: 'urgent', label: 'URGENT' } }
export const Info: Story = { args: { status: 'info', label: 'AI' } }
export const Small: Story = { args: { status: 'active', size: 'sm' } }

export const Taxonomy: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill status="paid" />
      <StatusPill status="pending" />
      <StatusPill status="partial" />
      <StatusPill status="overdue" />
      <StatusPill status="cancelled" />
      <StatusPill status="active" />
      <StatusPill status="urgent" label="URGENT" />
      <StatusPill status="info" label="Informational" />
      <StatusPill status="default" label="Neutral" />
    </div>
  ),
}
```
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/ModePill.stories.tsx` (English labels):

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { CreditCard, RefreshCw } from 'lucide-react'
import { ModePill } from './ModePill'

const meta: Meta<typeof ModePill> = {
  component: ModePill,
  parameters: { nextjs: { appDirectory: true } },
}
export default meta
type Story = StoryObj<typeof ModePill>

export const Secondary: Story = { args: { label: 'Card' } }
export const Outline: Story = { args: { label: 'Transfer', tone: 'outline', icon: <CreditCard /> } }
export const Recurrence: Story = { args: { label: 'monthly', icon: <RefreshCw /> } }

export const Pair: Story = {
  render: () => (
    <div className="flex items-center gap-1.5">
      <ModePill label="Card" icon={<CreditCard />} />
      <ModePill label="monthly" tone="outline" icon={<RefreshCw />} />
    </div>
  ),
}
```
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/Avatar.tsx components/ui/Stepper.tsx components/ui/Stepper.stories.tsx components/ui/StatusPill.tsx components/ui/StatusPill.stories.tsx components/ui/ModePill.tsx components/ui/ModePill.stories.tsx && git commit -m "$(cat <<'EOF'
backport(components): Avatar (toSrc), Stepper/Timeline, StatusPill, ModePill + stories

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.16: Kanban (+ story)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/Kanban.tsx`, `Kanban.stories.tsx`

**Interfaces:**
- Consumes: `Avatar` (8.15), `Badge` (8.3), `IconChip` (8.3), `cva`, `cn`.
- Produces: `KanbanBoard(props: React.HTMLAttributes<HTMLDivElement>)`; `KanbanColumn({ title, count?, tone?: 'plain'|'accent', emptyLabel?, className?, children? })`; `KanbanCard({ id?, title, meta?, dotTone?: 'success'|'brand'|'warning'|'destructive'|'info'|'accent', avatarName?, avatarSrc?, lead?, urgent?, urgentLabel?, className?, ...div })`; re-export `IconChip`.

- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/Kanban.tsx /Users/luca/dev/winter-park/template/components/ui/Kanban.tsx` — edits:
  1. `columnHeaderVariants` tone map (lines 46-52): `charcoal: 'bg-charcoal text-charcoal-foreground',` → `accent: 'bg-accent text-accent-foreground',`; comment line 41 `\`charcoal\` is the dark anchor` → `\`accent\` is the solid anchor`.
  2. line 61/69 `emptyLabel = 'Nada aqui'` → `emptyLabel = 'Nothing here'`
  3. line 82 `<span className="label-mono truncate">{title}</span>` → `<span className="label-micro truncate">{title}</span>`
  4. line 86 count-chip ternary: `tone === 'charcoal' ? 'bg-card/15 text-current' : 'bg-card text-foreground'` → `tone === 'accent' ? 'bg-card/15 text-current' : 'bg-card text-foreground'`
  5. `dotTones` (lines 107-114) becomes exactly:
```ts
const dotTones = {
  success:     'bg-success',
  brand:       'bg-brand',
  warning:     'bg-warning',
  destructive: 'bg-destructive',
  info:        'bg-info',
  accent:      'bg-accent',
} as const
```
  6. line 125/143 `urgentLabel = 'URGENTE'` → `urgentLabel = 'Urgent'`
  7. line 149 `shadow-bento` → `shadow-card`; line 150 `hover:shadow-bento-lg` → `hover:shadow-card-lg`
  8. `Badge variant="charcoal"` (line 169) → `Badge variant="accent"`
  9. JSDoc lines 8-16: `a presentational kanban for the appointment lifecycle + attendant approvals queue` → `a presentational kanban for any status pipeline`; `the URGENTE flag is a charcoal-inverse badge per the status taxonomy (01 §3.4 / 02 §3.2)` → `the urgent flag is an accent-inverse badge per the status taxonomy`.
  10. Prop docs: line 129 `(e.g. order/appt number)` → `(e.g. an order number)`; line 138 `Optional avatar blob URL` → `Optional avatar image URL`.
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/Kanban.stories.tsx` (English, retoned):

```tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Wrench } from 'lucide-react'
import { KanbanBoard, KanbanColumn, KanbanCard, IconChip } from './Kanban'

const meta: Meta<typeof KanbanBoard> = {
  component: KanbanBoard,
  parameters: { layout: 'padded' },
}
export default meta
type Story = StoryObj<typeof KanbanBoard>

export const Pipeline: Story = {
  render: () => (
    <KanbanBoard>
      <KanbanColumn title="Requested" tone="accent" count={2}>
        <KanbanCard
          id="#1042"
          title="Onboarding call"
          meta="Today 14:30 · Ana"
          dotTone="brand"
          avatarName="Marina Souza"
          urgent
        />
        <KanbanCard
          id="#1043"
          title="Contract review"
          meta="Today 16:00 · Bruno"
          dotTone="warning"
          avatarName="Carla Dias"
        />
      </KanbanColumn>

      <KanbanColumn title="In progress" count={1}>
        <KanbanCard
          id="#1039"
          title="Account setup"
          meta="In progress · Julia"
          dotTone="info"
          lead={
            <IconChip tone="brand" size="sm">
              <Wrench />
            </IconChip>
          }
        />
      </KanbanColumn>

      <KanbanColumn title="Done" count={0} emptyLabel="Nothing done yet" />
    </KanbanBoard>
  ),
}

export const SingleCard: Story = {
  render: () => (
    <div className="max-w-xs">
      <KanbanCard
        id="#1042"
        title="Onboarding call"
        meta="Today 14:30 · Ana"
        dotTone="success"
        avatarName="Marina Souza"
      />
    </div>
  ),
}
```
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/Kanban.tsx components/ui/Kanban.stories.tsx && git commit -m "$(cat <<'EOF'
backport(components): Kanban board/column/card with emptyLabel prop + story

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.17: MoneyInput cents-mask core (TDD)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/useMoneyInput.ts`, `useMoneyInput.test.ts`, `MoneyInput.tsx`

**Interfaces:**
- Consumes: `inputChrome` (8.2), `cn`; vitest (phase 1).
- Produces: `DEFAULT_MAX_MONEY = 99_999_999.99`; `centsToRaw(cents: number): string`; `digitsToCents(digits: string): number | null`; `formatCentsDisplay(cents: number, locale: string): string`; `seedCents(initial: number | string | undefined, maxCents: number): number | null`; `useMoneyInput(initial: number | string | undefined, locale: string, maxCents: number): { display, raw, onChange, onFocus, onKeyDown, inputRef }`; `MoneyInput({ name, id?, defaultValue?, required?, disabled?, placeholder?, className?, currency?, locale?, max?, onValueChange? })` — submits a clean `Number()`-parseable string through a hidden input.

This is a port with MODIFIED logic (irene's `Locale`-typed i18n helpers + salon CurrencyProvider are replaced by an Intl-native locale-string core), so the pure helpers get a real test, written FIRST.

- [ ] Write the failing test `/Users/luca/dev/winter-park/template/components/ui/useMoneyInput.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { centsToRaw, digitsToCents, formatCentsDisplay, seedCents, DEFAULT_MAX_MONEY } from './useMoneyInput'

const MAX_CENTS = Math.round(DEFAULT_MAX_MONEY * 100)

describe('centsToRaw', () => {
  it('renders integer cents as a Number()-parseable string', () => {
    expect(centsToRaw(123)).toBe('1.23')
    expect(centsToRaw(0)).toBe('0.00')
    expect(centsToRaw(5)).toBe('0.05')
    expect(centsToRaw(1_000_000)).toBe('10000.00')
  })
})

describe('digitsToCents', () => {
  it('parses a digit buffer to cents', () => {
    expect(digitsToCents('123')).toBe(123)
    expect(digitsToCents('007')).toBe(7)
  })
  it('returns null for an empty buffer', () => {
    expect(digitsToCents('')).toBeNull()
  })
})

describe('formatCentsDisplay', () => {
  it('formats with two fraction digits per locale', () => {
    expect(formatCentsDisplay(123456, 'en')).toBe('1,234.56')
    expect(formatCentsDisplay(123456, 'pt-BR')).toBe('1.234,56')
    expect(formatCentsDisplay(0, 'en')).toBe('0.00')
  })
})

describe('seedCents', () => {
  it('seeds from a number or numeric string, rounding to cents', () => {
    expect(seedCents(12.345, MAX_CENTS)).toBe(1235)
    expect(seedCents('12.34', MAX_CENTS)).toBe(1234)
  })
  it('clamps to the cap and rejects blanks/garbage', () => {
    expect(seedCents(DEFAULT_MAX_MONEY + 1, MAX_CENTS)).toBe(MAX_CENTS)
    expect(seedCents('', MAX_CENTS)).toBeNull()
    expect(seedCents(undefined, MAX_CENTS)).toBeNull()
    expect(seedCents('abc', MAX_CENTS)).toBeNull()
  })
})
```
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx vitest run components/ui/useMoneyInput.test.ts` → expected: **FAIL** (module `./useMoneyInput` does not exist yet).
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/useMoneyInput.ts` (irene's hook with the i18n imports replaced by exported Intl-native helpers and the cap made configurable):

```ts
'use client'

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * Default upper bound for a single money field — mirrors a `numeric(10,2)`
 * money column (max 99 999 999.99). Without a cap, a pasted larger value would
 * pass client validation and only fail at the DB — a silent no-op submit.
 * Configurable per-field via MoneyInput's `max` prop.
 */
export const DEFAULT_MAX_MONEY = 99_999_999.99

/** Integer cents → a clean `Number()`-parseable string (e.g. 123 → "1.23"). */
export function centsToRaw(cents: number): string {
  const whole = Math.floor(cents / 100)
  const frac = String(cents % 100).padStart(2, '0')
  return `${whole}.${frac}`
}

/** Digit-only input buffer → integer cents, or null for an empty buffer. */
export function digitsToCents(digits: string): number | null {
  if (digits === '') return null
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? n : null
}

/** Locale-formatted display (grouped decimal, two fraction digits, no symbol). */
export function formatCentsDisplay(cents: number, locale: string): string {
  return (cents / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Seed value (number or `Number()`-parseable string) → integer cents clamped
 *  to `maxCents`, or null if blank/invalid. */
export function seedCents(initial: number | string | undefined, maxCents: number): number | null {
  const n =
    typeof initial === 'number'
      ? initial
      : typeof initial === 'string' && initial.trim() !== ''
        ? Number(initial)
        : null
  if (n == null || !Number.isFinite(n)) return null
  return Math.min(Math.round(n * 100), maxCents)
}

/**
 * State for {@link MoneyInput}: a calculator-style currency mask that formats
 * LIVE on every keystroke. The field holds an integer number of cents; digits
 * fill in from the RIGHT, so on an empty field typing `1`,`2`,`3` reads
 * `0.01` → `0.12` → `1.23`, and Backspace peels the rightmost digit off.
 *
 * It exposes:
 *  - `display` — the locale-formatted masked string shown in the input
 *    (resting state is the locale's "0.00", never blank),
 *  - `raw` — the clean numeric string the form submits via a hidden input
 *    (`''` while untouched so required/empty validation still works),
 *  - `onChange` — recomputes cents from the input's digits and returns `raw`,
 *  - `inputRef` — attached to the `<input>` so the caret stays pinned to the
 *    end after each reformat (calculator behaviour).
 */
export function useMoneyInput(
  initial: number | string | undefined,
  locale: string,
  maxCents: number,
) {
  const [cents, setCents] = useState<number | null>(() => seedCents(initial, maxCents))
  const inputRef = useRef<HTMLInputElement>(null)

  function pinCaretToEnd() {
    const el = inputRef.current
    if (el && document.activeElement === el) {
      const end = el.value.length
      el.setSelectionRange(end, end)
    }
  }

  // Pin the caret to the end after each live reformat. Every keystroke rebuilds
  // the whole masked string, so without this React's controlled-value caret
  // restoration can land mid-string; a calculator always types at the right.
  useEffect(pinCaretToEnd, [cents])

  // ...and on focus, so the caret rests at the right when the field is entered.
  function onFocus() {
    pinCaretToEnd()
  }

  // The real guarantee that digits fill from the RIGHT: before each keystroke,
  // collapse a single caret to the end so the key inserts/deletes there — no
  // matter where a click placed it (the field is text-right aligned, so an
  // empty-area click lands the caret at index 0). A RANGE selection is left
  // alone, so "select-all then type" still replaces the whole value.
  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    const el = e.currentTarget
    if (el.selectionStart === el.selectionEnd) {
      const end = el.value.length
      if (el.selectionStart !== end) el.setSelectionRange(end, end)
    }
  }

  const display = formatCentsDisplay(cents ?? 0, locale)
  const raw = cents == null ? '' : centsToRaw(cents)

  function onChange(value: string): string {
    // Strip everything but digits → the integer cents the user has entered.
    // The grouping/decimal separators in `display` are structural, so reading
    // the digits back gives a stable buffer regardless of where the caret is.
    const next = digitsToCents(value.replace(/\D/g, ''))
    if (next == null) {
      setCents(null)
      return ''
    }
    // Reject any keystroke/paste that pushes the value past the cap —
    // keep the prior valid value so the field can't silently overflow.
    if (next > maxCents) return cents == null ? '' : centsToRaw(cents)
    setCents(next)
    return centsToRaw(next)
  }

  return { display, raw, onChange, onFocus, onKeyDown, inputRef }
}
```
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx vitest run components/ui/useMoneyInput.test.ts` → expected: **PASS** (4 describe blocks, all green).
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/MoneyInput.tsx` (irene's component with CurrencyProvider/useLocale/i18n-format replaced by `currency`/`locale`/`max` props):

```tsx
'use client'

import { cn } from '@/lib/utils'
import { inputChrome } from './Input'
import { useMoneyInput, DEFAULT_MAX_MONEY } from './useMoneyInput'

/** The currency symbol alone (e.g. "$", "R$", "€") for a locale+currency —
 *  shown as a static adornment separate from the editable number. Falls back
 *  to the currency code. */
function currencySymbolFor(locale: string, currency: string): string {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? currency
}

type Props = {
  /** Form field name — submitted as a clean numeric string (e.g. "1234.56"). */
  name: string
  id?: string
  /** Seed value (number or `Number()`-parseable string). */
  defaultValue?: number | string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  /** ISO 4217 currency for the symbol adornment. Default "USD". */
  currency?: string
  /** BCP-47 locale for the mask's grouping/decimal separators. Defaults to the
   *  runtime locale — pass the app locale for SSR-stable output. */
  locale?: string
  /** Upper bound for the field's value (default 99 999 999.99 — a
   *  `numeric(10,2)` column). Input that would exceed it is rejected. */
  max?: number
  /** Notified with the clean numeric string on every change (e.g. to clear errors). */
  onValueChange?: (raw: string) => void
}

/**
 * Currency money input. Shows the currency symbol as a static prefix adornment
 * and formats LIVE on every keystroke, calculator-style: digits fill in from
 * the right (empty → "0.00", type 1·2·3 → 0.01·0.12·1.23, Backspace peels the
 * rightmost digit). Submits a clean `Number()`-parseable value through a hidden
 * input named `name`. Drop-in for a raw `<Input type="number" name=… />`.
 */
export function MoneyInput({
  name,
  id,
  defaultValue,
  required,
  disabled,
  placeholder,
  className,
  currency = 'USD',
  locale,
  max = DEFAULT_MAX_MONEY,
  onValueChange,
}: Props) {
  const resolvedLocale = locale ?? new Intl.NumberFormat().resolvedOptions().locale
  const symbol = currencySymbolFor(resolvedLocale, currency)
  const money = useMoneyInput(defaultValue, resolvedLocale, Math.round(max * 100))

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm text-muted-foreground tabular-nums"
        aria-hidden
      >
        {symbol}
      </span>
      <input
        ref={money.inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={money.display}
        onFocus={money.onFocus}
        onKeyDown={money.onKeyDown}
        onChange={(e) => {
          const raw = money.onChange(e.target.value)
          onValueChange?.(raw)
        }}
        className={cn(inputChrome, 'pl-10 text-right tabular-nums', className)}
      />
      {/* The value the form submits — always a clean numeric string. */}
      <input type="hidden" name={name} value={money.raw} />
    </div>
  )
}
```
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit && npx vitest run components/ui/useMoneyInput.test.ts` → expected: both exit 0.
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add components/ui/MoneyInput.tsx components/ui/useMoneyInput.ts components/ui/useMoneyInput.test.ts && git commit -m "$(cat <<'EOF'
backport(components): MoneyInput cents-mask core with Intl locale + configurable max (TDD)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.18: PhoneInput

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/PhoneInput.tsx`, `usePhoneInput.ts`
- Modify: `/Users/luca/dev/winter-park/template/package.json` (via npm install)

**Interfaces:**
- Consumes: `inputChrome` (8.2), `cn`; new dep `libphonenumber-js@^1.13.7`.
- Produces: `type CountryOption = { code: CountryCode; name: string; calling: string }`; `countryFlag(cc: string): string`; `usePhoneInput(initial: string | undefined, defaultCountry: CountryCode, locale: string)`; `PhoneInput({ name, id?, defaultValue?, defaultCountry, required?, disabled?, placeholder?, className?, locale?, onValueChange? })` — `defaultCountry: CountryCode` is **required** (no `'BR'` default, per pinned constraint); submits E.164 through a hidden input.

- [ ] Install dep: `cd /Users/luca/dev/winter-park/template && npm install libphonenumber-js@^1.13.7` → expected: exit 0.
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/usePhoneInput.ts /Users/luca/dev/winter-park/template/components/ui/usePhoneInput.ts` — edits:
  1. DELETE line 11 `import type { Locale } from '@/lib/i18n/types'`
  2. `usePhoneInput` signature (lines 27-31): `locale: Locale,` → `locale: string,` (everything else — `Intl.DisplayNames([locale], …)`, `localeCompare(…, locale)` — already accepts plain strings).
- [ ] Copy: `cp /Users/luca/dev/winter-park/irene/components/ui/PhoneInput.tsx /Users/luca/dev/winter-park/template/components/ui/PhoneInput.tsx` — edits:
  1. DELETE line 5 `import { useLocale } from '@/lib/i18n/LocaleProvider'`
  2. Props (lines 9-21): `/** Default country when the value can't be parsed (salon locale → e.g. "BR"). */\n  defaultCountry?: CountryCode` → `/** Default country when the value can't be parsed. Required — the app decides its market, the template does not. */\n  defaultCountry: CountryCode`; ADD after `className?: string`: `/** BCP-47 locale for country display names. Defaults to the runtime locale. */\n  locale?: string`
  3. Destructuring (lines 28-38): `defaultCountry = 'BR',` → `defaultCountry,`; add `locale,` after `className,`
  4. line 39 `const locale = useLocale()` → `const resolvedLocale = locale ?? new Intl.NumberFormat().resolvedOptions().locale`
  5. line 40 `usePhoneInput(defaultValue, defaultCountry, locale)` → `usePhoneInput(defaultValue, defaultCountry, resolvedLocale)`
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add package.json package-lock.json components/ui/PhoneInput.tsx components/ui/usePhoneInput.ts && git commit -m "$(cat <<'EOF'
backport(components): PhoneInput on libphonenumber-js with required defaultCountry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.19: WidgetRefresh + useWidgetRefresh + refreshTags action

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/cache/refreshable.ts`, `/Users/luca/dev/winter-park/template/lib/cache/refresh-tags.ts`, `/Users/luca/dev/winter-park/template/components/ui/useWidgetRefresh.ts`, `/Users/luca/dev/winter-park/template/components/ui/WidgetRefresh.tsx`
- Modify: `/Users/luca/dev/winter-park/template/docs/caching.md` (add the widget-refresh section)

**Interfaces:**
- Consumes: `getSession` (`@/lib/auth/session`, template-existing), `useToast` (8.4), `cn`, lucide `RotateCw`; per-section `createTagRegistry` instances (`@/lib/cache-registry` pattern).
- Produces: `REFRESHABLE` (empty app-growable registry, `satisfies Record<string, () => void>`); `type RefreshTagName = keyof typeof REFRESHABLE` — **the app tag union**; `refreshTags(tags: RefreshTagName[]): Promise<{ ok: boolean }>` (server action); `type WidgetRefreshSource = { tags: RefreshTagName[] } | { onRefresh: () => Promise<void> }`; `useWidgetRefresh(source: WidgetRefreshSource, errorMessage: string): { pending: boolean; refresh: () => void }`; `WidgetRefresh({ source, label?, errorMessage?, className? })`.

The template has NO central Tag registry (each section instantiates `createTagRegistry` in its own `tags.ts` — see `docs/caching.md`), so irene's `lib/salon/tags.ts`-backed `refreshSalonTags(salonId, tags)` generalizes to a name→invalidate-thunk registry seeded EMPTY (the same empty-registry pattern as `lib/features/registry.ts` and `lib/effect/markers.ts`): apps register each refreshable widget's tags once, and `RefreshTagName` — the app tag union — parameterizes the action. Auth is session-gated here; tighten to `requireWorkspaceRole` per entry when tenancy (phase 6) tags are workspace-scoped.

- [ ] Write `/Users/luca/dev/winter-park/template/lib/cache/refreshable.ts`:

```ts
/**
 * REFRESHABLE — the app's refreshable-widget tag union (empty-registry pattern,
 * like FEATURE_REGISTRY). Each entry maps a stable widget-facing name to a thunk
 * that invalidates that widget's cache tags THROUGH ITS OWN section registry
 * (docs/caching.md) — `invalidate` uses `updateTag`, so the thunks only run
 * inside the `refreshTags` server action.
 *
 * Register an entry when a server-cached widget gains a <WidgetRefresh> button:
 *
 *   import { Tag, invalidate } from '@/app/dashboard/Bookings/tags'
 *
 *   export const REFRESHABLE = {
 *     bookings: () => invalidate(Tag.bookings({})),
 *   } satisfies Record<string, () => void>
 *
 * Client-loader widgets (Type 6) don't register here — they refresh via the
 * `{ onRefresh }` source mode instead.
 */
export const REFRESHABLE = {} satisfies Record<string, () => void>

/** The app tag union — widget names that `refreshTags` accepts. */
export type RefreshTagName = keyof typeof REFRESHABLE
```
- [ ] Write `/Users/luca/dev/winter-park/template/lib/cache/refresh-tags.ts`:

```ts
'use server'

import { getSession } from '@/lib/auth/session'
import { REFRESHABLE, type RefreshTagName } from './refreshable'

/**
 * User-triggered cache refresh for dashboard widgets.
 *
 * A widget's <WidgetRefresh> hands over the REFRESHABLE names its `'use cache'`
 * query is registered under; this invalidates them (`updateTag` —
 * read-your-own-writes) so the client's subsequent `router.refresh()` re-renders
 * the widget against FRESH data (a bare `router.refresh()` alone would serve the
 * cached snapshot).
 *
 * Session-gated. Unknown names are ignored defensively (the typed
 * `RefreshTagName` union already constrains callers). Passing `[]` is a valid
 * no-op. When a registered widget is workspace-scoped, tighten its entry's
 * auth by checking membership here (requireWorkspaceRole, phase 6+).
 */
export async function refreshTags(tags: RefreshTagName[]): Promise<{ ok: boolean }> {
  const session = await getSession()
  if (!session) return { ok: false }
  const registry: Record<string, (() => void) | undefined> = REFRESHABLE
  for (const name of tags) registry[name]?.()
  return { ok: true }
}
```
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/useWidgetRefresh.ts` (irene's hook with `refreshSalonTags(salonId, tags)` → `refreshTags(tags)`):

```ts
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from './Toast'
import { refreshTags } from '@/lib/cache/refresh-tags'
import type { RefreshTagName } from '@/lib/cache/refreshable'

/**
 * Where a widget's Refresh button gets its freshness from — one of two modes:
 *   - `{ tags }` — a SERVER cached widget. Invalidate its REFRESHABLE entries,
 *     then `router.refresh()` so the `'use cache'` query re-runs fresh.
 *   - `{ onRefresh }` — a CLIENT-loader widget (the Type-6 pattern). Re-call the
 *     loader; no server action, no `router.refresh()`.
 */
export type WidgetRefreshSource =
  | { tags: RefreshTagName[] }
  | { onRefresh: () => Promise<void> }

/**
 * Drives a widget Refresh button. Hook-only file (Flow invariant) — the
 * `<WidgetRefresh>` component is a pure consumer. Uses an async `useTransition`
 * so `pending` stays true through BOTH the action/loader AND the resulting
 * re-render (the spinner holds until fresh data lands). Toasts on failure.
 */
export function useWidgetRefresh(source: WidgetRefreshSource, errorMessage: string) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  function refresh() {
    if (pending) return
    startTransition(async () => {
      try {
        if ('onRefresh' in source) {
          await source.onRefresh()
        } else {
          const res = await refreshTags(source.tags)
          if (!res.ok) throw new Error('refresh failed')
          router.refresh()
        }
      } catch {
        toast({ message: errorMessage, tone: 'destructive' })
      }
    })
  }

  return { pending, refresh }
}
```
- [ ] Write `/Users/luca/dev/winter-park/template/components/ui/WidgetRefresh.tsx` (irene's component with the `COPY`/`useLocale` self-localization replaced by English-default props):

```tsx
'use client'

import { RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWidgetRefresh, type WidgetRefreshSource } from './useWidgetRefresh'

/**
 * Refresh icon-button for a widget's top-right actions bar. Spins + disables
 * while refreshing; toasts on failure. The freshness logic (cache-tag invalidate
 * + `router.refresh()`, or a client-loader re-fetch) lives in {@link useWidgetRefresh}.
 * Generic primitive — a widget passes only its `source` (copy is overridable
 * via props for i18n).
 */
export function WidgetRefresh({
  source,
  label = 'Refresh',
  errorMessage = 'Couldn’t refresh.',
  className,
}: {
  source: WidgetRefreshSource
  /** Accessible name + tooltip for the button. */
  label?: string
  /** Toast message when the refresh fails. */
  errorMessage?: string
  className?: string
}) {
  const { pending, refresh } = useWidgetRefresh(source, errorMessage)
  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      aria-label={label}
      aria-busy={pending}
      title={label}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <RotateCw aria-hidden="true" className={cn('size-4', pending && 'animate-spin')} />
    </button>
  )
}
```
- [ ] Modify `/Users/luca/dev/winter-park/template/docs/caching.md`: append this section at the end of the file:

```markdown
## Widget refresh (user-triggered freshness)

A dashboard widget can expose a `<WidgetRefresh source={…} />` button
(`components/ui/WidgetRefresh.tsx`). Two source modes:

- **Server-cached widget** — `source={{ tags: ['bookings'] }}`. Register the
  widget once in `lib/cache/refreshable.ts` (name → a thunk that calls the
  section registry's `invalidate(Tag.…)`). The `refreshTags` server action
  (`lib/cache/refresh-tags.ts`) is session-gated, invalidates the entries
  (`updateTag`), and the hook follows with `router.refresh()` so the
  `'use cache'` query re-runs fresh.
- **Client-loader widget (Type 6)** — `source={{ onRefresh: () => reload() }}`.
  Re-calls the loader; no server action involved.

`REFRESHABLE` ships empty (empty-registry pattern): `RefreshTagName` is the
app's tag union, so `refreshTags` only accepts names the app registered.
Never call `updateTag`/`revalidateTag` from the widget itself — the registry
invariant above still holds.
```
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add lib/cache/refreshable.ts lib/cache/refresh-tags.ts components/ui/useWidgetRefresh.ts components/ui/WidgetRefresh.tsx docs/caching.md && git commit -m "$(cat <<'EOF'
backport(components): WidgetRefresh + refreshTags action on an app-growable tag union

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.20: Docs sweep + full phase verification

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/docs/forms.md` (add "Form input primitives" section)

**Interfaces:** none new — verification gate for the whole phase.

- [ ] Modify `/Users/luca/dev/winter-park/template/docs/forms.md`: append this section at the end:

```markdown
## Form input primitives

All text-like controls share the exported `inputChrome` string
(`components/ui/Input.tsx`) so the whole form kit has one surface. The kit:
`Field` (label + hint + error wiring), `Input`, `Select`, `Textarea`,
`Checkbox`/`Radio`, `Switch`.

Three inputs keep the plain-`<input>` FORM CONTRACT through a hidden input, so
`formData.get(name)` never changes shape:

| Primitive | Hidden-input value | Notes |
|---|---|---|
| `DatePicker` | `YYYY-MM-DD` (same as native `<input type="date">`) | `locale` prop (BCP-47) drives the trigger label; defaults to the runtime locale — pass the app locale for SSR-stable output |
| `MoneyInput` | clean numeric string, e.g. `"1234.56"` | calculator-style cents mask; `currency`, `locale`, `max` props |
| `PhoneInput` | E.164, e.g. `"+15551234567"` | `defaultCountry` is required — the app decides its market |

All defaults are English; every user-facing string is overridable via props.
```
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx eslint components/ui lib/cache --max-warnings=0` → expected: exit 0 (fix any lint issue in the ported files before committing; the `@next/next/no-img-element` disable comment in Avatar.tsx is expected and already inline).
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx vitest run` → expected: exit 0 (includes `useMoneyInput.test.ts` plus earlier phases' tests).
- [ ] Run: `cd /Users/luca/dev/winter-park/template && npm run build-storybook` → expected: exit 0 — all 11 ported stories (SearchCommand, MultiBar, Gauge, Heatmap, GradientBar, NavBadge, Tabs, Stepper, StatusPill, ModePill, Kanban) plus the pre-existing template stories build. If a story fails on a server-only import, the `.storybook/main.ts` `actions.ts` mock does not apply to `refresh-tags.ts` — no story imports it, so investigate the actual import chain rather than adding mocks.
- [ ] Sweep (two greps — `sage` needs word-matching or it false-positives on `message`/`usage`):
  1. `grep -rn "terracotta\|honey\|charcoal\|plum\|lavender\|shadow-bento\|salonId\|irene\.\|label-mono\|display-serif\|kicker-mono" /Users/luca/dev/winter-park/template/components/ui /Users/luca/dev/winter-park/template/lib/cache` → expected: **no matches**
  2. `grep -rnw "sage" /Users/luca/dev/winter-park/template/components/ui /Users/luca/dev/winter-park/template/lib/cache` → expected: **no matches** (`-w` matches `bg-sage-soft`'s `sage` token but not `message`)
  (Together these prove the de-irene sweep is complete.)
- [ ] Commit:
```bash
cd /Users/luca/dev/winter-park/template && git add docs/forms.md && git commit -m "$(cat <<'EOF'
backport(components): document form-input primitives + hidden-input contracts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```
