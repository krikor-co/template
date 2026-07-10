# Phase 4: i18n + Theme — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Port irene's zero-dependency i18n stack (`lib/i18n/`: types, resolvers, messages, formatters, providers, TimezoneSync, `setLocale`) and `lib/theme/` (next-themes ThemeProvider + ThemeToggle) into the template — generalized to `app.*` identifiers, English-first with pt-BR as the second seed locale, `persons.locale` DB fallback — and wire the root/auth layouts (html lang, ThemeProvider, TimezoneSync, LocaleProvider, viewport), with `docs/i18n.md` and a CLAUDE.md doc-index row.

**Depends on phases:** 1, 3

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE source repo: `/Users/luca/dev/winter-park/irene` (read-only reference — never modify).
- Identifiers: cookies `app.locale` / `app.tz`; localStorage theme key `app.theme.mode`; `DEFAULT_LOCALE = 'en'`; `SUPPORTED_LOCALES = ['en', 'pt-BR']`.
- Copy: English defaults everywhere. All user-facing copy overridable via props or `lib/i18n` messages. No hardcoded pt-BR anywhere in code defaults (pt-BR strings live ONLY inside the `ptBR` dictionary in `lib/i18n/messages.ts`).
- Table naming: template plural stays — schema imports are `persons`, `users` (irene used singular `person`, `user`).
- Effect is adopted: `setLocale` stays on the Effect stack via `tracedAction` from `lib/effect/traced.ts` (Phase 3).
- Migration story: schema changes **regenerate the baseline**. Procedure (phase 1 convention): `cd /Users/luca/dev/winter-park/template && rm -rf drizzle && npx drizzle-kit generate --name baseline` → `drizzle/0000_baseline.sql`. Runner `scripts/migrate.mjs` reads `./drizzle`. Phases touching `db/schema` serialize this step (see 00-INDEX parallelization note) — Task 4.2 is this phase's only schema touch.
- Test-file convention: `.test.ts` = vitest (from Phase 1), `.spec.ts` = Playwright.
- Verification gate for every task: at minimum `npx tsc --noEmit` clean; plus the task-appropriate command (`npx vitest run` for tested code, `npx next build` for layout/schema wiring, `npm run build-storybook` where stories render changed components).
- Every task ends with a git commit whose message ends with the trailer line:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Docs travel with code: this phase creates `docs/i18n.md` and adds its CLAUDE.md doc-index row (Task 4.12).
- Parallel-phase courtesy: Phase 2 (tokens) may also edit `app/layout.tsx` (body font-alias attributes, its Task 2.4). Task 4.10 deliberately touches ONLY the import lines, the `<html lang>` attribute, a new `viewport` export, and the children-wrapping — never the `<body>` attribute line. If the file already carries Phase 2's font aliasing, leave it untouched.

**Existing e2e copy assertions (must stay green):** `e2e/auth/resend-otp.spec.ts` asserts the literal strings `Resend code in \d+s`, `Resend code`, `Sending…`, `Code sent!`. All rewiring in Task 4.11 keeps English strings byte-identical (locale defaults to `en`), so these specs pass unchanged.

---

### Task 4.1: `lib/i18n/types.ts` — locale constants and guards (TDD)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/i18n/types.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/i18n/types.test.ts`
- Source (read-only): `/Users/luca/dev/winter-park/irene/lib/i18n/types.ts` (33 lines)

