# Phase 7: lib Primitives + Shell Upgrades — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Port irene's dependency-free lib primitives (useScrollLock, zoned time, CSV export, list normalize, flow-params navigation state) and the Drawer/Modal/ErrorBoundary shell upgrades into the template with neutral tokens, English copy, unit tests, and the links/flow-params/pages/shells docs.

**Depends on phases:** 2 (design tokens; transitively 1 for vitest + deps)

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE source repo: `/Users/luca/dev/winter-park/irene` (read-only reference). All `cp` commands copy irene → template; never edit irene.
- Copy: English defaults everywhere. All user-facing copy overridable via props (`closeLabel` defaults `'Close'`, `contextualLabel` defaults `'Back to where you came from'`). No hardcoded pt-BR anywhere (`'Fechar'`, `dd/MM/yyyy`-as-only-format, `m.common.*` lookups all die here).
- Tenant concept: "workspace" everywhere irene says salon — including doc comments.
- Identifiers: timezone cookie is `app.tz` (never `irene.tz`); dev port 3000.
- Design tokens (produced by Phase 2, consumed here): triad utilities `bg-destructive-soft` / `text-destructive-deep` / `text-brand`; `shadow-bento` NEVER appears (irene theme) — shells keep template's existing `shadow-xl` / `shadow-lg`; neutral tokens `bg-background`, `bg-black/50`, `text-muted-foreground`, `text-foreground`, `bg-muted`, `border-border` are retained by Phase 2 and used here. `rounded-full` pills are irene aesthetic — use template `rounded-md` / `rounded-lg`.
- Tests: vitest configured in Phase 1 (`.test.ts` = vitest, `@/` alias resolves). Run with `npx vitest run <path>`.
- Verification gate per task: at minimum `npx tsc --noEmit` → exit 0; `npx vitest run` for tested code; `npm run build-storybook` for story changes.
- Every task ends with a git commit; message trailer (as a second `-m` flag): `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Docs travel with code: shells.md updates land in the same commits as the shell code; links.md / flow-params.md / pages.md land with the nav primitives (Task 7.9 immediately follows 7.7/7.8).
- Template file conventions (READ and confirmed): lib root is flat kebab-case (`lib/rate-limit.ts`, `lib/route-registry.ts`) → irene's `flowParams.ts` lands as `lib/flow-params.ts`; hooks in `lib/hooks/`; UI atoms in `components/ui/` (PascalCase files: `Button.tsx`) → link primitives land there; lib-internal imports are relative (`'../utils'`), cross-layer imports use `@/`.

---

### Task 7.1: Port `useScrollLock` (verbatim)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/hooks/useScrollLock.ts`

**Interfaces:**
- Consumes: nothing (dependency-free, React only).
- Produces: `useScrollLock(active: boolean): void` — module-level ref-counted body scroll lock. Consumed by Task 7.2 and by Phase 8 (SearchCommand palette).

Steps:

- [ ] Step: copy source — `cp /Users/luca/dev/winter-park/irene/lib/hooks/useScrollLock.ts /Users/luca/dev/winter-park/template/lib/hooks/useScrollLock.ts`
- [ ] Step: apply generalization edits — NONE required. Confirm with: `grep -in "salon\|irene" /Users/luca/dev/winter-park/template/lib/hooks/useScrollLock.ts` → expected: no output (the file's comments mention only generic "modal / drawer / lightbox / command palette").
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0, no output.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add lib/hooks/useScrollLock.ts
  git commit -m "backport(lib): add ref-counted useScrollLock hook from irene" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 7.2: Drawer + Modal structural upgrades (+ stories, + shells.md Modal/Drawer sections)

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/lib/shell/drawer.tsx` (entire file, currently 21 lines — full rewrite below)
- Modify: `/Users/luca/dev/winter-park/template/lib/shell/modal.tsx` (entire file, currently 23 lines — full rewrite below)
- Modify: `/Users/luca/dev/winter-park/template/lib/shell.stories.tsx` (append 3 stories after line 37)
- Modify: `/Users/luca/dev/winter-park/template/docs/shells.md` (Modal section lines 149–175, Drawer section lines 177–201, intro bullets lines 9–14)

**Interfaces:**
- Consumes: `useScrollLock(active: boolean): void` from Task 7.1; `ShellBase`, `ShellProps` from `lib/shell/shell-base.tsx` (unchanged signature); `cn` from `lib/utils.ts`; `X` icon from `lucide-react` (already a template dep).
- Produces:
  - `Drawer(props: ShellProps & { open: boolean; onClose: () => void; side?: 'left' | 'right'; closeLabel?: string; fill?: boolean }): JSX.Element | null` — `closeLabel` defaults `'Close'`, `fill` defaults `false`.
  - `Modal(props: ShellProps & { open: boolean; onClose: () => void; closeLabel?: string }): JSX.Element | null` — `closeLabel` defaults `'Close'`.
  - Phase 8's ConfirmDialog and Phase 11 examples rely on these exact prop names.

Structural deltas being ported (from irene `lib/shell/drawer.tsx` / `modal.tsx`), with irene theme REMOVED: `bg-charcoal/40 backdrop-blur-sm` → keep template `bg-black/50`; `bg-card text-card-foreground shadow-bento` → keep template `bg-background shadow-xl`/`shadow-lg`; `rounded-l-2xl`/`rounded-2xl` → template's un-rounded drawer / `rounded-lg` modal; `closeLabel = 'Fechar'` → `'Close'`; close-button pill `rounded-full bg-secondary/70` → `rounded-md hover:bg-muted`; comment references to "the Irene chat composer" / "Cancelar agendamento" → generic wording.

Steps:

- [ ] Step: write the upgraded Drawer — Write `/Users/luca/dev/winter-park/template/lib/shell/drawer.tsx` with exactly:

  ```tsx
  'use client'

  import { X } from 'lucide-react'
  import { cn } from '../utils'
  import { useScrollLock } from '../hooks/useScrollLock'
  import { ShellBase, type ShellProps } from './shell-base'

  export function Drawer({
    children, open, onClose, side = 'right', closeLabel = 'Close', fill = false, title, ...props
  }: ShellProps & {
    open: boolean
    onClose: () => void
    side?: 'left' | 'right'
    /** Accessible label for the pinned ✕ button. Override for non-English UIs. */
    closeLabel?: string
    /** Non-scrolling full-height flex column; the content owns the scroll (e.g. chat: scrolling messages + pinned composer). */
    fill?: boolean
  }) {
    // Lock body scroll while the drawer is open so the page underneath can't
    // scroll behind it (ref-counted shared hook — overflow:hidden + scrollbar
    // compensation). Drawer content gets its own scroll container below
    // (`overflow-y-auto` on the inner body). Runs before the early return so
    // its cleanup fires when `open` flips back to false.
    useScrollLock(open)

    if (!open) return null
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            // `overflow-hidden` on the panel + `overflow-y-auto` on the inner
            // body means the title row stays pinned at the top while long
            // content scrolls inside the drawer.
            // `h-[100dvh]` (not `h-full`) so the panel tracks the DYNAMIC
            // viewport: when the mobile keyboard opens, the root viewport's
            // `interactiveWidget: 'resizes-content'` shrinks the layout
            // viewport and the panel shrinks with it — keeping any
            // bottom-pinned content (e.g. a chat composer) just above the
            // keyboard. Form drawers are unaffected (their body still scrolls
            // under the same fixed height).
            'relative z-50 flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-background shadow-xl',
            side === 'right' ? 'ml-auto' : 'mr-auto'
          )}
        >
          {/* A single, consistent close affordance on EVERY drawer — a clear ✕
              icon, pinned top-right, so users never hunt for a close (and it's
              unambiguous vs. content actions like "Cancel booking"). */}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className="absolute right-4 top-4 z-10 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden className="size-5" />
          </button>
          {/* Default drawers scroll their whole body (`overflow-y-auto`). A
              `fill` drawer instead becomes a non-scrolling full-height flex
              COLUMN so its content can own the scroll internally. The
              `min-h-0 flex-1` chain is forwarded to ShellBase so the column
              actually reaches the panel's full height. */}
          <div className={cn(
            'p-6 pr-14',
            fill ? 'flex min-h-0 flex-1 flex-col' : 'flex-1 overflow-y-auto overscroll-contain',
          )}>
            <ShellBase title={title} {...props} className={fill ? 'flex min-h-0 flex-1 flex-col' : undefined}>
              {children}
            </ShellBase>
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] Step: write the upgraded Modal — Write `/Users/luca/dev/winter-park/template/lib/shell/modal.tsx` with exactly:

  ```tsx
  'use client'

  import { useScrollLock } from '../hooks/useScrollLock'
  import { ShellBase, type ShellProps } from './shell-base'

  export function Modal({
    children, open, onClose, closeLabel = 'Close', title, ...props
  }: ShellProps & {
    open: boolean
    onClose: () => void
    /** Accessible label for the pinned ✕ button. Override for non-English UIs. */
    closeLabel?: string
  }) {
    // Lock body scroll while the modal is open (ref-counted; safe to stack with
    // a drawer underneath). Hook runs before the early return so its cleanup
    // fires when `open` flips back to false.
    useScrollLock(open)
    if (!open) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          // max-h pairs with the container's p-4 (2rem top+bottom): the panel
          // never exceeds the dynamic viewport; a tall body scrolls inside.
          className="relative z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-lg bg-background shadow-lg"
        >
          {/* ✕ pinned to the (non-scrolling) panel so it stays reachable while
              a tall modal body scrolls inside. */}
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
            <ShellBase title={title} {...props}>{children}</ShellBase>
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Then `grep -in "salon\|irene\|fechar\|charcoal\|bento" lib/shell/drawer.tsx lib/shell/modal.tsx` → expected: no output.
- [ ] Step: add stories — in `/Users/luca/dev/winter-park/template/lib/shell.stories.tsx`, append after the closing `}` of `DrawerOpen` (line 37):

  ```tsx

  export const ModalLongBody: StoryObj = {
    render: () => (
      <Shell.Modal open onClose={() => {}} title="Scrolling Modal">
        <div className="space-y-3">
          {Array.from({ length: 40 }, (_, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              Row {i + 1} — the body scrolls inside the panel; the title and ✕ stay pinned.
            </p>
          ))}
        </div>
      </Shell.Modal>
    ),
  }

  export const DrawerLongBody: StoryObj = {
    render: () => (
      <Shell.Drawer open onClose={() => {}} title="Scrolling Drawer">
        <div className="space-y-3">
          {Array.from({ length: 60 }, (_, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              Row {i + 1} — the body scrolls inside the panel; the title and ✕ stay pinned.
            </p>
          ))}
        </div>
      </Shell.Drawer>
    ),
  }

  export const DrawerFill: StoryObj = {
    render: () => (
      <Shell.Drawer open onClose={() => {}} title="Fill Drawer" fill>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {Array.from({ length: 30 }, (_, i) => (
              <p key={i} className="text-sm text-muted-foreground">Message {i + 1}</p>
            ))}
          </div>
          <div className="border-t border-border pt-3">
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Pinned composer"
            />
          </div>
        </div>
      </Shell.Drawer>
    ),
  }
  ```

- [ ] Step: update `docs/shells.md` — three edits:
  1. In the intro bullet list (lines 9–14), after the bullet `- \`title\`, \`onRefresh\`, and \`onFeedback\` global affordances`, add:
     ```markdown
     - Overlay shells (Modal / Drawer) lock body scroll (`useScrollLock`, ref-counted for stacked overlays), carry dialog ARIA (`role="dialog"`, `aria-modal`, `aria-label={title}`), and pin an aria-labeled ✕ (`closeLabel` prop, default `'Close'`) to the non-scrolling panel while the body scrolls inside
     ```
  2. Replace the entire Modal code block (inside `### Modal (\`lib/shell/modal.tsx\`)`, lines 151–175) with the new `modal.tsx` content written above (identical text), and add this prose line directly under the `### Modal` heading:
     ```markdown
     Caps its height at `max-h-[calc(100dvh-2rem)]` (paired with the container's `p-4`) so tall content scrolls inside `overflow-y-auto overscroll-contain` while the panel and ✕ stay pinned.
     ```
  3. Replace the entire Drawer code block (inside `### Drawer (\`lib/shell/drawer.tsx\`)`, lines 179–201) with the new `drawer.tsx` content written above (identical text), and add this prose line directly under the `### Drawer` heading:
     ```markdown
     Uses `h-[100dvh]` so the panel tracks the dynamic viewport (bottom-pinned content stays above the mobile keyboard when the root viewport sets `interactiveWidget: 'resizes-content'`). Default drawers scroll their body; pass `fill` when the content owns its scroll (chat-style: scrolling list + pinned composer).
     ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npm run build-storybook` → expected: exit 0, `storybook-static` written, no build errors.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add lib/shell/drawer.tsx lib/shell/modal.tsx lib/shell.stories.tsx docs/shells.md
  git commit -m "backport(shell): scroll lock, dvh height, inner scroll body, pinned aria close, fill prop on Drawer/Modal" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 7.3: ErrorBoundary contained-panel fallback in ShellBase (+ shells.md ShellBase block)

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/lib/shell/shell-base.tsx` (lines 54–68, the `SceneErrorBoundary` fallback JSX)
- Modify: `/Users/luca/dev/winter-park/template/docs/shells.md` (ShellBase code block, lines 47–119 region — sync the `SceneErrorBoundary` render)

**Interfaces:**
- Consumes: Phase 2 tailwind utilities `bg-destructive-soft`, `text-destructive-deep` (destructive triad; the soft-surface/deep-text WCAG pairing pinned in 00-INDEX). Template neutrals `border-border`, `bg-background`, `text-foreground`, `bg-muted`.
- Produces: no signature change — `ShellBase`, `ShellProps` unchanged. Visual contract only.

Note: irene's fallback is `bg-destructive/10` + `rounded-2xl` + `rounded-full bg-secondary` button (irene aesthetic). Template rendering uses the Phase-2 triad equivalent (`bg-destructive-soft` panel + `text-destructive-deep` message — soft surfaces always pair with `-deep` text) and template radii.

Steps:

- [ ] Step: apply edit — in `/Users/luca/dev/winter-park/template/lib/shell/shell-base.tsx`, replace (old, lines 54–68):

  ```tsx
        <div className="space-y-2 p-4 text-center">
          <p className="text-sm text-destructive">Something went wrong.</p>
          {this.props.onRefresh && (
            <button
              onClick={() => {
                this.setState({ hasError: false })
                this.props.onRefresh?.()
              }}
              className="text-sm underline"
            >
              Try again
            </button>
          )}
        </div>
  ```

  with (new):

  ```tsx
        <div className="space-y-3 rounded-lg bg-destructive-soft p-6 text-center">
          <p className="text-sm font-medium text-destructive-deep">Something went wrong.</p>
          {this.props.onRefresh && (
            <button
              onClick={() => {
                this.setState({ hasError: false })
                this.props.onRefresh?.()
              }}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Try again
            </button>
          )}
        </div>
  ```

- [ ] Step: sync docs — in `/Users/luca/dev/winter-park/template/docs/shells.md`, inside the ShellBase code block (`### ShellBase (\`lib/shell/shell-base.tsx\`)`), replace the same old fallback JSX (identical text as above, at doc lines 100–113) with the same new JSX, so the doc's code block matches the file byte-for-byte.
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Then `npm run build-storybook` → expected: exit 0 (proves `bg-destructive-soft` / `text-destructive-deep` classes exist in the Phase-2 tailwind config).
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add lib/shell/shell-base.tsx docs/shells.md
  git commit -m "backport(shell): contained destructive-soft error-boundary fallback with button retry" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 7.4: Port `lib/time/zoned.ts` + DST unit tests (TDD)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/time/zoned.test.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/time/zoned.ts`

**Interfaces:**
- Consumes: vitest from Phase 1 (`npx vitest run`).
- Produces:
  - `type ZonedParts = { year: number; month: number; day: number; weekday: number; hour: number; minute: number; second: number; dateStr: string }`
  - `partsInZone(instant: Date, timeZone: string): ZonedParts`
  - `zonedWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string, second?: number, ms?: number): Date`
  - (Phase 9's cron per-tenant local-hour fan-out consumes `partsInZone`.)

Steps:

- [ ] Step: write failing test — Write `/Users/luca/dev/winter-park/template/lib/time/zoned.test.ts` with exactly:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { partsInZone, zonedWallTimeToUtc } from './zoned'

  describe('partsInZone', () => {
    it('decomposes a UTC instant into wall-clock parts of the zone', () => {
      // 2026-01-15T03:00:00Z is 2026-01-15 00:00:00 in São Paulo (UTC-3, no DST).
      const p = partsInZone(new Date('2026-01-15T03:00:00Z'), 'America/Sao_Paulo')
      expect(p.year).toBe(2026)
      expect(p.month).toBe(1)
      expect(p.day).toBe(15)
      expect(p.minute).toBe(0)
      expect(p.second).toBe(0)
      expect(p.dateStr).toBe('2026-01-15')
      expect(p.weekday).toBe(4) // Thursday
    })

    it('normalizes the hour-24 engine quirk: local midnight is hour 0, not 24', () => {
      const p = partsInZone(new Date('2026-01-15T03:00:00Z'), 'America/Sao_Paulo')
      expect(p.hour).toBe(0)
    })

    it('maps Sunday to ISO weekday 7', () => {
      // 2026-01-18 is a Sunday.
      expect(partsInZone(new Date('2026-01-18T12:00:00Z'), 'UTC').weekday).toBe(7)
    })

    it('renders both sides of a fall-back transition correctly', () => {
      // America/New_York falls back 2026-11-01: 02:00 EDT → 01:00 EST.
      // 05:30Z is 01:30 EDT; 06:30Z is 01:30 EST — same wall clock twice.
      expect(partsInZone(new Date('2026-11-01T05:30:00Z'), 'America/New_York').hour).toBe(1)
      expect(partsInZone(new Date('2026-11-01T06:30:00Z'), 'America/New_York').hour).toBe(1)
    })

    it('skips the spring-forward gap hour', () => {
      // America/New_York springs forward 2026-03-08: 02:00 EST → 03:00 EDT (07:00Z).
      expect(partsInZone(new Date('2026-03-08T06:59:00Z'), 'America/New_York').hour).toBe(1)
      expect(partsInZone(new Date('2026-03-08T07:00:00Z'), 'America/New_York').hour).toBe(3)
    })

    it('falls back to UTC parts on an invalid IANA zone instead of throwing', () => {
      const p = partsInZone(new Date('2026-01-15T12:34:56Z'), 'Not/AZone')
      expect(p.hour).toBe(12)
      expect(p.dateStr).toBe('2026-01-15')
    })
  })

  describe('zonedWallTimeToUtc', () => {
    it('converts winter wall time (EST, UTC-5)', () => {
      expect(zonedWallTimeToUtc(2026, 1, 15, 12, 0, 'America/New_York').toISOString())
        .toBe('2026-01-15T17:00:00.000Z')
    })

    it('converts summer wall time (EDT, UTC-4)', () => {
      expect(zonedWallTimeToUtc(2026, 7, 15, 12, 0, 'America/New_York').toISOString())
        .toBe('2026-07-15T16:00:00.000Z')
    })

    it('resolves times inside the spring-forward gap to the post-transition offset', () => {
      // 02:30 on 2026-03-08 does not exist in America/New_York.
      expect(zonedWallTimeToUtc(2026, 3, 8, 2, 30, 'America/New_York').toISOString())
        .toBe('2026-03-08T06:30:00.000Z')
    })

    it('resolves ambiguous fall-back times to the first (pre-transition) occurrence', () => {
      // 01:30 on 2026-11-01 occurs twice in America/New_York; expect the EDT one.
      expect(zonedWallTimeToUtc(2026, 11, 1, 1, 30, 'America/New_York').toISOString())
        .toBe('2026-11-01T05:30:00.000Z')
    })

    it('round-trips with partsInZone for a normal instant', () => {
      const utc = zonedWallTimeToUtc(2026, 1, 15, 0, 0, 'America/Sao_Paulo')
      expect(utc.toISOString()).toBe('2026-01-15T03:00:00.000Z')
      const p = partsInZone(utc, 'America/Sao_Paulo')
      expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 1, 15, 0, 0])
    })
  })
  ```