**Interfaces:**
- Consumes: vitest infra from Phase 1 Task 1.1 (`npx vitest run` collects co-located `*.test.ts`).
- Produces (every later task in this phase + Phases 5, 8, 11 rely on these):
  - `SUPPORTED_LOCALES = ['en', 'pt-BR'] as const`
  - `type Locale = typeof SUPPORTED_LOCALES[number]` (i.e. `'en' | 'pt-BR'`)
  - `LOCALE_COOKIE = 'app.locale'` (const string)
  - `TZ_COOKIE = 'app.tz'` (const string — new export, replaces irene's two hardcoded `'irene.tz'` literals)
  - `DEFAULT_LOCALE: Locale = 'en'`
  - `isLocale(value: string | null | undefined): value is Locale`
  - `normalizeLocale(value: string | null | undefined): Locale`

**Steps:**

- [ ] Step: write failing test — Write `/Users/luca/dev/winter-park/template/lib/i18n/types.test.ts` with exactly:
  ```ts
  import { describe, expect, it } from 'vitest'
  import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES, TZ_COOKIE, isLocale, normalizeLocale } from './types'

  describe('lib/i18n/types', () => {
    it('ships exactly the two seed locales, English first', () => {
      expect(SUPPORTED_LOCALES).toEqual(['en', 'pt-BR'])
      expect(DEFAULT_LOCALE).toBe('en')
    })

    it('uses app.* cookie identifiers (never irene.*)', () => {
      expect(LOCALE_COOKIE).toBe('app.locale')
      expect(TZ_COOKIE).toBe('app.tz')
    })

    it('isLocale accepts every supported locale and rejects everything else', () => {
      for (const l of SUPPORTED_LOCALES) expect(isLocale(l)).toBe(true)
      expect(isLocale('es')).toBe(false)
      expect(isLocale('EN')).toBe(false)
      expect(isLocale(null)).toBe(false)
      expect(isLocale(undefined)).toBe(false)
      expect(isLocale('')).toBe(false)
    })

    it('normalizeLocale falls back to DEFAULT_LOCALE for unknown values', () => {
      expect(normalizeLocale('pt-BR')).toBe('pt-BR')
      expect(normalizeLocale('xx')).toBe('en')
      expect(normalizeLocale(null)).toBe('en')
      expect(normalizeLocale(undefined)).toBe('en')
    })
  })
  ```
- [ ] Step: run test, expect FAIL — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/i18n/types.test.ts` → expected: exit 1, "Failed to resolve import ./types" (module does not exist yet).
- [ ] Step: implement — Write `/Users/luca/dev/winter-park/template/lib/i18n/types.ts` with exactly (partial port of irene's file; enumerated deltas: `SUPPORTED_LOCALES` drops `'es'`; `LOCALE_COOKIE` `'irene.locale'` → `'app.locale'`; NEW `TZ_COOKIE = 'app.tz'`; `DEFAULT_LOCALE` `'pt-BR'` → `'en'`; comments de-irene'd — "Irene is a pt-BR product" prose removed; `person.locale` → `persons.locale`):
  ```ts
  /**
   * BCP-47 tags for locales the app currently ships UI catalogues for.
   * Add to this list AND to `lib/i18n/messages.ts` when introducing a new
   * language; the locale resolvers and every consumer then pick it up
   * automatically.
   */
  export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const
  export type Locale = typeof SUPPORTED_LOCALES[number]

  /**
   * Name of the cookie that carries an explicit locale override. Set by the
   * `setLocale` server action (e.g. from a language picker) and read FIRST by
   * both the public and authed locale resolvers — it is the single source of a
   * user-chosen language, taking precedence over `persons.locale` and the
   * `DEFAULT_LOCALE` fallback.
   */
  export const LOCALE_COOKIE = 'app.locale'

  /**
   * Name of the cookie that carries the browser's IANA timezone. Written by
   * `<TimezoneSync>` (client, root layout) and read by `getCurrentTimezone`
   * (server). See `lib/i18n/getTimezone.ts` for why this is a cookie and not
   * a DB column.
   */
  export const TZ_COOKIE = 'app.tz'

  /**
   * The ultimate fallback locale. The template is English-first — every
   * surface (public AND authed) falls back to this when nothing more specific
   * (locale cookie, persons.locale) resolves.
   */
  export const DEFAULT_LOCALE: Locale = 'en'

  export function isLocale(value: string | null | undefined): value is Locale {
    return value !== null && value !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(value)
  }

  export function normalizeLocale(value: string | null | undefined): Locale {
    return isLocale(value) ? value : DEFAULT_LOCALE
  }
  ```
- [ ] Step: run test, expect PASS — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/i18n/types.test.ts` → expected: exit 0, 4 tests pass.
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add lib/i18n/types.ts lib/i18n/types.test.ts
  git commit -m "backport(i18n): locale constants + guards — en/pt-BR seed, app.* cookies

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4.2: `persons.locale` column + baseline migration regeneration

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/db/schema/persons.ts` (insert one column after the `name` line — after Phase 1 hardening the file is: id, email, name, createdAt/updatedAt timestamptz)
- Regenerate: `/Users/luca/dev/winter-park/template/drizzle/` (fresh `0000_*.sql` + `meta/`)
- Source (read-only): `/Users/luca/dev/winter-park/irene/db/schema/person.ts` line 22 (`locale: text("locale").notNull().default("pt-BR")`)

**Interfaces:**
- Consumes: Phase 1's hardened `db/schema/persons.ts`, Phase 1's baseline-regeneration procedure and `scripts/migrate.mjs` (reads `./drizzle`), Phase 1's `db/schema/schema-invariants.test.ts` (must stay green).
- Produces: `persons.locale: string` (NOT NULL, default `'en'`) — consumed by Task 4.4 (`getCurrentLocale` DB fallback) and by Phase 5 (register flow may set it) / Phase 6 (member profiles).

**Steps:**

- [ ] Step: apply generalization edit — in `/Users/luca/dev/winter-park/template/db/schema/persons.ts` replace:
  ```ts
    name:      text('name'),
  ```
  with:
  ```ts
    name:      text('name'),
    /**
     * BCP-47 tag for this person's preferred UI language (e.g. 'en', 'pt-BR').
     * Read by getCurrentLocale() as the authed fallback below the app.locale
     * cookie. Keep the default in sync with DEFAULT_LOCALE in lib/i18n/types.ts.
     */
    locale:    text('locale').notNull().default('en'),
  ```
  (Delta vs irene: table stays `persons` plural; default `"pt-BR"` → `'en'`; quote style adapted to template file.)
- [ ] Step: regenerate the baseline — Run: `cd /Users/luca/dev/winter-park/template && rm -rf drizzle && npx drizzle-kit generate --name baseline` → expected: exit 0, `drizzle/0000_baseline.sql` created (generate is offline; no DATABASE_URL needed).
- [ ] Step: verification —
  - Run: `ls /Users/luca/dev/winter-park/template/drizzle/*.sql | wc -l` → expected: `1`
  - Run: `grep -c "\"locale\" text DEFAULT 'en' NOT NULL" /Users/luca/dev/winter-park/template/drizzle/0000_*.sql` → expected: `1`
  - Run: `grep -c 'sessions_token_unique' /Users/luca/dev/winter-park/template/drizzle/0000_*.sql` → expected: `1` (no-regression check)
  - Run: `cd /Users/luca/dev/winter-park/template && npx vitest run` → expected: exit 0 (schema invariants still green — `locale` is text, not a timestamp).
  - Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add db/schema/persons.ts drizzle
  git commit -m "feat(db): persons.locale column (default 'en') + regenerated baseline

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4.3: Timezone stack — `getTimezone.ts`, `TimezoneProvider.tsx`, `TimezoneSync.tsx`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/i18n/getTimezone.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/i18n/TimezoneProvider.tsx`
- Create: `/Users/luca/dev/winter-park/template/lib/i18n/TimezoneSync.tsx`
- Sources (read-only): `/Users/luca/dev/winter-park/irene/lib/i18n/getTimezone.ts` (38 lines), `/Users/luca/dev/winter-park/irene/lib/i18n/TimezoneProvider.tsx` (30 lines), `/Users/luca/dev/winter-park/irene/lib/i18n/TimezoneSync.tsx` (33 lines)

**Interfaces:**
- Consumes: `TZ_COOKIE = 'app.tz'` from Task 4.1.
- Produces:
  - `getCurrentTimezone(): Promise<string>` (React-`cache()`d; IANA tz or `'UTC'`) — consumed by Task 4.4 (`getCurrentI18n`) and any server component
  - `TimezoneProvider({ timeZone, children }: { timeZone: string; children: ReactNode }): JSX` and `useTimezone(): string` — consumed by authed-area layouts (Phase 11 guard-shell work) and chart/date components (Phase 8)
  - `TimezoneSync(): null` (client, cookie writer) — mounted in root layout by Task 4.10

**Steps:**

- [ ] Step: implement `getTimezone.ts` — Write `/Users/luca/dev/winter-park/template/lib/i18n/getTimezone.ts` with exactly (deltas vs irene: hardcoded `'irene.tz'` at line 25 → `TZ_COOKIE` import; comment `irene.tz` → `app.tz`; comment path `app/_components/TimezoneSync.tsx` → `lib/i18n/TimezoneSync.tsx`; comment `person` → `persons`):
  ```ts
  import { cache } from 'react'
  import { cookies } from 'next/headers'
  import { TZ_COOKIE } from './types'

  /**
   * Resolve the current request's IANA timezone for display formatting.
   *
   * Looks for the `app.tz` cookie set by `<TimezoneSync>` on first client load
   * (see `lib/i18n/TimezoneSync.tsx`). Falls back to `UTC` when:
   *   - first visit (cookie not set yet — one cold render will use UTC)
   *   - the cookie value doesn't look like an IANA tz (`Region/City`)
   *
   * Why a cookie and not a DB column on `persons`: it works on auth pages and
   * public surfaces (no session needed), and stays in sync with the user's
   * actual device tz when they travel. The session-bound locale lives in the
   * DB because users may explicitly choose a language different from their
   * device; timezone they almost never want to override.
   *
   * **NEVER call this inside a `'use cache'` block** — `cookies()` is
   * forbidden in cached scopes. Resolve at the Component / layout layer and
   * pass into cached queries so it becomes part of the cache key.
   */
  export const getCurrentTimezone = cache(async (): Promise<string> => {
    try {
      const c = await cookies()
      const raw = c.get(TZ_COOKIE)?.value
      return looksLikeIanaTz(raw) ? raw! : 'UTC'
    } catch {
      return 'UTC'
    }
  })

  /** Cheap structural check — `Region/City` or `UTC` / `GMT`. */
  function looksLikeIanaTz(v: string | undefined): v is string {
    if (!v) return false
    if (v === 'UTC' || v === 'GMT') return true
    return /^[A-Za-z_]+\/[A-Za-z_\-+0-9/]+$/.test(v)
  }
  ```
- [ ] Step: port `TimezoneProvider.tsx` — Run: `cp /Users/luca/dev/winter-park/irene/lib/i18n/TimezoneProvider.tsx /Users/luca/dev/winter-park/template/lib/i18n/TimezoneProvider.tsx`, then apply ONE edit — replace:
  ```
   * timezone via `useTimezone()` without prop-drilling. The owner layout
   * resolves it server-side via `getCurrentTimezone()` (cookie-based) and
  ```
  with:
  ```
   * timezone via `useTimezone()` without prop-drilling. The mounting layout
   * resolves it server-side via `getCurrentTimezone()` (cookie-based) and
  ```
  (No other irene-isms exist in the file — verified: it is a plain context provider with `DEFAULT_TIMEZONE = 'UTC'`.)
- [ ] Step: implement `TimezoneSync.tsx` — Write `/Users/luca/dev/winter-park/template/lib/i18n/TimezoneSync.tsx` with exactly (deltas vs irene: both hardcoded `'irene.tz'` literals — line 21 `startsWith('irene.tz=')` and line 26 `document.cookie = \`irene.tz=...\`` — → `TZ_COOKIE` template literals; comment `irene.tz` → `app.tz`):
  ```tsx
  'use client'

  import { useEffect } from 'react'
  import { TZ_COOKIE } from './types'

  /**
   * Writes the browser's resolved IANA timezone into the `app.tz` cookie so
   * server components can render dates in the user's actual tz on subsequent
   * renders. Effect runs once on mount; cookie persists 1 year.
   *
   * On the very first cold render (cookie not yet set) the server falls back
   * to UTC — but the next navigation will pick up the cookie and render
   * correctly. Acceptable: dev / first-visit only.
   *
   * Renders nothing. Mounted in the root layout.
   */
  export function TimezoneSync() {
    useEffect(() => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (!tz) return
        const existing = document.cookie.split('; ').find((c) => c.startsWith(`${TZ_COOKIE}=`))?.split('=')[1]
        if (existing === tz) return
        // 1 year max-age. SameSite=Lax so it travels on same-site navigations.
        // No HttpOnly: we WANT JS to read this for client-side parity.
        const oneYear = 60 * 60 * 24 * 365
        document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=${oneYear}; SameSite=Lax`
      } catch {
        // Intl unavailable in this runtime — leave the cookie alone.
      }
    }, [])
    return null
  }
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -rn "irene" /Users/luca/dev/winter-park/template/lib/i18n/` → expected: no output.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add lib/i18n/getTimezone.ts lib/i18n/TimezoneProvider.tsx lib/i18n/TimezoneSync.tsx
  git commit -m "backport(i18n): timezone stack — app.tz cookie, server resolver, client sync + provider

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4.4: Locale resolvers — `getLocale.ts` (cookie → persons.locale → default)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/i18n/getLocale.ts`
- Source (read-only): `/Users/luca/dev/winter-park/irene/lib/i18n/getLocale.ts` (88 lines)

**Interfaces:**
- Consumes: Task 4.1 (`DEFAULT_LOCALE`, `LOCALE_COOKIE`, `isLocale`, `normalizeLocale`, `Locale`), Task 4.2 (`persons.locale`), Task 4.3 (`getCurrentTimezone`), template existing `getSession(): Promise<SessionPayload | null>` from `@/lib/auth/session` where `SessionPayload = { userId: string; email: string }` (note: `userId` is a STRING; `users.id` is integer — hence `Number(session.userId)` below), `db` from `@/db/drizzle`, `persons`/`users` from `@/db/schema`.
- Produces (consumed by Tasks 4.10/4.11 layouts, docs, and Phases 5/8/11):
  - `getCurrentLocale(): Promise<Locale>` — authed chain: `app.locale` cookie → `persons.locale` → `DEFAULT_LOCALE`
  - `getCurrentI18n(): Promise<{ locale: Locale; timeZone: string }>`
  - `getPublicLocale(): Promise<Locale>` — public chain: `app.locale` cookie → `DEFAULT_LOCALE`

**Steps:**

- [ ] Step: implement — Write `/Users/luca/dev/winter-park/template/lib/i18n/getLocale.ts` with exactly (enumerated deltas vs irene: line 5 `import { person, user } from '@/db/schema'` → `import { persons, users } from '@/db/schema'`; query identifiers `person.locale`/`user`/`person.id`/`user.personId`/`user.id` → plural equivalents; `eq(user.id, session.userId)` → `eq(users.id, Number(session.userId))` because template session payload carries a string id; comments: `irene.locale` → `app.locale` (×2), `person.locale` → `persons.locale` (×2), `DEFAULT_LOCALE` `(pt-BR)` → `(en)`, the "Irene is a Portuguese-first product…" paragraph replaced by generalized Accept-Language prose, "the auth-page picker" → "any language picker"):
  ```ts
  import { cache } from 'react'
  import { cookies } from 'next/headers'
  import { eq } from 'drizzle-orm'
  import { db } from '@/db/drizzle'
  import { persons, users } from '@/db/schema'
  import { getSession } from '@/lib/auth/session'
  import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, normalizeLocale, type Locale } from './types'
  import { getCurrentTimezone } from './getTimezone'

  /**
   * Read the explicit locale override from the `app.locale` cookie, if present
   * and valid. This is the highest-precedence signal for BOTH public and authed
   * surfaces — it is the only user-facing language override (set by the
   * `setLocale` action from any language picker).
   *
   * Returns `null` when the cookie is absent or holds an unsupported tag, so
   * callers can fall through to the next signal (persons.locale → DEFAULT_LOCALE).
   *
   * **NEVER call inside a `'use cache'` block** — reads `cookies()`.
   */
  async function getCookieLocale(): Promise<Locale | null> {
    const value = (await cookies()).get(LOCALE_COOKIE)?.value
    return isLocale(value) ? value : null
  }

  /**
   * Resolve the current request's locale for an AUTHENTICATED surface.
   *
   * Precedence:
   *   1. `app.locale` cookie (explicit user override)
   *   2. the session user's `persons.locale`
   *   3. `DEFAULT_LOCALE` (`en`)
   *
   * **NEVER call this inside a `'use cache'` block** — it reads `cookies()`
   * (and `getSession()` also reads cookies), which is forbidden in cached
   * scopes. Resolve locale at the Component layer (or in layout) and pass it
   * down as a parameter into any cached query that needs it (so the locale
   * becomes part of the cache key).
   */
  export const getCurrentLocale = cache(async (): Promise<Locale> => {
    const cookieLocale = await getCookieLocale()
    if (cookieLocale) return cookieLocale

    const session = await getSession()
    if (!session) return DEFAULT_LOCALE

    const [row] = await db
      .select({ locale: persons.locale })
      .from(users)
      .innerJoin(persons, eq(persons.id, users.personId))
      .where(eq(users.id, Number(session.userId)))
      .limit(1)

    return normalizeLocale(row?.locale)
  })

  /**
   * Bundle locale + timezone in one call so server components can do:
   *   const { locale, timeZone } = await getCurrentI18n()
   * and pass `{ timeZone }` into Intl formatter options. Both pieces are
   * cached per-request via React's `cache()`.
   */
  export const getCurrentI18n = cache(async (): Promise<{ locale: Locale; timeZone: string }> => {
    const [locale, timeZone] = await Promise.all([getCurrentLocale(), getCurrentTimezone()])
    return { locale, timeZone }
  })

  /**
   * Resolve a locale for unauthenticated / public surfaces (the auth flow and
   * any pre-login page).
   *
   * Precedence:
   *   1. `app.locale` cookie (explicit user override — a live picker)
   *   2. `DEFAULT_LOCALE` (`en`)
   *
   * The app deliberately does NOT auto-detect from the browser's
   * `Accept-Language` — the cookie is the only override; users opt into
   * another shipped language via a picker that calls `setLocale`.
   *
   * This reads `cookies()`, so it is safe to call from a layout but **NEVER**
   * from inside a `'use cache'` block.
   */
  export const getPublicLocale = cache(async (): Promise<Locale> => {
    const cookieLocale = await getCookieLocale()
    return cookieLocale ?? DEFAULT_LOCALE
  })
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0 (proves `persons.locale` from Task 4.2 resolves and the `Number()` bridge typechecks).
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add lib/i18n/getLocale.ts
  git commit -m "backport(i18n): locale resolvers — cookie > persons.locale > en, request-cached

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4.5: `messages.ts` — typed catalogue seeded with template copy (en + pt-BR)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/i18n/messages.ts`
- Source (read-only, STRUCTURE only): `/Users/luca/dev/winter-park/irene/lib/i18n/messages.ts` (562 KB, ~363 salon-domain references — the catalogue CONTENT does NOT port; only the module pattern does: per-locale dicts, one `Messages` type, `t(locale)` resolver, function-valued keys for parameters)

**Interfaces:**
- Consumes: `DEFAULT_LOCALE`, `Locale` from Task 4.1.
- Produces (consumed by Task 4.6 `useT`, Task 4.11 auth forms, Phase 5 auth rewrite, Phase 8 Toast):
  - `type Messages` (inferred `typeof en`) with groups: `common` (`save`, `saving`, `cancel`, `tryAgain`, `loading`, `optional`, `redirecting`: string), `toast` (`dismiss`, `undo`: string), `auth.identify` (`title`, `subtitle`, `emailLabel`, `emailPlaceholder`, `submit`, `submitting`: string), `auth.verify` (`title`, `subtitleBefore`, `codeLabel`, `submit`, `submitting`, `success`, `resend`, `resendSending`, `resendSent`: string; `resendWait: (seconds: number) => string`), `auth.register` (`title`, `subtitle`, `emailLabel`, `nameLabel`, `namePlaceholder`, `submit`, `submitting`, `success`: string)
  - `t(locale: Locale): Messages`

**Steps:**

- [ ] Step: implement — Write `/Users/luca/dev/winter-park/template/lib/i18n/messages.ts` with exactly (seeded ONLY with copy the template actually uses — the auth strings below are byte-identical to the current `LoginForm.tsx`/`VerifyForm.tsx`/`RegisterForm.tsx` English copy; `common` = the generic action words those forms use; `toast` = the two labels the Toast system consumes when it lands in Phase 8):
  ```ts
  import { DEFAULT_LOCALE, type Locale } from './types'

  /**
   * Message catalogue. Each locale exports the SAME shape — TypeScript
   * enforces this via `Messages` (inferred from the English catalogue below).
   * Plurals/parameters are pure functions so the call site reads naturally
   * and translators don't need a separate ICU runtime.
   *
   * Keys are nested by feature for grep-ability. Add features here, never
   * inline a new user-facing string in a component. English is the source
   * of truth for the shape; every other locale must conform to `Messages`.
   */

  // ─── English (source of truth for the Messages shape) ──────────────────────

  const en = {
    common: {
      save:        'Save changes',
      saving:      'Saving…',
      cancel:      'Cancel',
      tryAgain:    'Try again',
      loading:     'Loading…',
      optional:    '(optional)',
      redirecting: 'Redirecting…',
    },
    toast: {
      dismiss: 'Dismiss',
      undo:    'Undo',
    },
    auth: {
      identify: {
        title:            'Welcome back',
        subtitle:         'Enter your email to continue',
        emailLabel:       'Email',
        emailPlaceholder: 'you@example.com',
        submit:           'Log in',
        submitting:       'Checking for account…',
      },
      verify: {
        title:          'Check your email',
        subtitleBefore: 'We sent a 6-digit code to',
        codeLabel:      'Verification code',
        submit:         'Verify code',
        submitting:     'Verifying…',
        success:        'Verified! Redirecting…',
        resendWait:     (seconds: number) => `Resend code in ${seconds}s`,
        resend:         'Resend code',
        resendSending:  'Sending…',
        resendSent:     'Code sent!',
      },
      register: {
        title:           'Create your account',
        subtitle:        'Just your name to get started',
        emailLabel:      'Email',
        nameLabel:       'Name',
        namePlaceholder: 'Your name',
        submit:          'Create account',
        submitting:      'Creating account…',
        success:         'Account created! Redirecting…',
      },
    },
  }

  export type Messages = typeof en

  // ─── Português (Brasil) ─────────────────────────────────────────────────────

  const ptBR: Messages = {
    common: {
      save:        'Salvar alterações',
      saving:      'Salvando…',
      cancel:      'Cancelar',
      tryAgain:    'Tentar novamente',
      loading:     'Carregando…',
      optional:    '(opcional)',
      redirecting: 'Redirecionando…',
    },
    toast: {
      dismiss: 'Dispensar',
      undo:    'Desfazer',
    },
    auth: {
      identify: {
        title:            'Bem-vindo de volta',
        subtitle:         'Digite seu e-mail para continuar',
        emailLabel:       'E-mail',
        emailPlaceholder: 'voce@exemplo.com',
        submit:           'Entrar',
        submitting:       'Verificando conta…',
      },
      verify: {
        title:          'Confira seu e-mail',
        subtitleBefore: 'Enviamos um código de 6 dígitos para',
        codeLabel:      'Código de verificação',
        submit:         'Verificar código',
        submitting:     'Verificando…',
        success:        'Verificado! Redirecionando…',
        resendWait:     (seconds: number) => `Reenviar código em ${seconds}s`,
        resend:         'Reenviar código',
        resendSending:  'Enviando…',
        resendSent:     'Código enviado!',
      },
      register: {
        title:           'Crie sua conta',
        subtitle:        'Só seu nome para começar',
        emailLabel:      'E-mail',
        nameLabel:       'Nome',
        namePlaceholder: 'Seu nome',
        submit:          'Criar conta',
        submitting:      'Criando conta…',
        success:         'Conta criada! Redirecionando…',
      },
    },
  }

  // ─── Resolver ───────────────────────────────────────────────────────────────

  const dictionaries: Record<Locale, Messages> = {
    'en':    en,
    'pt-BR': ptBR,
  }

  /** Returns the message dictionary for `locale`, falling back to the default. */
  export function t(locale: Locale): Messages {
    return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE]
  }
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0 (the `ptBR: Messages` annotation proves shape parity). Run: `grep -ci "salon\|irene" /Users/luca/dev/winter-park/template/lib/i18n/messages.ts` → expected: `0`.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add lib/i18n/messages.ts
  git commit -m "backport(i18n): typed message catalogue — en source of truth, pt-BR seed

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4.6: `LocaleProvider.tsx` — `useLocale` / `useT`

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/i18n/LocaleProvider.tsx`
- Source (read-only): `/Users/luca/dev/winter-park/irene/lib/i18n/LocaleProvider.tsx` (38 lines)