- [ ] Step: run test, expect FAIL — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/time/zoned.test.ts` → expected: FAIL with "Cannot find module './zoned'" (or equivalent resolve error).
- [ ] Step: copy source — `cp /Users/luca/dev/winter-park/irene/lib/time/zoned.ts /Users/luca/dev/winter-park/template/lib/time/zoned.ts`
- [ ] Step: apply generalization edits (doc comments only — code is verbatim):
  1. Lines 4–7, replace:
     ```
      * The app stores every instant as UTC (`timestamptz`). Salon-local wall-clock
      * logic — availability windows, recurrence "same time every week" — must be
      * evaluated in the SALON's timezone (`salon.timezone`, IANA string), NOT the
      * server's UTC clock or the per-device `irene.tz` cookie.
     ```
     with:
     ```
      * The app stores every instant as UTC (`timestamptz`). Workspace-local
      * wall-clock logic — availability windows, recurrence "same time every
      * week" — must be evaluated in the WORKSPACE's timezone (an IANA string on
      * the tenant record), NOT the server's UTC clock or the per-device
      * `app.tz` cookie.
     ```
  2. Line 19, replace `/** 1 = Monday … 7 = Sunday (matches the app's Weekday convention). */` with `/** 1 = Monday … 7 = Sunday (ISO-8601 weekday numbering). */`
- [ ] Step: run test, expect PASS — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/time/zoned.test.ts` → expected: 11 tests passed. Then `npx tsc --noEmit` → exit 0. Then `grep -in "salon\|irene" lib/time/zoned.ts` → no output.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add lib/time/zoned.ts lib/time/zoned.test.ts
  git commit -m "backport(lib): DST-safe zoned time helpers (partsInZone, zonedWallTimeToUtc) with unit tests" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 7.5: Port `lib/export/csv.ts` with parameterized date format (TDD)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/export/csv.test.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/export/csv.ts` (partial port — Write with full content; `csvDate` signature changes from irene's `(iso, timeZone?)` to `(iso, opts?)` with format defaulting to ISO per the English-default rule)

**Interfaces:**
- Consumes: vitest (Phase 1).
- Produces:
  - `type CsvColumn<Row> = { header: string; value: (row: Row) => string }`
  - `toCsv<Row>(rows: readonly Row[], columns: CsvColumn<Row>[]): string`
  - `csvMoney(amount: number): string`
  - `type CsvDateFormat = 'yyyy-MM-dd' | 'dd/MM/yyyy'`
  - `csvDate(iso: string | null | undefined, opts?: { timeZone?: string; format?: CsvDateFormat }): string` — format defaults `'yyyy-MM-dd'`
  - `csvResponseHeaders(basename: string): HeadersInit`

Steps:

- [ ] Step: write failing test — Write `/Users/luca/dev/winter-park/template/lib/export/csv.test.ts` with exactly:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { csvDate, csvMoney, toCsv, type CsvColumn } from './csv'

  describe('toCsv', () => {
    const columns: CsvColumn<{ name: string; note: string }>[] = [
      { header: 'Name', value: (r) => r.name },
      { header: 'Note', value: (r) => r.note },
    ]

    it('emits BOM + header + CRLF-terminated rows', () => {
      expect(toCsv([{ name: 'Ana', note: 'hi' }], columns))
        .toBe('\uFEFFName,Note\r\nAna,hi\r\n')
    })

    it('quotes fields with delimiters/newlines and doubles embedded quotes (RFC 4180)', () => {
      expect(toCsv([{ name: 'a,b', note: 'say "hi"\nok' }], columns))
        .toBe('\uFEFFName,Note\r\n"a,b","say ""hi""\nok"\r\n')
    })

    it('emits the header row alone for empty input', () => {
      expect(toCsv([], columns)).toBe('\uFEFFName,Note\r\n')
    })
  })

  describe('csvDate', () => {
    it('defaults to locale-neutral ISO yyyy-MM-dd in UTC', () => {
      expect(csvDate('2026-07-08T23:30:00.000Z')).toBe('2026-07-08')
    })

    it('renders dd/MM/yyyy when explicitly requested', () => {
      expect(csvDate('2026-07-08T23:30:00.000Z', { format: 'dd/MM/yyyy' })).toBe('08/07/2026')
    })

    it('uses the workspace timezone for the calendar day', () => {
      // 01:30Z on the 9th is still 22:30 on the 8th in São Paulo (UTC-3).
      expect(csvDate('2026-07-09T01:30:00.000Z', { timeZone: 'America/Sao_Paulo' })).toBe('2026-07-08')
    })

    it('combines timezone and dd/MM/yyyy format', () => {
      expect(csvDate('2026-07-09T01:30:00.000Z', { timeZone: 'America/Sao_Paulo', format: 'dd/MM/yyyy' }))
        .toBe('08/07/2026')
    })

    it('returns empty string for absent or invalid input', () => {
      expect(csvDate(null)).toBe('')
      expect(csvDate(undefined)).toBe('')
      expect(csvDate('not-a-date')).toBe('')
    })
  })

  describe('csvMoney', () => {
    it('renders a plain two-decimal string, no symbol', () => {
      expect(csvMoney(1234.5)).toBe('1234.50')
    })
  })
  ```