**Interfaces:**
- Consumes: `DEFAULT_LOCALE`, `Locale` (Task 4.1); `t`, `Messages` (Task 4.5).
- Produces (consumed by Task 4.11 auth layout + forms, Phases 5/8):
  - `LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }): JSX`
  - `useLocale(): Locale` (context default `DEFAULT_LOCALE` — Storybook renders without a provider resolve to `'en'`)
  - `useT(): Messages` (memoized on locale)

**Steps:**

- [ ] Step: copy source — Run: `cp /Users/luca/dev/winter-park/irene/lib/i18n/LocaleProvider.tsx /Users/luca/dev/winter-park/template/lib/i18n/LocaleProvider.tsx`
- [ ] Step: apply generalization edits — ONE edit (the only irene-ism; verified: the rest of the file is a plain context + memoized `t`). Replace:
  ```
   * The owner layout is the single mount point — the locale is resolved
   * server-side via `getCurrentLocale()` and passed in here.
  ```
  with:
  ```
   * An area layout is the mount point — e.g. `app/auth/layout.tsx` resolves
   * the locale server-side via `getPublicLocale()` (authed areas use
   * `getCurrentLocale()`) and passes it in here.
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -n "owner" /Users/luca/dev/winter-park/template/lib/i18n/LocaleProvider.tsx` → expected: no output.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add lib/i18n/LocaleProvider.tsx
  git commit -m "backport(i18n): LocaleProvider + useLocale/useT client hooks

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4.7: `format.ts` — Intl formatters with locale-gated BR phone mask (TDD)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/i18n/format.ts`
- Create: `/Users/luca/dev/winter-park/template/lib/i18n/format.test.ts`
- Source (read-only): `/Users/luca/dev/winter-park/irene/lib/i18n/format.ts` (161 lines)

**Interfaces:**
- Consumes: `Locale` from Task 4.1.
- Produces (consumed by Phase 8 MoneyInput/charts/editorial components and any date-rendering section):
  - `formatDate(iso: string, locale: Locale, options?: Intl.DateTimeFormatOptions): string`
  - `formatDateTime(iso: string, locale: Locale, options?: Intl.DateTimeFormatOptions): string`
  - `formatTime(iso: string, locale: Locale, options?: Intl.DateTimeFormatOptions): string`
  - `formatPhone(raw: string | null | undefined, locale: Locale): string` — **signature change vs irene** (`formatPhone(raw)` → adds `locale`): BR mask applies ONLY when `locale === 'pt-BR'`; other locales return the trimmed raw value
  - `formatNumber(n: number, locale: Locale, options?: Intl.NumberFormatOptions): string`
  - `formatCurrency(n: number, locale: Locale, currency = 'USD'): string` (negative-zero snap preserved)
  - `currencySymbol(locale: Locale, currency = 'USD'): string`
  - `formatMoneyValue(n: number, locale: Locale): string`
  - `parseMoneyInput(str: string, locale: Locale): number | null`

**Steps:**

- [ ] Step: write failing test — Write `/Users/luca/dev/winter-park/template/lib/i18n/format.test.ts` with exactly (covers the NEW logic — the locale gate — plus the preserved BR grouping and never-mangle contract):
  ```ts
  import { describe, expect, it } from 'vitest'
  import { formatCurrency, formatPhone } from './format'

  describe('formatPhone (locale-gated BR mask)', () => {
    it('masks an 11-digit mobile with country code for pt-BR', () => {
      expect(formatPhone('5517997032910', 'pt-BR')).toBe('+55 (17) 99703-2910')
    })

    it('masks a 12-digit landline with country code for pt-BR', () => {
      expect(formatPhone('551732221234', 'pt-BR')).toBe('+55 (17) 3222-1234')
    })

    it('masks a 10-digit landline without country code for pt-BR', () => {
      expect(formatPhone('1732221234', 'pt-BR')).toBe('(17) 3222-1234')
    })

    it('never mangles unknown shapes — non-BR number stays intact under pt-BR', () => {
      expect(formatPhone('+4915112345678', 'pt-BR')).toBe('+4915112345678')
    })

    it('does NOT mask for en — returns the trimmed raw value unchanged', () => {
      expect(formatPhone(' 5517997032910 ', 'en')).toBe('5517997032910')
      expect(formatPhone('+55 (17) 99703-2910', 'en')).toBe('+55 (17) 99703-2910')
    })

    it('returns empty string for null/undefined/empty in any locale', () => {
      expect(formatPhone(null, 'en')).toBe('')
      expect(formatPhone(undefined, 'pt-BR')).toBe('')
      expect(formatPhone('', 'pt-BR')).toBe('')
    })
  })

  describe('formatCurrency (negative-zero snap, ported behaviour)', () => {
    it('renders sub-cent negative noise as a clean positive zero', () => {
      expect(formatCurrency(-0.004, 'en', 'USD')).toBe('$0.00')
    })
  })
  ```
- [ ] Step: run test, expect FAIL — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/i18n/format.test.ts` → expected: exit 1, "Failed to resolve import ./format" (module does not exist yet).
- [ ] Step: copy source — Run: `cp /Users/luca/dev/winter-park/irene/lib/i18n/format.ts /Users/luca/dev/winter-park/template/lib/i18n/format.ts`
- [ ] Step: apply generalization edits — ONE edit (the rest of the file — formatDate's default-injection logic, formatDateTime, formatTime, formatNumber, formatCurrency, currencySymbol, decimalSeparator, formatMoneyValue, parseMoneyInput, and the module header comment which references only `lib/i18n/getTimezone.ts` — is locale-parameterized and app-agnostic; verified, no other irene-isms). Replace the ENTIRE `formatPhone` block (its doc comment starting `/**` + ` * Format a stored phone string for display.` through the function's closing `}` — irene lines 54–100) with:
  ```ts
  /**
   * Format a stored phone string for display. The DB holds free-form / raw
   * numbers (e.g. `5517997032910`, `+55149832842347`), which read as a wall
   * of digits.
   *
   * The mask is LOCALE-GATED: for `pt-BR` it applies the Brazilian grouping
   * below; for every other locale the value is returned trimmed but otherwise
   * UNCHANGED (swap in `libphonenumber-js` if a locale needs real region-aware
   * display formatting).
   *
   *   pt-BR: `5517997032910`  → `+55 (17) 99703-2910`   (11-digit mobile, DDD + 9)
   *   pt-BR: `551732221234`   → `+55 (17) 3222-1234`    (10-digit landline, DDD + 8)
   *   pt-BR: `17997032910`    → `(17) 99703-2910`        (no country code)
   *
   * Strips a leading `+`/`00` and the `55` country code for grouping, then
   * regroups. Anything that doesn't fit a known BR shape is returned with a
   * leading `+` (if it started with one) and otherwise UNCHANGED — never throws,
   * never drops digits, so a malformed seed value still shows in full.
   */
  export function formatPhone(raw: string | null | undefined, locale: Locale): string {
    if (!raw) return ''
    const trimmed = String(raw).trim()
    if (locale !== 'pt-BR') return trimmed

    const digits = trimmed.replace(/\D/g, '')
    if (digits.length === 0) return trimmed

    // Pull off the BR country code (55) when present so we group the national
    // number; keep a flag so we can re-add the +55 prefix on a clean match.
    let national = digits
    let hadCountry = false
    if (national.length > 11 && national.startsWith('55')) {
      national = national.slice(2)
      hadCountry = true
    }

    const group = (ddd: string, rest: string): string => {
      const local =
        rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` :   // mobile
        rest.length === 8 ? `${rest.slice(0, 4)}-${rest.slice(4)}` :   // landline
        rest
      const body = `(${ddd}) ${local}`
      return hadCountry ? `+55 ${body}` : body
    }

    // DDD (2) + 8 or 9 digit subscriber number — the canonical BR national shape.
    if (national.length === 11 || national.length === 10) {
      return group(national.slice(0, 2), national.slice(2))
    }

    // Doesn't match a known shape — return the original (with a + if it had one),
    // never mangling or truncating an unexpected value.
    return trimmed.startsWith('+') ? `+${digits}` : trimmed
  }
  ```
- [ ] Step: run test, expect PASS — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/i18n/format.test.ts` → expected: exit 0, 7 tests pass.
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add lib/i18n/format.ts lib/i18n/format.test.ts
  git commit -m "backport(i18n): Intl formatters — locale-gated BR phone mask, money helpers

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4.8: `setLocale.ts` server action on the Effect stack

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/i18n/setLocale.ts`
- Source (read-only): `/Users/luca/dev/winter-park/irene/lib/i18n/setLocale.ts` (37 lines)

**Interfaces:**
- Consumes: `tracedAction<T>(name: string, attributes: Record<string, string | number | boolean | undefined>, fn: () => Promise<T>): Promise<T>` from `/Users/luca/dev/winter-park/template/lib/effect/traced.ts` (Phase 3 Task 3.8); `isLocale`, `LOCALE_COOKIE`, `Locale` from Task 4.1.
- Produces: `setLocale(locale: Locale): Promise<{ success: boolean }>` (`'use server'`) — consumed by any future language-picker section (none ships in this phase; docs show the call pattern; Phase 5's auth surfaces may add a picker).

**Steps:**

- [ ] Step: implement — Write `/Users/luca/dev/winter-park/template/lib/i18n/setLocale.ts` with exactly (deltas vs irene: comment `irene.locale` → `app.locale`; "overrides `person.locale` and the pt-BR default" → "overrides `persons.locale` and the `DEFAULT_LOCALE` fallback"; "letting the pre-auth picker switch the whole app live" → "letting any picker switch the whole app live"; code otherwise byte-identical — `tracedAction` name and shape match Phase 3's port):
  ```ts
  'use server'

  import { cookies } from 'next/headers'
  import { revalidatePath } from 'next/cache'
  import { tracedAction } from '@/lib/effect/traced'
  import { isLocale, LOCALE_COOKIE, type Locale } from './types'

  const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

  /**
   * Set the explicit locale override cookie (`app.locale`).
   *
   * Validates that `locale` is one of `SUPPORTED_LOCALES`, writes a year-long
   * cookie at path `/`, then revalidates so the new language takes effect on the
   * next render. This cookie is read FIRST by both `getPublicLocale` and
   * `getCurrentLocale`, so it overrides `persons.locale` and the `DEFAULT_LOCALE`
   * fallback — letting any picker switch the whole app live.
   *
   * Returns `{ success }` so the caller (the client picker) can decide whether
   * to `router.refresh()`. Never throws on a bad locale — it no-ops instead.
   */
  export async function setLocale(locale: Locale): Promise<{ success: boolean }> {
    return tracedAction('setLocale', { locale }, async () => {
      if (!isLocale(locale)) return { success: false }

      const store = await cookies()
      store.set(LOCALE_COOKIE, locale, {
        path: '/',
        maxAge: ONE_YEAR_SECONDS,
        sameSite: 'lax',
      })

      revalidatePath('/')
      return { success: true }
    })
  }
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0 (proves the Phase 3 `tracedAction` import path + signature line up).
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add lib/i18n/setLocale.ts
  git commit -m "backport(i18n): setLocale action — app.locale cookie via tracedAction

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4.9: `lib/theme/` — ThemeProvider + ThemeToggle (next-themes)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/theme/ThemeProvider.tsx`
- Create: `/Users/luca/dev/winter-park/template/lib/theme/ThemeToggle.tsx`
- Modify: `/Users/luca/dev/winter-park/template/package.json` (dependencies — add `next-themes`)
- Sources (read-only): `/Users/luca/dev/winter-park/irene/lib/theme/ThemeProvider.tsx` (33 lines), `/Users/luca/dev/winter-park/irene/lib/theme/ThemeToggle.tsx` (69 lines)

**Interfaces:**
- Consumes: template `app/globals.css` `.dark` CSS-variable block (already present pre-backport; Phase 2 extends it with triads + `color-scheme`). NO i18n import — toggle copy arrives via props by design.
- Produces (consumed by Task 4.10 root layout; ThemeToggle by future app chrome / Phase 8 stories):
  - `ThemeProvider({ children }: { children: ReactNode }): JSX` — next-themes, `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `storageKey="app.theme.mode"`, **NO `disableTransitionOnChange`**
  - `ThemeToggle({ className?, labels? }: { className?: string; labels?: ThemeToggleLabels }): JSX`
  - `type ThemeToggleLabels = { toggle: string; light: string; dark: string; system: string }` (English defaults baked in)

**Steps:**

- [ ] Step: install dependency — Run: `cd /Users/luca/dev/winter-park/template && npm install "next-themes@^0.4.6"` → expected: exit 0, `next-themes` in `package.json` dependencies (same version range as irene).
- [ ] Step: port `ThemeProvider.tsx` — Run: `mkdir -p /Users/luca/dev/winter-park/template/lib/theme && cp /Users/luca/dev/winter-park/irene/lib/theme/ThemeProvider.tsx /Users/luca/dev/winter-park/template/lib/theme/ThemeProvider.tsx`, then apply TWO edits:
  1. Replace:
  ```
   * `defaultTheme="system"` follows the user's OS preference until they
   * explicitly toggle. `attribute="class"` flips between `<html class="">`
   * and `<html class="dark">`.
  ```
  with:
  ```
   * `defaultTheme="system"` follows the user's OS preference until they
   * explicitly toggle. `attribute="class"` flips between `<html class="">`
   * and `<html class="dark">`. Persistence lives in
   * localStorage['app.theme.mode'] (`storageKey` below — the `app.` prefix
   * matches the app.locale / app.tz cookie identifiers).
  ```
  2. Replace:
  ```tsx
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
      >
  ```
  with:
  ```tsx
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="app.theme.mode"
      >
  ```
  The WebKit paragraph (`NOTE: \`disableTransitionOnChange\` is intentionally OMITTED. It injects a \`*{transition:none}\` <style> + a \`getComputedStyle\` reflow trick around the class swap; on mobile Safari/WebKit that sequence leaves the page painted in the OLD theme until a scroll/refresh (desktop repaints fine) — which was the "theme only changes after refresh on mobile" bug…`) ports VERBATIM — do not touch it; it is the reason this file exists as a documented primitive.