- [ ] Step: run test, expect FAIL — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/export/csv.test.ts` → expected: FAIL with "Cannot find module './csv'".
- [ ] Step: write implementation — Write `/Users/luca/dev/winter-park/template/lib/export/csv.ts` with exactly (delta vs irene source enumerated after the block):

  ```ts
  /**
   * Tiny, dependency-free CSV serializer for export route handlers.
   *
   * Spec it honors (RFC 4180 + spreadsheet-friendly choices):
   *   - Fields containing `,`, `"`, `\r`, or `\n` are wrapped in double quotes;
   *     embedded `"` is escaped by doubling it.
   *   - Rows are joined with CRLF (`\r\n`) — Excel's expected line ending.
   *   - A header row is always emitted first.
   *   - A UTF-8 BOM is prepended so Excel reads accented text correctly.
   *
   * Money and dates are pre-formatted by the caller (the column `value`
   * functions) — `toCsv` only cares about strings. Keep money as a plain
   * decimal string (e.g. `"123.45"`, no currency symbol) and dates as
   * ISO `yyyy-MM-dd` (or an explicit locale-flavored format) so a
   * spreadsheet parses them cleanly.
   */

  export type CsvColumn<Row> = {
    /** Human-readable header cell. */
    header: string
    /** Extract + stringify the cell for a row. Return '' for null/undefined. */
    value:  (row: Row) => string
  }

  const BOM = '\uFEFF'

  /** Quote a single field iff it contains a delimiter, quote, or newline. */
  function escapeField(raw: string): string {
    if (/[",\r\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`
    }
    return raw
  }

  function toRow<Row>(row: Row, columns: CsvColumn<Row>[]): string {
    return columns.map((c) => escapeField(c.value(row) ?? '')).join(',')
  }

  /**
   * Serialize `rows` to a CSV document string (header + data rows), BOM-prefixed
   * and CRLF-delimited. Always returns at least the header row.
   */
  export function toCsv<Row>(rows: readonly Row[], columns: CsvColumn<Row>[]): string {
    const header = columns.map((c) => escapeField(c.header)).join(',')
    const body   = rows.map((r) => toRow(r, columns))
    return BOM + [header, ...body].join('\r\n') + '\r\n'
  }

  /** Plain-decimal money string from a number of currency units (no symbol). */
  export function csvMoney(amount: number): string {
    return amount.toFixed(2)
  }

  /** Output shapes for `csvDate`. Default is locale-neutral ISO. */
  export type CsvDateFormat = 'yyyy-MM-dd' | 'dd/MM/yyyy'

  /**
   * Calendar-day string from an ISO timestamp/date string, or '' when
   * absent/invalid.
   *
   * `format` defaults to ISO `yyyy-MM-dd` — locale-neutral, lexically sortable,
   * parsed by every spreadsheet. Pass `'dd/MM/yyyy'` for day-first locales
   * (e.g. pt-BR exports); it is a locale-FLAVORED convenience, never the
   * default.
   *
   * Pass the workspace's IANA `timeZone` so the exported calendar day matches
   * the workspace's wall clock (a sale recorded at 23:00 in São Paulo exports
   * as that day, not the next UTC day). Omitting `timeZone` falls back to UTC.
   */
  export function csvDate(
    iso: string | null | undefined,
    opts: { timeZone?: string; format?: CsvDateFormat } = {},
  ): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    let yyyy: string, mm: string, dd: string
    if (opts.timeZone) {
      // en-CA yields 'YYYY-MM-DD' in the target tz.
      ;[yyyy, mm, dd] = new Intl.DateTimeFormat('en-CA', {
        timeZone: opts.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(d).split('-')
    } else {
      yyyy = String(d.getUTCFullYear())
      mm   = String(d.getUTCMonth() + 1).padStart(2, '0')
      dd   = String(d.getUTCDate()).padStart(2, '0')
    }
    return opts.format === 'dd/MM/yyyy' ? `${dd}/${mm}/${yyyy}` : `${yyyy}-${mm}-${dd}`
  }

  /**
   * Build the standard download headers for a CSV attachment. `basename` is the
   * filename stem (e.g. `people`); a `-YYYY-MM-DD` date suffix is appended.
   */
  export function csvResponseHeaders(basename: string): HeadersInit {
    const today = new Date().toISOString().slice(0, 10)
    return {
      'content-type':        'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${basename}-${today}.csv"`,
      // Exported data is often sensitive — never cache on shared/proxy caches.
      'cache-control':       'private, no-store',
    }
  }
  ```

  Delta vs `/Users/luca/dev/winter-park/irene/lib/export/csv.ts` (for reviewer cross-check): header prose "shared by the owner money-export route handlers (receivables / expenses / income)" → generic; "accented pt-BR text" → "accented text"; "dates as `dd/MM/yyyy` or ISO" → ISO-first; `CsvColumn.header` comment drops "(pt-BR for this app)"; literal BOM character → `'\uFEFF'` escape (same value); `csvDate(iso, timeZone?)` → `csvDate(iso, { timeZone?, format? })` defaulting to `'yyyy-MM-dd'` (was hardcoded `dd/MM/yyyy`); "salon's wall clock / São Paulo booking" comment → workspace wording; `csvResponseHeaders` example stem `receivables` → `people`, "Money data" comment → "Exported data".
- [ ] Step: run test, expect PASS — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/export/csv.test.ts` → expected: 9 tests passed. Then `npx tsc --noEmit` → exit 0. Then `grep -in "salon\|irene\|receivables" lib/export/csv.ts` → no output.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add lib/export/csv.ts lib/export/csv.test.ts
  git commit -m "backport(lib): RFC 4180 CSV export helper with ISO-default parameterized date format" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 7.6: Port `lib/list/normalize.ts` (verbatim) + test (TDD)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/list/normalize.test.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/list/normalize.ts`

**Interfaces:**
- Consumes: vitest (Phase 1).
- Produces: `normalizeText(value: string): string`; `matchesQuery(haystack: string, query: string): boolean`. (Phase 8's `useListFilter` / FilterableList consume `matchesQuery` from exactly this path `@/lib/list/normalize`.)

Steps:

- [ ] Step: write failing test — Write `/Users/luca/dev/winter-park/template/lib/list/normalize.test.ts` with exactly:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { matchesQuery, normalizeText } from './normalize'

  describe('normalizeText', () => {
    it('strips diacritics, lowercases, trims', () => {
      expect(normalizeText('José')).toBe('jose')
      expect(normalizeText('  Insumo Básico ')).toBe('insumo basico')
    })
  })

  describe('matchesQuery', () => {
    it("matches 'José' when searching 'jose'", () => {
      expect(matchesQuery('José da Silva', 'jose')).toBe(true)
    })

    it('is accent-insensitive on the query side too', () => {
      expect(matchesQuery('Jose da Silva', 'josé')).toBe(true)
    })

    it('requires every whitespace-separated token to match (AND)', () => {
      expect(matchesQuery('José da Silva', 'silva jose')).toBe(true)
      expect(matchesQuery('José da Silva', 'jose maria')).toBe(false)
    })

    it('empty query always matches', () => {
      expect(matchesQuery('anything', '')).toBe(true)
    })
  })
  ```

- [ ] Step: run test, expect FAIL — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/list/normalize.test.ts` → expected: FAIL with "Cannot find module './normalize'".
- [ ] Step: copy source — `cp /Users/luca/dev/winter-park/irene/lib/list/normalize.ts /Users/luca/dev/winter-park/template/lib/list/normalize.ts`
- [ ] Step: apply generalization edits — NONE required (the file is app-agnostic; the combining-diacritics regex on line 12 contains literal U+0300–U+036F characters — do NOT retype it, the `cp` preserves it). Confirm: `grep -in "salon\|irene" /Users/luca/dev/winter-park/template/lib/list/normalize.ts` → no output.
- [ ] Step: run test, expect PASS — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/list/normalize.test.ts` → expected: 5 tests passed. Then `npx tsc --noEmit` → exit 0.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add lib/list/normalize.ts lib/list/normalize.test.ts
  git commit -m "backport(lib): accent/case-insensitive list search normalizer with tests" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 7.7: `lib/flow-params.ts` — withFrom / useReturnTo / useDropFlowParam / useKeepQs (TDD on the pure core)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/flow-params.test.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/flow-params.ts` (port of irene `app/salon/[salonId]/owner/_primitives/flowParams.ts` + `useKeepQs` from `app/salon/[salonId]/owner/appointments/_sections/PreserveSearch.tsx`, generalized — kebab-case filename per template lib-root convention)

**Interfaces:**
- Consumes: `next/navigation` (`usePathname`, `useRouter`, `useSearchParams`), React `useCallback`.
- Produces:
  - `withFrom(target: string, current: string): string`
  - `resolveReturnTo(raw: string | null, opts: { fallback: string; pathname: string; prefix?: string }): string | null` (pure core, exported for tests and for server-side validation reuse)
  - `useReturnTo(opts: { fallback: string; prefix?: string }): string | null`
  - `useDropFlowParam(param?: string): () => void`
  - `useKeepQs(keys: readonly string[]): string`
  - Consumed by Task 7.8 components and documented in Task 7.9.

Generalization decisions (vs irene source): irene's `useReturnTo` imported `useSalonId` from `@/lib/salon/SalonIdProvider` and hardcoded the prefix `/salon/${salonId}/owner/` — replaced by (a) an unconditional in-app check (`/`-prefixed, not `//`-protocol-relative), and (b) an optional `prefix` option for area scoping (a workspace-scoped app passes its workspace route prefix; the template's example area passes `'/dashboard'`). irene's `useKeepQs` closed over a page-local `KEEP_KEYS` const — generalized to take `keys` as an argument.

Steps:

- [ ] Step: write failing test — Write `/Users/luca/dev/winter-park/template/lib/flow-params.test.ts` with exactly:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { resolveReturnTo, withFrom } from './flow-params'

  describe('withFrom', () => {
    it('appends ?from= with the current location, URL-encoded', () => {
      expect(withFrom('/dashboard/people/2', '/dashboard/people?q=jo&page=3'))
        .toBe('/dashboard/people/2?from=%2Fdashboard%2Fpeople%3Fq%3Djo%26page%3D3')
    })

    it('preserves existing target query params', () => {
      expect(withFrom('/dashboard/people/2?tab=notes', '/dashboard'))
        .toBe('/dashboard/people/2?tab=notes&from=%2Fdashboard')
    })

    it('does not override an explicit from already on the target', () => {
      expect(withFrom('/dashboard/people/2?from=%2Fx', '/dashboard'))
        .toBe('/dashboard/people/2?from=%2Fx')
    })

    it('returns the target untouched when current is empty', () => {
      expect(withFrom('/dashboard/people/2', '')).toBe('/dashboard/people/2')
    })
  })

  describe('resolveReturnTo', () => {
    const base = { fallback: '/dashboard/people', pathname: '/dashboard/people/2' }

    it('returns a valid in-app origin', () => {
      expect(resolveReturnTo('/dashboard?tab=today', base)).toBe('/dashboard?tab=today')
    })

    it('rejects a missing param', () => {
      expect(resolveReturnTo(null, base)).toBeNull()
      expect(resolveReturnTo('', base)).toBeNull()
    })

    it('rejects absolute and protocol-relative URLs (open-redirect guard)', () => {
      expect(resolveReturnTo('https://evil.example/x', base)).toBeNull()
      expect(resolveReturnTo('//evil.example/x', base)).toBeNull()
    })

    it('rejects values outside the allowed prefix when one is given', () => {
      expect(resolveReturnTo('/admin/secrets', { ...base, prefix: '/dashboard' })).toBeNull()
      expect(resolveReturnTo('/dashboard?tab=today', { ...base, prefix: '/dashboard' }))
        .toBe('/dashboard?tab=today')
    })

    it('rejects the canonical fallback (no duplicate back affordance)', () => {
      expect(resolveReturnTo('/dashboard/people', base)).toBeNull()
    })

    it('rejects the current pathname (no self-loop)', () => {
      expect(resolveReturnTo('/dashboard/people/2', base)).toBeNull()
    })
  })
  ```

- [ ] Step: run test, expect FAIL — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/flow-params.test.ts` → expected: FAIL with "Cannot find module './flow-params'".
- [ ] Step: write implementation — Write `/Users/luca/dev/winter-park/template/lib/flow-params.ts` with exactly:

  ```ts
  'use client'

  import { useCallback } from 'react'
  import { usePathname, useRouter, useSearchParams } from 'next/navigation'

  /**
   * Inter-flow navigation hooks built around a single `?from=` query param.
   *
   * Lifecycle of `?from` (full write-up: docs/flow-params.md):
   *   - Birth   : an `<OriginLink>` (or any opt-in navigator) appends
   *               `?from=<currentPathnameAndSearch>` when the user follows it.
   *   - Use     : the destination calls `useReturnTo({ fallback })` to get a
   *               contextual back href. The hook validates the param so a
   *               malicious or stale value can't be honoured.
   *   - Drop    : every other navigator omits the param naturally — nav
   *               links, canonical back, route exits, etc. Pages that complete
   *               a flow in place (e.g. inline save, no navigation) call
   *               `useDropFlowParam('from')` to scrub it without navigating.
   *
   * Convention: only the origin-link primitives emit `?from`. Custom hand-
   * written links should not — they bypass the lifecycle.
   *
   * Why only one slot, not a stack: in practice, "back to where I came from"
   * is one level deep. A stack would spread state and increase pruning rules
   * for marginal gain. The user can chain navigations and still go back via
   * the canonical BackLink; only the immediate hop is contextual.
   */

  const FLOW_PARAM = 'from'

  /**
   * Build the `?from=` href emitted by origin-link primitives.
   *
   * - `target`  : the destination href (e.g. `/dashboard/people/2`).
   * - `current` : the current pathname + search (where the user is leaving from).
   *
   * If `target` already has a `?from`, we leave it alone — explicit beats
   * implicit, and overwriting would let nested links accidentally lose state.
   */
  export function withFrom(target: string, current: string): string {
    if (!current) return target
    // If target already encodes a `from`, don't override it.
    const [path, query = ''] = target.split('?')
    const params = new URLSearchParams(query)
    if (params.has(FLOW_PARAM)) return target
    params.set(FLOW_PARAM, current)
    return `${path}?${params.toString()}`
  }

  /**
   * Pure validation core of `useReturnTo` — exported for unit tests and for
   * server-side reuse. Rules (any failure → `null`, caller falls back):
   *   - param must be present and non-empty
   *   - must be an in-app path: starts with `/` but not `//` (blocks absolute
   *     and protocol-relative URLs — open-redirect guard)
   *   - when `prefix` is given, must start with it (area scoping — a
   *     workspace-scoped app passes its workspace route prefix)
   *   - must not be the same as `fallback` (avoid duplicating canonical back)
   *   - must not equal the current pathname (no self-loop)
   */
  export function resolveReturnTo(
    raw: string | null,
    opts: { fallback: string; pathname: string; prefix?: string },
  ): string | null {
    if (!raw) return null
    if (!raw.startsWith('/') || raw.startsWith('//')) return null
    if (opts.prefix && !raw.startsWith(opts.prefix)) return null
    if (raw === opts.fallback) return null
    if (raw === opts.pathname) return null
    return raw
  }

  /**
   * Resolve the contextual return href for the current page. See
   * `resolveReturnTo` for the validation rules.
   */
  export function useReturnTo(opts: { fallback: string; prefix?: string }): string | null {
    const search   = useSearchParams()
    const pathname = usePathname() ?? ''

    const raw = search?.get(FLOW_PARAM) ?? null
    return resolveReturnTo(raw, { fallback: opts.fallback, pathname, prefix: opts.prefix })
  }

  /**
   * Strip a flow param from the URL in place — no navigation, no scroll.
   *
   * Use when a flow completes on the same page (e.g. an inline save) and the
   * `?from=` would otherwise stick around polluting future shares / refreshes.
   *
   * Defaults to `from` so call sites read as `useDropFlowParam()()`.
   */
  export function useDropFlowParam(param: string = FLOW_PARAM): () => void {
    const router   = useRouter()
    const pathname = usePathname()
    const search   = useSearchParams()
    return useCallback(() => {
      if (!search?.has(param)) return
      const next = new URLSearchParams(search.toString())
      next.delete(param)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, [router, pathname, search, param])
  }

  /**
   * Reads the current search params and returns a `key=value&…` fragment
   * containing only `keys`. Empty string when none are set, so callers can
   * simply concatenate without worrying about leading separators.
   *
   * The key list is page-specific by nature (e.g. a calendar page keeps
   * `['view', 'date', 'page']` across its drawer-open/close transitions) —
   * each page passes its own. Params these helpers are setting or dropping
   * (like the drawer-toggle param itself) must stay OUT of the list, or
   * preserving them would defeat the close behavior.
   */
  export function useKeepQs(keys: readonly string[]): string {
    const sp = useSearchParams()
    const parts: string[] = []
    for (const k of keys) {
      const v = sp?.get(k)
      if (v) parts.push(`${k}=${encodeURIComponent(v)}`)
    }
    return parts.join('&')
  }
  ```

- [ ] Step: run test, expect PASS — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/flow-params.test.ts` → expected: 10 tests passed. Then `npx tsc --noEmit` → exit 0.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add lib/flow-params.ts lib/flow-params.test.ts
  git commit -m "backport(lib): ?from= flow-param primitives (withFrom, useReturnTo, useDropFlowParam, useKeepQs)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 7.8: Link primitives — BackLink, OriginLink, PreserveSearchLink, ContextualBackLink

**Files:**
- Create: `/Users/luca/dev/winter-park/template/components/ui/BackLink.tsx`
- Create: `/Users/luca/dev/winter-park/template/components/ui/OriginLink.tsx`
- Create: `/Users/luca/dev/winter-park/template/components/ui/PreserveSearchLink.tsx`
- Create: `/Users/luca/dev/winter-park/template/components/ui/ContextualBackLink.tsx`

**Interfaces:**
- Consumes: `withFrom`, `useReturnTo`, `useKeepQs` from `@/lib/flow-params` (Task 7.7); `ArrowLeft` from `lucide-react`; Phase 2 tailwind utility `text-brand` (brand triad base); template neutrals `text-muted-foreground`, `text-foreground`.
- Produces:
  - `BackLink(props: { href: string; label: string; className?: string }): JSX.Element` (server-compatible, no `'use client'`)
  - `OriginLink(props: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; children: ReactNode }): JSX.Element`
  - `PreserveSearchLink(props: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; keep: readonly string[]; children: ReactNode }): JSX.Element`
  - `ContextualBackLink(props: { fallbackHref: string; fallbackLabel: string; contextualLabel?: string; prefix?: string }): JSX.Element` — `contextualLabel` defaults `'Back to where you came from'`

Generalization decisions (vs irene sources): `BackLink` (from `app/salon/[salonId]/owner/_sections/BackLink.tsx`) drops the irene chrome `rounded-full bg-card px-3.5 py-1.5 shadow-bento` → plain text link with template neutrals. `ContextualBackLink` (from `.../owner/_primitives/ContextualBackLink.tsx`) drops `useT` from `@/lib/i18n/LocaleProvider` and the `m.common.backToOrigin` default → English default via prop; gains the `prefix` pass-through; `text-primary` → `text-brand`. `OriginLink` doc comment drops `<CustomerLink>`/`<EntityLink>` references (app-level pattern). `PreserveSearchLink` (from `.../appointments/_sections/PreserveSearch.tsx`) loses its page-local `KEEP_KEYS` const and takes a required `keep` prop; `useKeepQs` now lives in `@/lib/flow-params`.

Steps:

- [ ] Step: write BackLink — Write `/Users/luca/dev/winter-park/template/components/ui/BackLink.tsx` with exactly:

  ```tsx
  import Link from 'next/link'
  import { ArrowLeft } from 'lucide-react'

  /**
   * Tiny back-arrow link rendered above pages that have a parent route in the
   * flow diagram. Pages always pass a typed `route.exits.<parent>(...)` href —
   * never raw URL strings.
   *
   * `className` overrides the default `mb-4` margin — useful when composing
   * BackLink alongside other navigation affordances (e.g. inside
   * `<ContextualBackLink>`).
   */
  export function BackLink(props: { href: string; label: string; className?: string }) {
    return (
      <Link
        href={props.href}
        className={
          (props.className ?? 'mb-4') +
          ' group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
        }
      >
        <ArrowLeft aria-hidden="true" className="size-4 transition-transform group-hover:-translate-x-0.5" />
        <span>{props.label}</span>
      </Link>
    )
  }
  ```

- [ ] Step: write OriginLink — Write `/Users/luca/dev/winter-park/template/components/ui/OriginLink.tsx` with exactly:

  ```tsx
  'use client'

  import Link from 'next/link'
  import { usePathname, useSearchParams } from 'next/navigation'
  import type { AnchorHTMLAttributes, ReactNode } from 'react'
  import { withFrom } from '@/lib/flow-params'

  type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href:     string
    children: ReactNode
  }

  /**
   * Drop-in `<Link>` replacement that appends `?from=<currentLocation>` so
   * the destination's `<ContextualBackLink>` can return the user to the
   * exact list state they came from (filters + pagination intact).
   *
   * Use this for row-clicks on list pages where the destination is its own
   * page (detail / edit). Apps that render entity names as inline links can
   * build their own entity-link primitives on top of `withFrom` — same
   * mechanism, typography of their choosing.
   *
   * The `?from=` only sticks on links built via this component. Every other
   * navigator naturally drops it — see `lib/flow-params.ts`.
   */
  export function OriginLink({ href, children, ...rest }: Props) {
    const pathname = usePathname() ?? ''
    const search   = useSearchParams()
    const current = (() => {
      if (!search) return pathname
      const next = new URLSearchParams(search.toString())
      next.delete('from')
      const qs = next.toString()
      return qs ? `${pathname}?${qs}` : pathname
    })()
    return (
      <Link href={withFrom(href, current)} {...rest}>
        {children}
      </Link>
    )
  }
  ```

- [ ] Step: write PreserveSearchLink — Write `/Users/luca/dev/winter-park/template/components/ui/PreserveSearchLink.tsx` with exactly:

  ```tsx
  'use client'

  import Link from 'next/link'
  import type { AnchorHTMLAttributes, ReactNode } from 'react'
  import { useKeepQs } from '@/lib/flow-params'

  type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    /**
     * Search-param keys to carry onto the destination URL. Page-specific by
     * nature — define the list once per page (e.g.
     * `const KEEP = ['view', 'date', 'page'] as const`) so every site that
     * preserves them stays in lockstep. Keep the param being toggled (e.g. a
     * `?openDrawer=` key) OUT of the list, or closing would re-open it.
     */
    keep: readonly string[]
    children: ReactNode
  }

  /**
   * Drop-in `<Link>` replacement that appends the current values of `keep`
   * keys to the destination URL. Used for any link that navigates WITHIN a
   * page (e.g. opening a detail drawer via a search-param toggle) and must
   * preserve the page's filter state.
   */
  export function PreserveSearchLink({ href, keep, children, ...rest }: Props) {
    const qs = useKeepQs(keep)
    const sep = qs.length === 0 ? '' : href.includes('?') ? '&' : '?'
    return (
      // scroll={false}: these navigate WITHIN the page (open a drawer, step a
      // filter) — Next's default scroll-to-top would yank the user away from
      // the row they just clicked. Overridable via `...rest`.
      <Link href={`${href}${sep}${qs}`} scroll={false} {...rest}>
        {children}
      </Link>
    )
  }
  ```

- [ ] Step: write ContextualBackLink — Write `/Users/luca/dev/winter-park/template/components/ui/ContextualBackLink.tsx` with exactly:

  ```tsx
  'use client'

  import Link from 'next/link'
  import { useReturnTo } from '@/lib/flow-params'
  import { BackLink } from './BackLink'

  /**
   * Renders the canonical `<BackLink>` (always) AND a contextual back link
   * (when `?from=` resolves to a valid in-app path).
   *
   * The canonical link is the page's "go up to my parent" affordance and is
   * never hidden — users always have it as their stable mental model. The
   * contextual link appears only when:
   *
   *   - `?from=` is present, in-app, and (when `prefix` is given) inside it
   *   - it is not the same as the canonical `fallbackHref` (no duplicate)
   *   - it is not the current pathname (no self-loop)
   *
   * If you want the canonical-only behavior anywhere, just keep using
   * `<BackLink>` directly. Adopt this wrapper everywhere a flow can land you
   * coming from another flow's row (most detail pages).
   */
  export function ContextualBackLink(props: {
    fallbackHref:  string
    fallbackLabel: string
    /** Label for the contextual back. Defaults to English; pass a translated string. */
    contextualLabel?: string
    /** Restrict which `?from=` values are honoured (e.g. `'/dashboard'`). */
    prefix?: string
  }) {
    const returnTo = useReturnTo({ fallback: props.fallbackHref, prefix: props.prefix })

    return (
      <div className="mb-4 flex items-center gap-3">
        {returnTo && (
          <Link
            href={returnTo}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            <span aria-hidden="true">←</span>
            <span>{props.contextualLabel ?? 'Back to where you came from'}</span>
          </Link>
        )}
        <BackLink href={props.fallbackHref} label={props.fallbackLabel} className="" />
      </div>
    )
  }
  ```

- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Then `grep -in "salon\|irene\|useT\|voltar" components/ui/BackLink.tsx components/ui/OriginLink.tsx components/ui/PreserveSearchLink.tsx components/ui/ContextualBackLink.tsx` → no output.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add components/ui/BackLink.tsx components/ui/OriginLink.tsx components/ui/PreserveSearchLink.tsx components/ui/ContextualBackLink.tsx
  git commit -m "backport(ui): navigation-state link primitives (BackLink, OriginLink, PreserveSearchLink, ContextualBackLink)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 7.9: Docs — links.md, flow-params.md, pages.md cross-cutting section, CLAUDE.md doc-table rows

**Files:**
- Create: `/Users/luca/dev/winter-park/template/docs/links.md`
- Create: `/Users/luca/dev/winter-park/template/docs/flow-params.md`
- Modify: `/Users/luca/dev/winter-park/template/docs/pages.md` (insert new `## Cross-cutting primitives` section before line 103 `### How they compose`)
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (insert two rows after line 33, the `declarative-flows.md` doc-table row)

**Interfaces:**
- Consumes: everything produced by Tasks 7.7 and 7.8 (names must match exactly: `withFrom`, `resolveReturnTo`, `useReturnTo`, `useDropFlowParam`, `useKeepQs`, `OriginLink`, `ContextualBackLink`, `PreserveSearchLink`, `BackLink`, prop `keep`, prop `prefix`).
- Produces: doc pages served at `/docs` (template docs site reads frontmatter `title`/`order`/`category`).

Steps:

- [ ] Step: write links.md — Write `/Users/luca/dev/winter-park/template/docs/links.md` with exactly (content spans to the closing 4-backtick fence; inner 3-backtick fences are part of the doc):

  ````markdown
  ---
  title: Links
  order: 13
  category: Patterns
  ---

  # Links

  > Picking the right link primitive for the situation.

  The template ships **four** link primitives. Each solves a different problem; picking the wrong one breaks back-navigation or filter state.

  | Primitive | Purpose | Mechanism | Deep dive |
  |---|---|---|---|
  | `<OriginLink>` | Row-click on a list page where the destination is its own page (detail / edit) | `?from=` (one-level origin URL) | [`flow-params.md`](flow-params.md) |
  | `<ContextualBackLink>` | The "back" affordance on a destination page — renders contextual ("where you came from") + canonical ("up to parent") | reads `?from=` | [`flow-params.md`](flow-params.md) |
  | `<PreserveSearchLink>` + `useKeepQs()` | Intra-page navigation that must preserve a fixed set of filter keys (e.g. opening a drawer via a search-param toggle) | named-key search-param carry | this file |
  | `<BackLink>` | Canonical "up to my parent" link — used when the page has no inter-flow context to preserve | static href | `components/ui/BackLink.tsx` |

  Apps with clickable domain entities (a customer name inside a sentence, a
  linked product title) should add their own **entity-link** primitives on top
  of `withFrom` — one component per entity, styled as linked text. That family
  is app-level by nature (it knows your routes and entities), so the template
  doesn't ship one; `<OriginLink>` is the un-styled foundation to copy from.

  ---

  ## Decision tree

  Start here when adding a new link.

  ```
  Am I rendering a domain entity's display name as a link?
  ├─ Yes → your app's entity-link primitive (build it on withFrom; see note above)
  └─ No → continue

  Is this a row-click on a list page, navigating to a detail/edit sub-page?
  ├─ Yes → <OriginLink>      (so the destination's ContextualBackLink can return them with filters intact)
  └─ No → continue

  Is this a "back" link on a destination page (detail / edit / form)?
  ├─ Yes → <ContextualBackLink fallbackHref={…} fallbackLabel={…} />
  └─ No → continue

  Am I navigating WITHIN the same page but the URL must keep certain filter keys
  (e.g. opening a drawer via search-param toggle on a list page)?
  ├─ Yes → <PreserveSearchLink keep={[…]}> + useKeepQs([…])
  └─ No → continue

  Is this the chrome's static "up to parent" link with NO filter context?
  ├─ Yes → <BackLink href={route.exits.parent()} label="Back to people" />
  └─ No → plain <Link> — but think twice; it's almost always one of the above.
  ```

  If you're using a raw `<Link href={route.exits.x(...)}>` for a row-click or a
  back-link, you're probably wrong. These primitives exist specifically because
  raw links drop state.

  ---

  ## `<OriginLink>` — row-click with origin preservation

  Appends `?from=<currentPathnameAndSearch>` via `withFrom`, with no typography
  opinion — suitable for "click the whole row" or "click the Edit button"
  patterns.

  ```tsx
  import { OriginLink } from '@/components/ui/OriginLink'

  <ul className="divide-y rounded-md border">
    {people.map((p) => (
      <li key={p.id}>
        <OriginLink
          href={route.exits.personDetail({ personId: p.id })}
          className="grid grid-cols-12 items-center gap-3 px-4 py-3 hover:bg-muted/50"
        >
          {/* …row content… */}
        </OriginLink>
      </li>
    ))}
  </ul>
  ```

  The destination's `<ContextualBackLink>` then renders "Back to where you came
  from" → the list URL with `?q=…&page=…` intact.

  **File:** `components/ui/OriginLink.tsx`

  ---

  ## `<PreserveSearchLink>` + `useKeepQs()` — intra-page state carry

  A **different** mechanism from `?from=`. Solves: "on a list+calendar page,
  opening the detail drawer (`?openDrawer=N`) drops `?view`, `?date`, `?page` —
  when the drawer closes, the filters reset."

  The fix: every drawer-open and drawer-close link re-appends the known filter
  keys.

  ```tsx
  // 1. Define the keys to keep once, per page
  const KEEP = ['view', 'date', 'page'] as const

  // 2. Use the link in lists / calendar items
  import { PreserveSearchLink } from '@/components/ui/PreserveSearchLink'

  <PreserveSearchLink href={route.exits.detailOpen({ id })} keep={KEEP}>
    {row.name}
  </PreserveSearchLink>

  // 3. Use the hook for imperative navigation (router.push)
  import { useKeepQs } from '@/lib/flow-params'

  const qs = useKeepQs(KEEP)
  router.push(qs ? `${base}?${qs}` : base)
  ```

  **Why this isn't `?from=`:**
  - `?from=` carries **one full URL** as a single opaque string. Designed for
    cross-flow navigation (overview page → detail page → back to overview).
  - `PreserveSearchLink` carries **a known set of keys** as individual params.
    Designed for intra-page transitions where the page itself owns the filter
    state and needs to round-trip it through the URL.

  A page can use both: `PreserveSearchLink` for its drawer transitions AND
  `<OriginLink>` on row-clicks that navigate OUT to other pages.

  **Convention:** the keep-keys list is page-specific by nature — define one
  `KEEP` const per page next to the page that owns the filter state, and keep
  the toggled param (e.g. `openDrawer`) out of it.

  ---

  ## The three patterns side-by-side

  | Pattern | URL after click | What the destination does |
  |---|---|---|
  | Raw `<Link>` | `/dest` | No filter context — back goes to bare parent |
  | `<OriginLink>` | `/dest?from=%2Forigin%3Fq%3Dx%26page%3D3` | `<ContextualBackLink>` renders two links: "Back to where you came from" → origin (filters intact) + canonical → bare parent |
  | `<PreserveSearchLink>` | `/same-page?openDrawer=N&view=day&date=…` | Stays on the same page; the page reads its filters from `searchParams` and renders both the list AND the drawer |

  ---

  ## When NOT to preserve state

  Sometimes you want to drop filters. Two cases worth calling out:

  - **Sidebar / global nav.** Going from `/dashboard/reports?date=…` to
    `/dashboard/people` should land on the bare people list, not propagate the
    date filter. Nav links use plain `<Link>` — no preservation primitives.
  - **Form success that creates a new entity.** After creating a record, the
    user lands on the new record's detail page. Don't append `?from=` — the new
    page should render `<ContextualBackLink>` with its canonical fallback (back
    to list), not bounce them back to where the create form was opened.

  The `?from=` machinery handles both naturally: only `<OriginLink>` (and your
  entity links) emit it; everything else drops it.

  ---

  ## Checklist for a new list page

  When you add a list page with URL filter state (`?q=`, `?page=`, date range):

  1. **Row click → `<OriginLink>`** (or your entity-link primitive).
  2. **Detail page top back-link → `<ContextualBackLink fallbackHref={…} fallbackLabel={…} />`**.
  3. **Edit/form page top back-link → `<ContextualBackLink>`** (same as detail).
  4. **Form `redirectTo` on success → resolve via `useReturnTo({ fallback })`**
     so save-then-return lands on the origin list page with filters intact.
  5. **If the page opens a drawer via search-param toggle** → define the page's
     `KEEP` const, use `<PreserveSearchLink keep={KEEP}>` on the drawer-open
     links, and `useKeepQs(KEEP)` for the drawer-close `router.push`.

  ---

  ## Quick reference

  ```tsx
  // Whole-row link:
  import { OriginLink } from '@/components/ui/OriginLink'
  <OriginLink href={route.exits.personDetail({ personId })} className="…">
    …row content…
  </OriginLink>

  // Destination back link:
  import { ContextualBackLink } from '@/components/ui/ContextualBackLink'
  <ContextualBackLink fallbackHref={route.exits.parent()} fallbackLabel="Back to people" />

  // Form success that returns to origin (when present):
  import { useReturnTo } from '@/lib/flow-params'
  const returnTo = useReturnTo({ fallback: route.exits.parent() })
  const successHref = returnTo ?? route.exits.parent()

  // Intra-page drawer toggle:
  import { PreserveSearchLink } from '@/components/ui/PreserveSearchLink'
  <PreserveSearchLink href={route.exits.detailOpen({ id })} keep={['view', 'date', 'page']}>…</PreserveSearchLink>

  // Canonical-only back:
  import { BackLink } from '@/components/ui/BackLink'
  <BackLink href={route.exits.parent()} label="Back to people" />
  ```

  Files of interest:

  - `components/ui/OriginLink.tsx` — row-click `?from=` emitter
  - `components/ui/ContextualBackLink.tsx` — canonical destination back link
  - `components/ui/PreserveSearchLink.tsx` — named-key search-param carry
  - `components/ui/BackLink.tsx` — the static canonical "up" link
  - `lib/flow-params.ts` — `withFrom`, `resolveReturnTo`, `useReturnTo`, `useDropFlowParam`, `useKeepQs`
  ````

- [ ] Step: write flow-params.md — Write `/Users/luca/dev/winter-park/template/docs/flow-params.md` with exactly (content spans to the closing 4-backtick fence; inner 3-backtick fences are part of the doc):

  ````markdown
  ---
  title: Flow Params (?from=)
  order: 14
  category: Patterns
  ---

  # Inter-flow navigation (`?from=`)

  > Let the user click a person's row on the dashboard overview, land on the
  > person detail page, then go back to the **overview they came from** — not
  > the bare people list.

  A three-stage lifecycle around a single query param, built on a handful of
  primitives. Nothing more global. Nothing stateful. No breadcrumb stack.

  ```
  Overview → click <OriginLink> → /dashboard/people/123?from=/dashboard?tab=today
                                   └─ destination shows "← Back to where you came from"
                                      alongside its canonical "Back to people"
  ```

  Files: `lib/flow-params.ts` + `components/ui/ContextualBackLink.tsx`.

  ---

  ## The lifecycle

  The `?from=` param has exactly three lifecycle stages. Each has a dedicated
  primitive. Picking the right primitive for each stage is the whole pattern.

  ### Birth — `withFrom(target, current)`

  `<OriginLink>` emits `?from=` by calling `withFrom` under the hood — a
  drop-in `<Link>` replacement for row-click / whole-card click targets. Apps
  that add entity-name link primitives should emit it the same way.

  ```ts
  withFrom('/dashboard/people/123', '/dashboard?tab=today')
  // → '/dashboard/people/123?from=%2Fdashboard%3Ftab%3Dtoday'
  ```

  `withFrom` leaves any pre-existing `from` on the target alone. That's the
  **one-level-deep rule**: a chain Overview → Person → Report puts
  `from=/person` on the report URL, not `from=/overview`. We deliberately don't
  accumulate a stack — the canonical BackLink is always there as the global
  "up" affordance.

  Hand-written `<Link>` and `route.entry.href(...)` calls never emit `from`.
  The param can only be spawned where we explicitly chose to spawn it. Nav
  links, route exits, and form redirects all stay clean.

  ### Use — `useReturnTo({ fallback, prefix? })`

  The destination page calls this hook to resolve a contextual back href. The
  hook validates — any failure → `null` → caller falls back to the canonical
  href.

  ```ts
  const returnTo = useReturnTo({ fallback: route.exits.people(), prefix: '/dashboard' })
  // → '/dashboard?tab=today'   (when ?from= is valid)
  // → null                     (when missing / external / outside prefix / equal to fallback / self-loop)
  ```

  Validation rules (any failure → `null`):
  - Must be an in-app path: starts with `/` but not `//` — blocks absolute and
    protocol-relative URLs (open-redirect guard).
  - When `prefix` is given, must start with it — scopes the honoured origins to
    an area (a workspace-scoped app passes its workspace route prefix, e.g.
    `/w/${workspaceId}`).
  - Must not equal `fallback` — avoids duplicating the canonical back.
  - Must not equal the current pathname — no self-loops.

  The pure core is exported as `resolveReturnTo(raw, { fallback, pathname,
  prefix? })` for unit tests and server-side reuse.

  ### Drop — `useDropFlowParam('from')`

  For flows that **complete on the same page** (inline save with no
  navigation), call this hook to scrub the param via `router.replace`. No
  scroll, no navigation, just URL cleanup.

  ```tsx
  const dropFrom = useDropFlowParam()    // defaults to 'from'

  const handleSaved = () => {
    // … run inline save
    dropFrom()                            // ?from=… falls off the URL
  }
  ```

  Most flows don't need this. Two reasons it dies naturally without explicit
  drop:

  1. The destination's contextual back navigates to `from` *plain* —
     destination URL is left clean.
  2. Any other `route.exits.*(...)` exit doesn't carry `from` forward.

  `useDropFlowParam` is the safety valve for the one case those two don't
  cover: completing in place without changing the URL otherwise.

  ---

  ## `<ContextualBackLink>` — the canonical adoption point

  You don't usually call the hooks directly. You use `<ContextualBackLink>`,
  which renders the canonical back **always** and the contextual back **when
  applicable**:

  ```tsx
  <ContextualBackLink
    fallbackHref={route.exits.people()}
    fallbackLabel="Back to people"
  />
  ```

  Renders:

  ```
  ← Back to where you came from        ← Back to people
  [contextual, only when ?from valid]  [canonical, always]
  ```

  - The canonical link is the page's stable mental model — never hidden.
  - The contextual link appears only when `useReturnTo` resolves to a real,
    valid origin.
  - Optional `contextualLabel` overrides the default English copy (pass a
    translated string from your i18n messages).
  - Optional `prefix` scopes which origins are honoured.

  **Migration recipe** for any detail page:

  ```diff
  - <BackLink href={route.exits.people()} label="Back to people" />
  + <ContextualBackLink
  +   fallbackHref={route.exits.people()}
  +   fallbackLabel="Back to people"
  + />
  ```

  That's the entire change. The flow handles itself from there.

  ---

  ## What `from` does NOT do

  | Question | Answer |
  |---|---|
  | Does it survive a hard refresh? | Yes — it lives in the URL, so refresh + share both preserve it. |
  | Does it survive opening in a new tab? | Yes — `Link` preserves the href. |
  | Does it survive chaining (Overview → Person → Report)? | **No.** Report's `from` points to `/person`, not `/overview`. One level deep. |
  | Does it persist if the user goes elsewhere? | No — only origin-link primitives emit it. Nav, exits, hand-written links all drop it naturally. |
  | Should I use it as a breadcrumb? | No — use `<ContextualBackLink>` which already does the right thing. |
  | Should I store the breadcrumb stack somewhere? | No — that's the explicit non-goal. |

  ---

  ## Why one level (and not a stack)

  A stack would let Report go back to Person, then Person back to Overview. We
  chose not to build that because:

  - **Pruning rules get hard fast.** What if the user navigates Overview →
    Person → Person → Report? Does Person appear twice in the stack?
  - **The 95% case is one level.** Overview → detail is the common pattern.
    Two-hop is rare; three-hop is rarer.
  - **The canonical BackLink is already the global "up".** For anything deeper,
    the browser back button works; same for the canonical hierarchy.

  If you ever need a real chain, the upgrade path is to make `from` a
  comma-separated list and have `useReturnTo` pop the last entry. The current
  primitives are designed so that upgrade is local — neither call sites nor
  `<ContextualBackLink>` would need to change.

  ---

  ## Convention to keep this clean

  The lifecycle only works if the **birth stage is constrained**. Three rules:

  1. **Only origin-link primitives emit `from`** (`<OriginLink>` and any
     app-authored entity links built on `withFrom`). No hand-written
     `<a href="…?from=…">`.
  2. **No `route.entry.href(...)` call appends `from`**. The entries don't know
     about it; `withFrom` is the only blessed wrapper.
  3. **All adopting destinations use `<ContextualBackLink>`**, not raw
     `useReturnTo` (with one exception: pages that render their back UI in a
     non-standard place may call the hook directly).

  A simple grep can backstop this:

  ```bash
  # Should match only lib/flow-params.ts and components/ui/OriginLink.tsx
  grep -rn "from=" app/ components/ lib/ --include="*.tsx" --include="*.ts" | grep -v flow-params | grep -v OriginLink
  ```

  ---

  ## Quick reference

  ```tsx
  // Destination page:
  import { ContextualBackLink } from '@/components/ui/ContextualBackLink'

  <ContextualBackLink
    fallbackHref={route.exits.parent()}
    fallbackLabel="Back to people"
  />

  // In-place flow completion:
  import { useDropFlowParam } from '@/lib/flow-params'

  const dropFrom = useDropFlowParam()
  // call dropFrom() once the in-place flow finishes
  ```

  Files of interest:

  - `lib/flow-params.ts` — `withFrom`, `resolveReturnTo`, `useReturnTo`, `useDropFlowParam`, `useKeepQs`
  - `components/ui/OriginLink.tsx` — birth-stage emission for row-click / whole-card targets
  - `components/ui/ContextualBackLink.tsx` — canonical adoption point
  - For the decision tree across all link primitives, see [`links.md`](links.md)
  ````

- [ ] Step: add pages.md cross-cutting section — in `/Users/luca/dev/winter-park/template/docs/pages.md`, insert directly before line 103 (`### How they compose`):

  ```markdown
  ## Cross-cutting primitives

  A page composes Shells + Sections, but it also renders row-links and
  back-links — and those are *not* invented per page. Two conventions are
  framework-wide:

  - **Link primitives** — row-clicks, back affordances, and filter-preserving
    links are shared primitives (`<OriginLink>`, `<ContextualBackLink>`,
    `<PreserveSearchLink>`, `<BackLink>` in `components/ui/`), each with a
    decision tree entry. See [`links.md`](links.md).
  - **Inter-flow navigation** (`?from=`) — when a link takes the user *out* of
    one flow into another, the destination page surfaces a "back to where you
    came from" affordance alongside its canonical back. See
    [`flow-params.md`](flow-params.md). Adopting it on a page is a one-line
    swap (`BackLink` → `ContextualBackLink`).

  ```

- [ ] Step: add CLAUDE.md doc-table rows — in `/Users/luca/dev/winter-park/template/CLAUDE.md`, replace (line 33):

  ```markdown
  | [`declarative-flows.md`](docs/declarative-flows.md) | Action-first design, state machines |
  ```

  with:

  ```markdown
  | [`declarative-flows.md`](docs/declarative-flows.md) | Action-first design, state machines |
  | [`links.md`](docs/links.md) | Link-primitive decision tree — OriginLink / ContextualBackLink / PreserveSearchLink / BackLink |
  | [`flow-params.md`](docs/flow-params.md) | `?from=` lifecycle — withFrom, useReturnTo, useDropFlowParam, useKeepQs |
  ```

- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Then `grep -rn "salonId\|salon\/\|useT\|EntityLink" docs/links.md docs/flow-params.md` → expected: no output (EntityLink appears nowhere; entity links are described generically as "entity-link primitives"). Then `grep -c "links.md\|flow-params.md" CLAUDE.md` → expected: ≥ 2.
- [ ] Step: commit —
  ```bash
  cd /Users/luca/dev/winter-park/template
  git add docs/links.md docs/flow-params.md docs/pages.md CLAUDE.md
  git commit -m "backport(docs): links decision tree, ?from= lifecycle, pages cross-cutting primitives" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

## Phase completion check

- [ ] Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → exit 0
- [ ] Run: `npx vitest run lib/` → all suites pass (zoned 11, csv 9, normalize 5, flow-params 10)
- [ ] Run: `npm run build-storybook` → exit 0 (Shell stories incl. ModalLongBody / DrawerLongBody / DrawerFill render)
- [ ] Run: `grep -rin "fechar\|voltar\|shadow-bento\|charcoal\|salonId" lib/hooks/useScrollLock.ts lib/shell lib/time lib/export lib/list lib/flow-params.ts components/ui/BackLink.tsx components/ui/OriginLink.tsx components/ui/PreserveSearchLink.tsx components/ui/ContextualBackLink.tsx docs/links.md docs/flow-params.md docs/shells.md` → no output