- [ ] Step: implement `ThemeToggle.tsx` — Write `/Users/luca/dev/winter-park/template/lib/theme/ThemeToggle.tsx` with exactly (deltas vs irene: `import { useT } from '@/lib/i18n/LocaleProvider'` and `const m = useT()` REMOVED — copy arrives via a `labels` prop with English defaults so the toggle has no hard i18n coupling; `m.theme[active]` → `labels[active]`, `m.theme.toggle` → `labels.toggle`; comment `localStorage['theme']` → `localStorage['app.theme.mode']`; irene's history aside about its dropped time-of-day auto mode removed; the mobile two-instance stale-state comment ports verbatim — it is a generic next-themes lesson):
  ```tsx
  'use client'

  import { useEffect, useState } from 'react'
  import { useTheme } from 'next-themes'

  /**
   * Theme cycle: light → dark → system → light.
   *
   * next-themes is the SINGLE source of truth — it owns the `<html>` class, the
   * `system` media-query resolution, and persistence (localStorage['app.theme.mode']).
   *
   * IMPORTANT: we deliberately keep NO parallel `mode` state, no second
   * localStorage key, and no `useEffect` that pushes into `setTheme`. The old
   * version did, which broke on mobile: at mobile width the desktop sidebar is
   * `display:none` but still MOUNTED, so TWO toggle instances existed (the hidden
   * desktop one + the drawer one), each with its own `mode` state and an effect
   * with `setTheme` in its deps. Toggling in the drawer changed next-themes →
   * every instance got a fresh `setTheme` reference → the hidden desktop toggle's
   * effect re-fired with its STALE mode and re-applied the old theme → the visible
   * "blink then revert to old, only sticks after refresh". Reading next-themes
   * directly means both instances always agree and nothing re-applies a stale value.
   */
  const NEXT: Record<'light' | 'dark' | 'system', 'light' | 'dark' | 'system'> = {
    light: 'dark', dark: 'system', system: 'light',
  }

  export type ThemeToggleLabels = {
    toggle: string
    light:  string
    dark:   string
    system: string
  }

  /**
   * Copy arrives via the `labels` prop (English defaults) instead of `useT()`
   * so the toggle carries no hard dependency on the i18n stack — localized
   * apps pass labels from a `useT()` call site.
   */
  const DEFAULT_LABELS: ThemeToggleLabels = {
    toggle: 'Toggle theme',
    light:  'Light',
    dark:   'Dark',
    system: 'System',
  }

  export function ThemeToggle({
    className = '',
    labels = DEFAULT_LABELS,
  }: {
    className?: string
    labels?:    ThemeToggleLabels
  }) {
    const { theme, resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    // Placeholder until mounted so SSR markup matches (theme is client-only).
    // No theme writes happen here — next-themes already applied the class pre-paint.
    useEffect(() => setMounted(true), [])

    if (!mounted) {
      return <span className={'inline-block h-8 w-8 ' + className} aria-hidden="true" />
    }

    const active: 'light' | 'dark' | 'system' =
      theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system'
    const resolved = resolvedTheme === 'dark' ? 'dark' : 'light'
    const label = labels[active]
    const icon =
        active === 'system' ? '🖥'
      : resolved === 'dark' ? '🌙'
      :                       '☀️'

    return (
      <button
        type="button"
        onClick={() => setTheme(NEXT[active])}
        title={`${labels.toggle} (${label})`}
        aria-label={`${labels.toggle}: ${label}`}
        className={
          'inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-sm transition-colors hover:bg-muted ' +
          className
        }
      >
        <span aria-hidden="true">{icon}</span>
        <span className="sr-only">{label}</span>
      </button>
    )
  }
  ```
  (No Storybook story: irene's ThemeToggle had none — nothing to port per the stories rule.)
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `npx eslint lib/theme` → expected: exit 0. Run: `grep -c "from '@/lib/i18n" /Users/luca/dev/winter-park/template/lib/theme/ThemeToggle.tsx` → expected: `0` (no i18n import — props only).
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add lib/theme/ThemeProvider.tsx lib/theme/ThemeToggle.tsx package.json package-lock.json
  git commit -m "backport(theme): next-themes provider (app.theme.mode, WebKit note) + props-labeled toggle

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4.10: Root layout wiring — `<html lang>`, ThemeProvider, TimezoneSync, viewport export

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/app/layout.tsx` (20 lines pre-backport; Phase 2 Task 2.4 may have already edited the font const line 5 / `<body>` attribute line 15 — the edits below do not overlap those lines)
- Source (read-only): `/Users/luca/dev/winter-park/irene/app/layout.tsx` lines 1, 3–5, 39–50, 52–68 (Fraunces/JetBrains_Mono, ToastProvider, and irene metadata do NOT port — fonts are Phase 2's business, ToastProvider is Phase 8's)

**Interfaces:**
- Consumes: `DEFAULT_LOCALE` (Task 4.1), `TimezoneSync` (Task 4.3), `ThemeProvider` (Task 4.9).
- Produces: root layout mounts `TimezoneSync` + `ThemeProvider`, sets `<html lang={DEFAULT_LOCALE}>`, and exports `viewport: Viewport` with `interactiveWidget: 'resizes-content'` — Phase 7 Drawer `h-[100dvh]` work and Phase 11 app-pattern docs rely on this viewport export existing.

**Steps:**

- [ ] Step: apply generalization edits — in `/Users/luca/dev/winter-park/template/app/layout.tsx`, exactly these five edits (each anchor is unique in the file):
  1. Replace:
  ```ts
  import type { Metadata } from 'next'
  ```
  with:
  ```ts
  import type { Metadata, Viewport } from 'next'
  ```
  2. Replace:
  ```ts
  import './globals.css'
  ```
  with:
  ```ts
  import { DEFAULT_LOCALE } from '@/lib/i18n/types'
  import { TimezoneSync } from '@/lib/i18n/TimezoneSync'
  import { ThemeProvider } from '@/lib/theme/ThemeProvider'
  import './globals.css'
  ```
  3. Insert AFTER the closing `}` of the `export const metadata` block (and before `export default function RootLayout`) — irene's viewport block with the comment de-irene'd ("the Irene quick-ask drawer's pinned composer" → generic drawers/modals prose) plus irene's root-layout locale comment generalized ("the owner layout" → area layouts):
  ```ts
  /**
   * `interactiveWidget: 'resizes-content'` makes the on-screen keyboard SHRINK
   * the layout viewport instead of overlaying it. Full-height `100dvh` surfaces
   * (drawers/modals with bottom-pinned composers or submit bars) then ride just
   * above the keyboard with no dead gap and nothing hidden behind it. Keeps the
   * standard mobile defaults (`width=device-width, initial-scale=1`).
   */
  export const viewport: Viewport = {
    width:             'device-width',
    initialScale:      1,
    interactiveWidget: 'resizes-content',
  }

  /**
   * Root layout uses DEFAULT_LOCALE for the `<html lang>` attribute. Any
   * per-user locale override happens client-side via `LocaleProvider`
   * (mounted by area layouts, e.g. `app/auth/layout.tsx`) — keeping this
   * server component synchronous means root navigation never blocks per
   * Next 16 Cache Components.
   */
  ```
  4. Replace:
  ```tsx
      <html lang="en" suppressHydrationWarning>
  ```
  with:
  ```tsx
      <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
  ```
  5. Replace (children line only — do NOT touch the `<body ...>` attribute line, which Phase 2 may own):
  ```tsx
          {children}
  ```
  with:
  ```tsx
          <TimezoneSync />
          <ThemeProvider>{children}</ThemeProvider>
  ```
  (`suppressHydrationWarning` on `<html>` is already present — required by next-themes' pre-paint class script; do not duplicate it.)
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `npx eslint app/layout.tsx` → expected: exit 0. Run: `cd /Users/luca/dev/winter-park/template && npx next build` → expected: exit 0 (requires `.env` `DATABASE_URL`, same as every build; proves the providers mount without client/server boundary errors).
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add app/layout.tsx
  git commit -m "backport(app): root layout — html lang, ThemeProvider, TimezoneSync, resizes-content viewport

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4.11: Auth layout LocaleProvider + wire auth-flow copy through `useT`

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/app/auth/layout.tsx` (17 lines)
- Modify: `/Users/luca/dev/winter-park/template/app/auth/identify/_components/LoginForm/LoginForm.tsx` (87 lines)
- Modify: `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/VerifyForm.tsx` (131 lines)
- Modify: `/Users/luca/dev/winter-park/template/app/auth/register/_components/RegisterForm/RegisterForm.tsx` (105 lines)
- Source (read-only): `/Users/luca/dev/winter-park/irene/app/auth/layout.tsx` (the LocaleProvider mount pattern — template's layout is identical to irene's minus the two i18n lines)
- Test (existing, must stay green): `/Users/luca/dev/winter-park/template/e2e/auth/*.spec.ts` — English strings stay byte-identical, so no e2e edits

**Interfaces:**
- Consumes: `LocaleProvider`, `useT` (Task 4.6), `getPublicLocale` (Task 4.4), `Messages` shape (Task 4.5).
- Produces: auth area renders all user-facing copy from `lib/i18n/messages.ts` (the seeded keys are now live, not dead data). Phase 5's dual-identifier rewrite builds on these `m.auth.*` call sites — it must extend `messages.ts` (e.g. identifier-based labels), never re-inline strings.

**Steps:**

- [ ] Step: mount LocaleProvider in the auth layout — in `/Users/luca/dev/winter-park/template/app/auth/layout.tsx` apply exactly (mirrors irene's auth-layout delta):
  1. After the line `import { entry as dashboardEntry } from "@/app/dashboard/entry"` add:
  ```tsx
  import { LocaleProvider } from "@/lib/i18n/LocaleProvider"
  import { getPublicLocale } from "@/lib/i18n/getLocale"
  ```
  2. Replace:
  ```tsx
    return <>{children}</>
  ```
  with:
  ```tsx
    const locale = await getPublicLocale()

    return <LocaleProvider locale={locale}>{children}</LocaleProvider>
  ```
- [ ] Step: wire LoginForm — in `/Users/luca/dev/winter-park/template/app/auth/identify/_components/LoginForm/LoginForm.tsx` apply exactly (all English output stays byte-identical at the default locale):
  1. After `import { useFormValues } from '@/lib/hooks/useFormValues'` add: `import { useT } from '@/lib/i18n/LocaleProvider'`
  2. After `const form = useFormValues()` add: `const m = useT()`
  3. Replace ALL (2 occurrences): `<h1 className="mb-2 text-3xl font-semibold tracking-tight">Welcome back</h1>` → `<h1 className="mb-2 text-3xl font-semibold tracking-tight">{m.auth.identify.title}</h1>`
  4. Replace ALL (2): `<p className="text-muted-foreground">Enter your email to continue</p>` → `<p className="text-muted-foreground">{m.auth.identify.subtitle}</p>`
  5. Replace ALL (2): `<Label htmlFor="email">Email</Label>` → `<Label htmlFor="email">{m.auth.identify.emailLabel}</Label>`
  6. Replace ALL (2): `placeholder="you@example.com"` → `placeholder={m.auth.identify.emailPlaceholder}`
  7. Replace (1): `{state.status === 'submitting' ? 'Checking for account…' : 'Log in'}` → `{state.status === 'submitting' ? m.auth.identify.submitting : m.auth.identify.submit}`
  8. Replace (1): `<p className="text-sm text-muted-foreground">Redirecting…</p>` → `<p className="text-sm text-muted-foreground">{m.common.redirecting}</p>`
  9. Replace (1, the success-state button child between `<Button key="submit" type="button" disabled>` and `</Button>`): `Redirecting…` → `{m.common.redirecting}`
- [ ] Step: wire VerifyForm — in `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/VerifyForm.tsx` apply exactly:
  1. After `import { useFormValues } from '@/lib/hooks/useFormValues'` add: `import { useT } from '@/lib/i18n/LocaleProvider'`
  2. After `const form = useFormValues()` add: `const m = useT()`
  3. Replace ALL (2): `<h1 className="mb-2 text-3xl font-semibold tracking-tight">Check your email</h1>` → `<h1 className="mb-2 text-3xl font-semibold tracking-tight">{m.auth.verify.title}</h1>`
  4. Replace ALL (2): `We sent a 6-digit code to <strong>{state.email}</strong>` → `{m.auth.verify.subtitleBefore} <strong>{state.email}</strong>`
  5. Replace ALL (2): `<Label htmlFor="code">Verification code</Label>` → `<Label htmlFor="code">{m.auth.verify.codeLabel}</Label>`
  6. Replace (1): `{state.status === 'submitting' ? 'Verifying…' : 'Verify code'}` → `{state.status === 'submitting' ? m.auth.verify.submitting : m.auth.verify.submit}`
  7. Replace (1): `<p className="text-muted-foreground">Resend code in {resendOtp.secondsLeft}s</p>` → `<p className="text-muted-foreground">{m.auth.verify.resendWait(resendOtp.secondsLeft)}</p>`
  8. Replace (1, the `resendOtp.status === 'ready'` button child): `Resend code` → `{m.auth.verify.resend}`
  9. Replace (1): `<p className="text-muted-foreground">Sending…</p>` → `<p className="text-muted-foreground">{m.auth.verify.resendSending}</p>`
  10. Replace (1): `<p className="text-muted-foreground">Code sent!</p>` → `<p className="text-muted-foreground">{m.auth.verify.resendSent}</p>`
  11. Replace (1, the `resendOtp.status === 'error'` retry button child): `Try again` → `{m.common.tryAgain}`
  12. Replace (1): `<p className="text-sm text-muted-foreground">Verified! Redirecting…</p>` → `<p className="text-sm text-muted-foreground">{m.auth.verify.success}</p>`
  13. Replace (1, the success-state button child): `Redirecting…` → `{m.common.redirecting}`
- [ ] Step: wire RegisterForm — in `/Users/luca/dev/winter-park/template/app/auth/register/_components/RegisterForm/RegisterForm.tsx` apply exactly:
  1. After `import { useFormValues } from '@/lib/hooks/useFormValues'` add: `import { useT } from '@/lib/i18n/LocaleProvider'`
  2. After `const form = useFormValues()` add: `const m = useT()`
  3. Replace ALL (2): `<h1 className="mb-2 text-3xl font-semibold tracking-tight">Create your account</h1>` → `<h1 className="mb-2 text-3xl font-semibold tracking-tight">{m.auth.register.title}</h1>`
  4. Replace ALL (2): `<p className="text-muted-foreground">Just your name to get started</p>` → `<p className="text-muted-foreground">{m.auth.register.subtitle}</p>`
  5. Replace ALL (2): `<Label>Email</Label>` → `<Label>{m.auth.register.emailLabel}</Label>`
  6. Replace ALL (2): `Name <span className="text-muted-foreground">(optional)</span>` → `{m.auth.register.nameLabel} <span className="text-muted-foreground">{m.common.optional}</span>`
  7. Replace ALL (2): `placeholder="Your name"` → `placeholder={m.auth.register.namePlaceholder}`
  8. Replace (1): `{state.status === 'submitting' ? 'Creating account…' : 'Create account'}` → `{state.status === 'submitting' ? m.auth.register.submitting : m.auth.register.submit}`
  9. Replace (1): `<p className="text-sm text-muted-foreground">Account created! Redirecting…</p>` → `<p className="text-sm text-muted-foreground">{m.auth.register.success}</p>`
  10. Replace (1, the success-state button child): `Redirecting…` → `{m.common.redirecting}`
  (Server-action error strings in the three `actions.ts` files stay hardcoded English in this phase — Phase 5 rewrites those actions on the Effect boundary and owns their error copy. The `placeholder="000000"` OTP hint is numeric/locale-neutral and stays literal.)
- [ ] Step: verification —
  - Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
  - Run: `cd /Users/luca/dev/winter-park/template && npx eslint app/auth` → expected: exit 0.
  - Run: `grep -rn "Welcome back\|Enter your email\|Check your email\|Verification code\|Create your account\|Just your name\|Resend code\|Code sent\|Try again\|Redirecting…" /Users/luca/dev/winter-park/template/app/auth --include="*.tsx" | grep -v "stories\|fixtures"` → expected: no output (all rendered copy now flows from messages; stories/fixtures may keep literals — they render the same English).
  - Run: `cd /Users/luca/dev/winter-park/template && npm run build-storybook` → expected: exit 0 (forms render outside a LocaleProvider via the `DEFAULT_LOCALE` context default → identical English output).
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add app/auth/layout.tsx app/auth/identify/_components/LoginForm/LoginForm.tsx app/auth/verify/_components/VerifyForm/VerifyForm.tsx app/auth/register/_components/RegisterForm/RegisterForm.tsx
  git commit -m "backport(i18n): mount LocaleProvider in auth layout, wire auth-flow copy through useT

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4.12: `docs/i18n.md` + CLAUDE.md doc-index row

**Files:**
- Create: `/Users/luca/dev/winter-park/template/docs/i18n.md`
- Modify: `/Users/luca/dev/winter-park/template/CLAUDE.md` (doc table — insert one row after the `rate-limiting.md` row)

**Interfaces:**
- Consumes: everything this phase produced (documents it).
- Produces: `docs/i18n.md` served at `/docs/i18n` (frontmatter `category: Infrastructure`, `order: 8`; the `/docs` site auto-discovers `docs/*.md` via `lib/docs.ts` — no registration); the "never resolve locale inside `use cache`" contract in writing — Phase 11's docs sweep and Phase 8's component docs link here.

**Steps:**

- [ ] Step: write the doc — Write `/Users/luca/dev/winter-park/template/docs/i18n.md` with exactly:
  ````markdown
  ---
  title: Internationalization
  order: 8
  category: Infrastructure
  ---

  # i18n — Locale, Messages, Timezone, Theme Providers

  The template ships a **zero-dependency i18n stack** in `lib/i18n/` — no i18n
  library, no ICU runtime. Locales are typed, messages are a plain typed object,
  formatting is `Intl`. Seed locales: `en` (default, source of truth) and `pt-BR`.

  | File | What it is |
  |------|-----------|
  | `lib/i18n/types.ts` | `SUPPORTED_LOCALES`, `Locale`, `DEFAULT_LOCALE = 'en'`, cookie names `LOCALE_COOKIE = 'app.locale'` / `TZ_COOKIE = 'app.tz'`, guards |
  | `lib/i18n/getLocale.ts` | Server resolvers: `getCurrentLocale` (authed), `getPublicLocale` (public), `getCurrentI18n` (locale + tz) |
  | `lib/i18n/getTimezone.ts` | `getCurrentTimezone` — IANA tz from the `app.tz` cookie, `UTC` fallback |
  | `lib/i18n/messages.ts` | Typed catalogue: `t(locale): Messages`, one dict per locale, same shape enforced |
  | `lib/i18n/LocaleProvider.tsx` | Client context: `useLocale()`, `useT()` |
  | `lib/i18n/TimezoneProvider.tsx` | Client context: `useTimezone()` |
  | `lib/i18n/TimezoneSync.tsx` | Client cookie-writer, mounted once in the root layout |
  | `lib/i18n/format.ts` | `Intl` wrappers: dates, numbers, currency, money-input helpers, locale-gated phone mask |
  | `lib/i18n/setLocale.ts` | `'use server'` action that writes the `app.locale` override cookie |
  | `lib/theme/ThemeProvider.tsx` | next-themes wrapper (documented WebKit gotcha) |
  | `lib/theme/ThemeToggle.tsx` | light → dark → system cycle button, copy via props |

  ## The resolution chain

  **Authed surfaces** — `getCurrentLocale()`:

  1. `app.locale` cookie (explicit user override, set by `setLocale`)
  2. the session user's `persons.locale` (DB column, default `'en'`)
  3. `DEFAULT_LOCALE` (`'en'`)

  **Public surfaces** (auth flow, pre-login pages) — `getPublicLocale()`:

  1. `app.locale` cookie
  2. `DEFAULT_LOCALE`

  The app deliberately does **not** sniff `Accept-Language` — the cookie is the
  only override, so rendering is deterministic and cache-friendly. Both resolvers
  are wrapped in React `cache()` (one resolution per request).

  ## The `'use cache'` contract (critical)

  > **Never resolve locale (or timezone, or session) inside a `'use cache'`
  > scope.** `getCurrentLocale`, `getPublicLocale`, `getCurrentTimezone`,
  > `getCurrentI18n`, and `getSession` all read `cookies()`, which is forbidden
  > inside cached scopes — and even if it worked, it would bake one user's
  > locale into a shared cache entry.

  Resolve at the page / layout / section layer and **pass the locale in as a
  parameter** — the argument makes locale part of the cache key:

  ```tsx
  // ✅ resolve outside, pass in
  export async function ProductsSection() {
    const { locale, timeZone } = await getCurrentI18n()
    const rows = await getProducts(locale)   // locale is part of the cache key
    return <ProductList rows={rows} locale={locale} timeZone={timeZone} />
  }

  async function getProducts(locale: Locale) {
    'use cache'
    // ... tagWith(...), query, format with `locale` ...
  }

  // ❌ never — cookies() inside a cached scope
  async function getProductsBroken() {
    'use cache'
    const locale = await getCurrentLocale() // build error / poisoned cache
  }
  ```

  ## Messages

  `lib/i18n/messages.ts` holds one dictionary per locale, all conforming to the
  `Messages` type inferred from the English catalogue. Parameterized strings are
  plain functions (`resendWait: (seconds) => ...`).

  - **Add a string:** add the key to `en` (shape source of truth), then to every
    other dictionary — TypeScript errors until all locales conform. Never inline
    a new user-facing string in a component.
  - **Add a locale:** append the tag to `SUPPORTED_LOCALES` in `types.ts` and add
    the dictionary in `messages.ts`. Resolvers, provider, and picker plumbing
    pick it up automatically.

  **Client components** read messages via `useT()` (requires a mounted
  `LocaleProvider`; outside one it falls back to `DEFAULT_LOCALE`, which is what
  Storybook stories render):

  ```tsx
  const m = useT()
  return <Button>{m.common.save}</Button>
  ```

  **Server components** resolve then translate:

  ```tsx
  const locale = await getCurrentLocale()   // or getPublicLocale() pre-login
  const m = t(locale)
  ```

  ## Changing language — `setLocale`

  `setLocale(locale)` is a `'use server'` action (traced via `tracedAction`) that
  validates the tag, writes the year-long `app.locale` cookie, and calls
  `revalidatePath('/')`. A picker calls it and then refreshes:

  ```tsx
  const { success } = await setLocale('pt-BR')
  if (success) router.refresh()
  ```

  ## Timezone

  Timezone is a **cookie, not a DB column**: it works on public surfaces (no
  session needed) and stays correct when the user travels. Language, by
  contrast, is a deliberate user choice → DB (`persons.locale`).

  - `<TimezoneSync />` (root layout) writes the browser's IANA tz into `app.tz`
    once per mount. First-ever render falls back to `UTC`; the next navigation
    is correct.
  - Server: `getCurrentTimezone()` / `getCurrentI18n()` → pass `timeZone` into
    `Intl` options so server and client agree on displayed wall-clock times.
  - Client subtrees: mount `<TimezoneProvider timeZone={...}>` in an authed area
    layout and read `useTimezone()`.

  ## Formatters (`lib/i18n/format.ts`)

  All take an explicit `locale` so server output never drifts to the host's
  default. `formatDate` injects a `dd/MM/yyyy`-style default ONLY when the caller
  requests no date component. `formatCurrency` snaps sub-cent negative noise to a
  clean `0`. Money-input helpers (`formatMoneyValue`, `parseMoneyInput`,
  `currencySymbol`) round-trip user-typed amounts in any locale.

  `formatPhone(raw, locale)` is **locale-gated**: it applies a Brazilian display
  mask for `pt-BR` (`5517997032910` → `+55 (17) 99703-2910`) and returns the raw
  value trimmed-but-unchanged for every other locale. It never throws and never
  drops digits. Swap in `libphonenumber-js` if a locale needs real region-aware
  formatting.

  ## Provider wiring — who mounts what

  | Layout | Mounts | Why |
  |--------|--------|-----|
  | `app/layout.tsx` (root) | `<html lang={DEFAULT_LOCALE}>`, `<TimezoneSync />`, `<ThemeProvider>` | Root stays synchronous (Cache Components); per-user locale arrives lower via LocaleProvider |
  | `app/auth/layout.tsx` | `<LocaleProvider locale={await getPublicLocale()}>` | Pre-login language (cookie or default) |
  | Authed area layouts | `<LocaleProvider>` + `<TimezoneProvider>` from `await getCurrentI18n()` | Session-aware locale + device tz for client subtrees |

  The root layout also exports `viewport` with
  `interactiveWidget: 'resizes-content'` so the mobile on-screen keyboard shrinks
  the layout viewport instead of overlaying `100dvh` surfaces.

  ## Theme

  `ThemeProvider` wraps next-themes with `attribute="class"`,
  `defaultTheme="system"`, and `storageKey="app.theme.mode"`. Two hard-won rules
  are documented in the source — read them before "improving" it:

  - **Do NOT add `disableTransitionOnChange`** — its style-injection + reflow
    trick leaves mobile Safari/WebKit painted in the old theme until a scroll
    (`lib/theme/ThemeProvider.tsx`).
  - **Do NOT add parallel theme state** (a second localStorage key or a
    `useEffect` pushing into `setTheme`) — hidden duplicate toggle instances
    re-apply stale values (`lib/theme/ThemeToggle.tsx`).

  `ThemeToggle` takes its copy via a `labels` prop (English defaults) instead of
  `useT()` so it has no hard i18n coupling — pass labels from a `useT()` call
  site when the surface is localized.
  ````
- [ ] Step: add the CLAUDE.md doc-index row — in `/Users/luca/dev/winter-park/template/CLAUDE.md` replace:
  ```markdown
  | [`rate-limiting.md`](docs/rate-limiting.md) | createRateLimit, key strategy, storage |
  ```
  with:
  ```markdown
  | [`rate-limiting.md`](docs/rate-limiting.md) | createRateLimit, key strategy, storage |
  | [`i18n.md`](docs/i18n.md) | Locale resolution chain, `t(locale)` messages, Intl formatters, timezone + theme providers |
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -c "i18n.md" /Users/luca/dev/winter-park/template/CLAUDE.md` → expected: `1`. Run: `head -5 /Users/luca/dev/winter-park/template/docs/i18n.md` → expected: frontmatter with `title: Internationalization`, `order: 8`, `category: Infrastructure`.
- [ ] Step: commit —
  ```
  cd /Users/luca/dev/winter-park/template
  git add docs/i18n.md CLAUDE.md
  git commit -m "docs(i18n): resolution chain, use-cache contract, timezone + theme wiring; CLAUDE.md index row

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

## Phase-exit checklist (run after Task 4.12)

- [ ] `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → exit 0 (types + format suites, plus Phase 1/3 suites still green)
- [ ] `npx eslint .` → exit 0
- [ ] `npx next build` → exit 0
- [ ] `npm run build-storybook` → exit 0
- [ ] `grep -rn "irene\." lib/i18n lib/theme app/layout.tsx app/auth/layout.tsx` → no output (no irene identifiers survive)
- [ ] `git log --oneline` shows 12 commits for this phase on `backport/irene-2026-07`
