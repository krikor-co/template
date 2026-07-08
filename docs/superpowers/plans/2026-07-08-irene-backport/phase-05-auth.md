# Phase 5: Dual-Identifier Auth — Irene Backport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Read 00-INDEX.md for global constraints — they apply to every task here.

**Goal:** Land dual email+phone OTP auth generalized from irene — a single `identifier` field through identify→verify/register, an env-gated Twilio SMS channel with locale from i18n, a slim numeric-userId JWT, the persons dual-identifier schema (nullable email + partial uniques + emailVerified + phoneNumber), the OtpInput and VerifySuccess UI, the standalone auth bugfixes (lowercase canonicalization, useResendOtp leak, redirect hardening, dev OTP print), and the e2e suite updated for the identifier flow.

**Depends on phases:** 1, 3, 4. (Soft dependency on phase 2: `.otp-caret` blink keyframes — OtpInput/VerifySuccess degrade to a steady caret/dot when phase 2 has not landed yet; no build breakage either way.)

## Global Constraints (phase-relevant subset, exact values)

- TEMPLATE repo: `/Users/luca/dev/winter-park/template` (branch `backport/irene-2026-07`). IRENE source repo: `/Users/luca/dev/winter-park/irene` (read-only reference — never modify).
- Table naming: template plural stays (`users`, `persons`, `sessions`, `otps`/`otp_codes`). This phase modifies ONLY `persons` (nullable `email`, `email_verified`, `phone_number`, partial unique indexes).
- Known irene REGRESSIONS must NOT port: `sessions` keeps template's `.unique()` on the `token` column and `onDelete: 'cascade'` on `userId`. **No task in this phase touches `db/schema/sessions.ts`.**
- Identifiers: auth cookies via `AUTH_*_COOKIE` constants in `lib/auth/identifier.ts` (values: `auth_identifier`, `auth_identifier_type`, `auth_is_new`, `session_token`). Phase 6 (already drafted, final) imports `AUTH_SESSION_COOKIE` (value `'session_token'`) from `lib/auth/identifier.ts` — this phase MUST export it.
- Copy: English defaults; user-facing client copy via `lib/i18n` messages (`useT()`); pt-BR is the second seed locale. No hardcoded pt-BR anywhere in code defaults (irene's Twilio `Locale: 'pt-BR'` is replaced by a locale parameter). Server-action error strings stay plain English (existing template convention).
- Effect is adopted: irene's auth actions are `tracedAction`-wrapped and the Twilio client is Effect-based — both STAY that way. Names from phase 3: `tracedAction`, `ExternalServiceError({ service, cause })`, `Timeout({ message, durationMs })`, `TracingLayer`.
- Migration story: schema change regenerates the single baseline — `cd /Users/luca/dev/winter-park/template && rm -rf drizzle && npx drizzle-kit generate --name baseline` → `drizzle/0000_baseline.sql` (phase 1/4 convention). Phases touching `db/schema` serialize this step.
- Coordination (binding): phase 4 seeded `lib/i18n/messages.ts` with `auth.*` keys expecting THIS phase to rewire LoginForm/RegisterForm/VerifyForm onto `useT()`; phase 4 mounted `LocaleProvider` in `app/auth/layout.tsx` via `getPublicLocale()`. Phase 6 owns `requireAdmin`/`AdminGuardError` and the `requireAdminE`/`requireWorkspaceRoleE` stub bodies — do NOT implement them here despite phase 3's stub comment saying "Phase 5".
- Anchor edits to files created by phases 3/4 on exact strings, not line numbers (their landed line numbers may drift).
- Verification gate for every task: at minimum `npx tsc --noEmit` clean; plus the task-appropriate command (`npx vitest run` for tested code, `npx next build` for config/schema, `npm run build-storybook` for stories, `npx playwright test --list` for e2e files). Full `npx playwright test` needs a scratch `DATABASE_URL` + port 3001 — when none is configured, defer the live run to phase 13's gate (note it in the task's commit body is NOT needed; just proceed).
- Every task ends with a git commit whose message ends with the trailer line:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

**Template facts this plan is written against** (verified 2026-07-08, plus phases 1/3/4 plan contracts): auth flow lives in `app/auth/{identify,verify,register}` with LoginForm/VerifyForm/RegisterForm sections; `lib/auth/jwt.ts` has `SessionPayload = { userId: string; email: string }`; `app/auth/guards.ts` reads raw `'auth_email'`/`'auth_is_new'` strings; `lib/otp/email-otp.ts` exports `createEmailOtp(email): Promise<{ code: string }>` and `verifyEmailOtp(email, code): Promise<boolean>`; `lib/rate-limit.ts` exports `createRateLimit({ action, max, windowMs })` (`.check(key, ip)`) and `getClientIp()`; `framer-motion@^11` and `zod@^3.23` are already dependencies; `input-otp` is NOT; Storybook 10 with `npm run build-storybook`; Playwright specs under `e2e/` (`.spec.ts`), vitest collects `**/*.test.ts` (phase 1).

**Transient-state note for executors:** tasks 5.7–5.12 refactor guards → identify → register → verify sequentially. Every commit is tsc-clean, but the RUNTIME auth flow is only fully consistent again after Task 5.12 (guards read the new identifier cookies from 5.7 on; actions stop setting `auth_email` step by step). Do not bisect a live demo between those commits; e2e goes green again at 5.13.

---

### Task 5.1: Lowercase email canonicalization in all auth actions (standalone fix)

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/app/auth/identify/_components/LoginForm/actions.ts` (line 28)
- Modify: `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/actions.ts` (lines 33, 92–103)
- Modify: `/Users/luca/dev/winter-park/template/app/auth/register/_components/RegisterForm/actions.ts` (line 31)

**Interfaces:**
- Consumes: nothing new (edits existing template actions in place; action signatures unchanged).
- Produces: case-insensitive email handling in `sendLoginOtp`, `verifyOtpAction`, `resendOtpAction`, `registerAction` — the invariant Tasks 5.9/5.10/5.12 preserve when they rewrite these files onto the identifier flow. (Port of irene commit 5cc6e95: an uppercase-variant email created a duplicate person because lookups/inserts used the raw string.)

**Steps:**

- [ ] Step: edit `app/auth/identify/_components/LoginForm/actions.ts` — one edit:
  - old (line 28):
    ```ts
      const { email, returnTo } = parsed.data
    ```
  - new:
    ```ts
      const { returnTo } = parsed.data
      // Emails are case-insensitive — lowercase before rate-limit keying, person
      // lookup, and OTP creation so "User@…" matches the existing "user@…"
      // person instead of creating a duplicate account.
      const email = parsed.data.email.toLowerCase()
    ```
- [ ] Step: edit `app/auth/verify/_components/VerifyForm/actions.ts` — five edits:
  1. old (line 33): `  const { email, code } = parsed.data`
     new:
     ```ts
       const { code } = parsed.data
       // Canonicalize to lowercase so the OTP lookup and the person lookup are
       // case-insensitive (same rule as sendLoginOtp/registerAction).
       const email = parsed.data.email.toLowerCase()
     ```
  2. In `resendOtpAction`, after the line `  if (!parsed.success) return { success: false, error: 'Invalid email.' }` insert:
     ```ts
       // Same canonicalization — the OTP row must be keyed by the lowercase
       // email or the resent code can't be found at verify time.
       const email = parsed.data.email.toLowerCase()
     ```
  3. `  const limit = await resendLimit.check(parsed.data.email, ip)` → `  const limit = await resendLimit.check(email, ip)`
  4. `  const { code } = await createEmailOtp(parsed.data.email)` → `  const { code } = await createEmailOtp(email)`
  5. `    to:      parsed.data.email,` → `    to:      email,`
- [ ] Step: edit `app/auth/register/_components/RegisterForm/actions.ts` — one edit:
  - old (line 31): `  const { email, name } = parsed.data`
  - new:
    ```ts
      const { name } = parsed.data
      // Emails are case-insensitive — lowercase so the uniqueness check and the
      // stored person row use the canonical form.
      const email = parsed.data.email.toLowerCase()
    ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -c 'toLowerCase()' app/auth/identify/_components/LoginForm/actions.ts app/auth/verify/_components/VerifyForm/actions.ts app/auth/register/_components/RegisterForm/actions.ts` → expected: `1`, `2`, `1`.
- [ ] Step: commit —
  ```
  git add app/auth/identify/_components/LoginForm/actions.ts app/auth/verify/_components/VerifyForm/actions.ts app/auth/register/_components/RegisterForm/actions.ts
  git commit -m "fix(auth): lowercase email canonicalization in identify/verify/resend/register actions

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.2: useResendOtp — clear the post-sent timeout on unmount (standalone fix)

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/useResendOtp.ts` (lines 12, 40–54)

**Interfaces:**
- Consumes: nothing new.
- Produces: leak-free `useResendOtp(email, cooldownSeconds = 30)` (signature unchanged here — the identifier signature change is Task 5.12). Port of irene's `sentTimeoutRef` fix: the bare `setTimeout` after a successful resend calls `setState` 2s later; a user who verifies and navigates away in that window triggers setState-on-unmounted + a leaked timer.

**Steps:**

- [ ] Step: apply three edits to `useResendOtp.ts`:
  1. old (line 12):
     ```ts
       const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)
     ```
     new:
     ```ts
       const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)
       const sentTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

       // The post-"sent" reset fires 2s later; clear it on unmount so a user who
       // verifies and navigates away inside that window doesn't trigger a
       // setState on an unmounted component (React warning + leaked timer).
       useEffect(() => () => clearTimeout(sentTimeoutRef.current), [])
     ```
  2. old (inside `resend`, line 46): `      setTimeout(() => {`
     new: `      sentTimeoutRef.current = setTimeout(() => {`
  3. No other edits — countdown interval logic already clears itself.
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -c 'sentTimeoutRef' app/auth/verify/_components/VerifyForm/useResendOtp.ts` → expected: `3`.
- [ ] Step: commit —
  ```
  git add app/auth/verify/_components/VerifyForm/useResendOtp.ts
  git commit -m "fix(auth): clear useResendOtp post-sent timeout on unmount (setState-after-unmount leak)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.3: `lib/auth/identifier.ts` + unit test (TDD)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/auth/identifier.test.ts` (written FIRST)
- Create: `/Users/luca/dev/winter-park/template/lib/auth/identifier.ts` (port of `/Users/luca/dev/winter-park/irene/lib/auth/identifier.ts`, 29 lines, + one template-only export)

**Interfaces:**
- Consumes: `zod` (existing dep); vitest infra (phase 1).
- Produces (consumed by Tasks 5.7–5.13 and by phase 6/phase 12):
  - `type IdentifierType = 'phone' | 'email'`
  - `detectIdentifierType(value: string): IdentifierType | null`
  - `normalizePhone(phone: string): string` (E.164-ish: strip non-digits, prefix `+`)
  - `AUTH_IDENTIFIER_COOKIE = 'auth_identifier'`
  - `AUTH_IDENTIFIER_TYPE_COOKIE = 'auth_identifier_type'`
  - `AUTH_IS_NEW_COOKIE = 'auth_is_new'`
  - `AUTH_SESSION_COOKIE = 'session_token'` (template-only addition — phase 6's invite-accept and dispatcher tasks import it from here; irene never centralized the session cookie name)

**Steps:**

- [ ] Step: write failing test — Create `/Users/luca/dev/winter-park/template/lib/auth/identifier.test.ts` with exactly this content:
  ```typescript
  import { describe, expect, it } from 'vitest'
  import {
    detectIdentifierType,
    normalizePhone,
    AUTH_IDENTIFIER_COOKIE,
    AUTH_IDENTIFIER_TYPE_COOKIE,
    AUTH_IS_NEW_COOKIE,
    AUTH_SESSION_COOKIE,
  } from './identifier'

  describe('detectIdentifierType', () => {
    it('detects valid emails (trims, any case)', () => {
      expect(detectIdentifierType('user@example.com')).toBe('email')
      expect(detectIdentifierType('  User@Example.COM  ')).toBe('email')
    })

    it('rejects strings with @ that are not valid emails', () => {
      expect(detectIdentifierType('user@')).toBeNull()
      expect(detectIdentifierType('@example.com')).toBeNull()
    })

    it('detects phone-like inputs (leading digit or +, 8+ chars of digits/space/()/-)', () => {
      expect(detectIdentifierType('+55 11 99999-9999')).toBe('phone')
      expect(detectIdentifierType('5511999999999')).toBe('phone')
      expect(detectIdentifierType('+1 (555) 000-0000')).toBe('phone')
    })

    it('rejects empty, short, and non-identifier input', () => {
      expect(detectIdentifierType('')).toBeNull()
      expect(detectIdentifierType('   ')).toBeNull()
      expect(detectIdentifierType('abc')).toBeNull()
      expect(detectIdentifierType('12')).toBeNull()
      // must START with an optional + then a digit — leading '(' is rejected
      expect(detectIdentifierType('(11) 99999-9999')).toBeNull()
    })
  })

  describe('normalizePhone', () => {
    it('strips formatting to +digits', () => {
      expect(normalizePhone('+55 (11) 99999-9999')).toBe('+5511999999999')
      expect(normalizePhone('55 11 99999 9999')).toBe('+5511999999999')
    })
  })

  describe('cookie name constants (the auth-flow cookie contract)', () => {
    it('pins the exact cookie names', () => {
      expect(AUTH_IDENTIFIER_COOKIE).toBe('auth_identifier')
      expect(AUTH_IDENTIFIER_TYPE_COOKIE).toBe('auth_identifier_type')
      expect(AUTH_IS_NEW_COOKIE).toBe('auth_is_new')
      expect(AUTH_SESSION_COOKIE).toBe('session_token')
    })
  })
  ```
- [ ] Step: run test, expect FAIL — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/auth/identifier.test.ts` → expected: exit 1, "Cannot find module './identifier'" (file does not exist yet).
- [ ] Step: implement — Create `/Users/luca/dev/winter-park/template/lib/auth/identifier.ts` with exactly this content (irene source verbatim + the `AUTH_SESSION_COOKIE` export and doc comments; there are zero irene-isms in the source file):
  ```typescript
  import { z } from 'zod'

  export type IdentifierType = 'phone' | 'email'

  const phoneRegex = /^\+?\d[\d\s()-]{7,}$/

  export function detectIdentifierType(value: string): IdentifierType | null {
    const trimmed = value.trim()
    if (!trimmed) return null

    // If it looks like an email (has @), validate as email
    if (trimmed.includes('@')) {
      return z.string().email().safeParse(trimmed).success ? 'email' : null
    }

    // Otherwise try phone
    return phoneRegex.test(trimmed) ? 'phone' : null
  }

  /** Normalize phone to E.164-ish digits-only format with + prefix */
  export function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    return `+${digits}`
  }

  /**
   * Auth-flow cookie names — the single source of truth. Guards, actions, and
   * the logout path import these; never write the raw strings.
   */
  export const AUTH_IDENTIFIER_COOKIE = 'auth_identifier'
  export const AUTH_IDENTIFIER_TYPE_COOKIE = 'auth_identifier_type'
  export const AUTH_IS_NEW_COOKIE = 'auth_is_new'

  /** Session cookie (long-lived JWT). Set at verify, cleared at logout. */
  export const AUTH_SESSION_COOKIE = 'session_token'
  ```
- [ ] Step: run test, expect PASS — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/auth/identifier.test.ts` → expected: exit 0, 6 tests pass. Then Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```
  git add lib/auth/identifier.ts lib/auth/identifier.test.ts
  git commit -m "backport(auth): lib/auth/identifier — detectIdentifierType, normalizePhone, AUTH_*_COOKIE constants

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.4: Twilio Verify OTP channel — `lib/twilio/` (env-gated, Effect stack, locale from i18n)

**Files:**
- Create: `/Users/luca/dev/winter-park/template/lib/twilio/config.test.ts` (written FIRST — `isTwilioEnabled` is new logic)
- Create: `/Users/luca/dev/winter-park/template/lib/twilio/config.ts` (rewrite of irene's 11-line file + feature-flag helper)
- Create: `/Users/luca/dev/winter-park/template/lib/twilio/effect.ts` (port of irene's, 127 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/twilio/send-otp.ts` (port of irene's, 38 lines)
- Create: `/Users/luca/dev/winter-park/template/lib/twilio/verify-otp.ts` (port of irene's, 37 lines — verbatim)
- Modify: `/Users/luca/dev/winter-park/template/.env.example` (Twilio block from phase 1 Task 1.3 — append 2 documented test vars)

**Interfaces:**
- Consumes: `ExternalServiceError({ service: string; cause: unknown })`, `Timeout({ message: string; durationMs?: number })` from `@/lib/effect/errors` (phase 3 Task 3.3); `TracingLayer` from `@/lib/effect/tracing` (phase 3 Task 3.4); `type Locale = 'en' | 'pt-BR'` from `@/lib/i18n/types` (phase 4 Task 4.1). No new npm deps (irene's Twilio client is raw `fetch`).
- Produces (consumed by Tasks 5.9/5.10/5.12):
  - `isTwilioEnabled(): boolean` — true only when all of `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` are set. THE feature flag for the phone channel.
  - `getTwilioConfig(): { accountSid: string; authToken: string; serviceSid: string }` (throws when unset)
  - `sendTwilioOtpE(to: string, locale: Locale): Effect.Effect<void, ExternalServiceError | Timeout>`
  - `verifyTwilioOtpE(to: string, code: string): Effect.Effect<boolean, ExternalServiceError | Timeout>`
  - `runTwilio<A, E>(effect: Effect.Effect<A, E, never>): Promise<A>`
  - `sendTwilioOtp(to: string, locale: Locale): Promise<{ success: true } | { success: false; error: string }>` (Promise shim; `TEST_OTP_BYPASS=true` short-circuits)
  - `verifyTwilioOtp(to: string, code: string): Promise<boolean>` (Promise shim; bypass code = `TEST_OTP_CODE` default `'123456'`)

**Steps:**

- [ ] Step: write failing test — Create `/Users/luca/dev/winter-park/template/lib/twilio/config.test.ts` with exactly this content (env is read at module scope, so each case resets modules and stubs env before a dynamic import):
  ```typescript
  import { beforeEach, describe, expect, it, vi } from 'vitest'

  describe('twilio config feature flag', () => {
    beforeEach(() => {
      vi.resetModules()
      vi.unstubAllEnvs()
    })

    it('isTwilioEnabled is false when any TWILIO_* var is missing', async () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', '')
      vi.stubEnv('TWILIO_AUTH_TOKEN', '')
      vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', '')
      const { isTwilioEnabled } = await import('./config')
      expect(isTwilioEnabled()).toBe(false)
    })

    it('isTwilioEnabled is true when all three vars are set', async () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123')
      vi.stubEnv('TWILIO_AUTH_TOKEN', 'token123')
      vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', 'VA123')
      const { isTwilioEnabled } = await import('./config')
      expect(isTwilioEnabled()).toBe(true)
    })

    it('getTwilioConfig throws when unset (fail-closed for direct callers)', async () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', '')
      vi.stubEnv('TWILIO_AUTH_TOKEN', '')
      vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', '')
      const { getTwilioConfig } = await import('./config')
      expect(() => getTwilioConfig()).toThrow(/Missing Twilio env vars/)
    })
  })
  ```
- [ ] Step: run test, expect FAIL — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/twilio/config.test.ts` → expected: exit 1, "Cannot find module './config'".
- [ ] Step: implement config — Create `/Users/luca/dev/winter-park/template/lib/twilio/config.ts` with exactly this content:
  ```typescript
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID

  /**
   * Feature flag: the phone-OTP auth channel is active only when all three
   * TWILIO_* env vars are present. Unset = email-only auth — the auth actions
   * gate on this BEFORE calling Twilio, so a template app without Twilio
   * configured never breaks, it just rejects phone identifiers up front.
   */
  export function isTwilioEnabled(): boolean {
    return Boolean(accountSid && authToken && serviceSid)
  }

  export function getTwilioConfig() {
    if (!accountSid || !authToken || !serviceSid) {
      throw new Error('Missing Twilio env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID')
    }
    return { accountSid, authToken, serviceSid }
  }
  ```
- [ ] Step: run test, expect PASS — Run: `cd /Users/luca/dev/winter-park/template && npx vitest run lib/twilio/config.test.ts` → expected: exit 0, 3 tests pass.
- [ ] Step: copy Effect layer — `cp /Users/luca/dev/winter-park/irene/lib/twilio/effect.ts /Users/luca/dev/winter-park/template/lib/twilio/effect.ts`
- [ ] Step: apply generalization edits to `lib/twilio/effect.ts` (irene line refs):
  1. After line 4 (`import { TracingLayer } from '@/lib/effect/tracing'`) add:
     ```typescript
     import type { Locale } from '@/lib/i18n/types'
     ```
  2. In the header doc comment, after the line `*                    \`twilio.verify_otp\`), with phone redacted to last 4` (line 14) add one line:
     ```
      *   - i18n:          SMS language comes from the caller's resolved locale
      *                    (Twilio Verify accepts BCP-47 tags like 'en', 'pt-BR')
     ```
  3. Line 44 signature: `export const sendTwilioOtpE = (to: string): Effect.Effect<void, ExternalServiceError | Timeout> => pipe(` → `export const sendTwilioOtpE = (to: string, locale: Locale): Effect.Effect<void, ExternalServiceError | Timeout> => pipe(`
  4. Line 52: `      new URLSearchParams({ To: to, Channel: 'sms', Locale: 'pt-BR' }),` → `      new URLSearchParams({ To: to, Channel: 'sms', Locale: locale }),`
  5. No other edits — `verifyTwilioOtpE`, `runTwilio`, `fetchTwilio`, `lastFour`, timeouts, retry schedule, and the 4xx-is-invalid-code handling port verbatim; `@/lib/effect/errors` and `@/lib/effect/tracing` resolve against phase 3.
- [ ] Step: copy shims —
  ```bash
  cp /Users/luca/dev/winter-park/irene/lib/twilio/send-otp.ts /Users/luca/dev/winter-park/template/lib/twilio/send-otp.ts
  cp /Users/luca/dev/winter-park/irene/lib/twilio/verify-otp.ts /Users/luca/dev/winter-park/template/lib/twilio/verify-otp.ts
  ```
- [ ] Step: apply generalization edits to `lib/twilio/send-otp.ts` (irene line refs):
  1. After line 2 (`import { sendTwilioOtpE, runTwilio } from './effect'`) add:
     ```typescript
     import type { Locale } from '@/lib/i18n/types'
     ```
  2. Line 12 signature: `export async function sendTwilioOtp(to: string): Promise<{ success: true } | { success: false; error: string }> {` → `export async function sendTwilioOtp(to: string, locale: Locale): Promise<{ success: true } | { success: false; error: string }> {`
  3. Line 21: `    Effect.provide(sendTwilioOtpE(to), (await import('@/lib/effect/tracing')).TracingLayer),` → `    Effect.provide(sendTwilioOtpE(to, locale), (await import('@/lib/effect/tracing')).TracingLayer),`
- [ ] Step: `lib/twilio/verify-otp.ts` — apply generalization edits: **none needed** (verified against irene source: no salon/irene/pt-BR strings; imports `./effect` + `@/lib/effect/tracing` resolve). Confirm byte-identical copy: `diff /Users/luca/dev/winter-park/irene/lib/twilio/verify-otp.ts /Users/luca/dev/winter-park/template/lib/twilio/verify-otp.ts` → expected: no output.
- [ ] Step: edit `/Users/luca/dev/winter-park/template/.env.example` — in the Twilio block (phase 1 wrote it), after the line `TWILIO_VERIFY_SERVICE_SID=` append:
  ```bash

  # Test bypass for the SMS channel (e2e only — never set in production):
  # TEST_OTP_BYPASS=true makes the Twilio shims skip the API; sends always
  # succeed and the accepted code is TEST_OTP_CODE (default 123456).
  TEST_OTP_BYPASS=
  TEST_OTP_CODE=
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -rn "pt-BR\|salon\|irene" lib/twilio/` → expected: 0 matches. Run: `npx vitest run` → expected: exit 0 (new config tests + all prior suites).
- [ ] Step: commit —
  ```
  git add lib/twilio .env.example
  git commit -m "backport(twilio): env-gated Twilio Verify OTP channel on the Effect stack (SMS locale from i18n)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.5: Slim JWT — numeric `userId` only

**Files:**
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/lib/auth/jwt.ts` (29 lines)
- Modify: `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/actions.ts` (the `createSessionToken` call — line 55 pre-refactor)
- Modify: `/Users/luca/dev/winter-park/template/lib/effect/run-action.ts` (phase 3 file — one string-anchored edit)
- Modify: `/Users/luca/dev/winter-park/template/lib/effect/traced.ts` (phase 3 file — one string-anchored edit)
- Modify: `/Users/luca/dev/winter-park/template/lib/i18n/getLocale.ts` (phase 4 file — one string-anchored edit)

**Interfaces:**
- Consumes: phase 3's landed `run-action.ts`/`traced.ts` (each contains `let userId: string | undefined` per phase 3 Tasks 3.7/3.8); phase 4's landed `getLocale.ts` (contains `Number(session.userId)` per phase 4 Task 4.4); the trace-span exporter's `pickUserId` already accepts numbers (no exporter edit).
- Produces (phase 6 and phase 12 build against these): `SessionPayload = { userId: number }`; `createSessionToken(payload: SessionPayload): Promise<string>`; `verifySessionToken(token: string): Promise<SessionPayload>` (throws unless `payload.userId` is a number). The JWT no longer embeds `email` — the token is decoupled from any identifier (required once phone-only accounts exist).

**Steps:**

- [ ] Step: rewrite `/Users/luca/dev/winter-park/template/lib/auth/jwt.ts` with exactly this content (irene's `lib/auth/jwt.ts` verbatim + a rationale comment):
  ```typescript
  import { SignJWT, jwtVerify } from 'jose'

  const secret = new TextEncoder().encode(
    process.env.AUTH_SECRET ?? (() => { throw new Error('AUTH_SECRET is not configured') })()
  )

  /**
   * The session payload is deliberately SLIM: a numeric `userId` only. The
   * token is decoupled from any particular identifier — email/phone can
   * change or be absent (phone-only accounts) without invalidating sessions.
   * Everything else is looked up fresh per request via getSession's DB check.
   */
  export type SessionPayload = {
    userId: number
  }

  export async function createSessionToken(payload: SessionPayload): Promise<string> {
    return new SignJWT({ userId: payload.userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)
  }

  export async function verifySessionToken(token: string): Promise<SessionPayload> {
    const { payload } = await jwtVerify(token, secret)

    if (typeof payload.userId !== 'number') {
      throw new Error('Invalid session token payload')
    }

    return { userId: payload.userId }
  }
  ```
- [ ] Step: edit `app/auth/verify/_components/VerifyForm/actions.ts` — one edit:
  - old: `  const token = await createSessionToken({ userId: String(user.id), email: person.email })`
  - new: `  const token = await createSessionToken({ userId: user.id })`
- [ ] Step: edit `/Users/luca/dev/winter-park/template/lib/effect/run-action.ts` — one string-anchored edit (phase 3 flipped irene's number to string for the old template payload; flip back):
  - old: `    let userId: string | undefined`
  - new: `    let userId: number | undefined`
- [ ] Step: edit `/Users/luca/dev/winter-park/template/lib/effect/traced.ts` — one string-anchored edit:
  - old: `  let userId: string | undefined`
  - new: `  let userId: number | undefined`
- [ ] Step: edit `/Users/luca/dev/winter-park/template/lib/i18n/getLocale.ts` — one string-anchored edit (remove the string-conversion workaround phase 4 added):
  - old:
    ```ts
      // Template session payloads carry userId as a STRING (lib/auth/jwt.ts);
      // users.id is an integer identity column — convert before comparing.
      const [row] = await db
        .select({ locale: persons.locale })
        .from(users)
        .innerJoin(persons, eq(persons.id, users.personId))
        .where(eq(users.id, Number(session.userId)))
        .limit(1)
    ```
  - new:
    ```ts
      const [row] = await db
        .select({ locale: persons.locale })
        .from(users)
        .innerJoin(persons, eq(persons.id, users.personId))
        .where(eq(users.id, session.userId))
        .limit(1)
    ```
- [ ] Step: sweep for stragglers — Run: `grep -rn "session.userId\|payload.email\|\.userId" app lib --include='*.ts' --include='*.tsx' | grep -v 'node_modules' | grep -i 'String(\|Number('` → expected: 0 matches (no remaining string/number conversions of the session userId).
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `npx vitest run` → expected: exit 0 (phase 3's run-action/boundary tests omit `actionName`, so no session stubbing is involved).
- [ ] Step: commit —
  ```
  git add lib/auth/jwt.ts app/auth/verify/_components/VerifyForm/actions.ts lib/effect/run-action.ts lib/effect/traced.ts lib/i18n/getLocale.ts
  git commit -m "backport(auth): slim session JWT — numeric userId only, no email in the token

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.6: `persons` dual-identifier schema + baseline regen + `docs/schema.md` pattern

**Files:**
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/db/schema/persons.ts` (as landed by phases 1+4: timestamptz + `locale` column)
- Regenerate: `/Users/luca/dev/winter-park/template/drizzle/` (single baseline)
- Modify: `/Users/luca/dev/winter-park/template/docs/schema.md` (Conventions section — append the partial-unique pattern phase 1's Task 1.10 reserved for this phase)

**Interfaces:**
- Consumes: baseline-regen convention (`rm -rf drizzle && npx drizzle-kit generate --name baseline`); phases 1/3/4 schema state (users/sessions/otp_codes/rate_limits/audit_log/trace_span + persons.locale).
- Produces (Tasks 5.9/5.10/5.12 + phase 6 consume): `persons.email: text NULL` (was NOT NULL UNIQUE), `persons.emailVerified: boolean NOT NULL DEFAULT false` (written by phase 6's invite-accept flow), `persons.phoneNumber: text NULL`, partial unique indexes `persons_email_unique` / `persons_phone_unique` (`WHERE ... IS NOT NULL`). `Person`/`NewPerson` types unchanged in name.
- **Serialization note:** phases touching `db/schema` serialize the baseline regen — run this task only after phases 1, 3, 4 have fully landed.

**Steps:**

- [ ] Step: rewrite `/Users/luca/dev/winter-park/template/db/schema/persons.ts` with exactly this content (pattern from irene `db/schema/person.ts` — partial uniques, `emailVerified`, `phoneNumber`; irene-isms NOT ported: `lastName` NOT NULL (irene product choice), `fiscalId` (BR fiscal id), `birthdate`, `avatarUrl` (blob phase), `locale` default `'pt-BR'` (template keeps phase 4's `'en'`), singular table name):
  ```typescript
  import { integer, pgTable, text, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core'
  import { sql } from 'drizzle-orm'

  export const persons = pgTable(
    'persons',
    {
      id:            integer('id').primaryKey().generatedAlwaysAsIdentity(),
      /**
       * Nullable natural keys: a person signs up with email OR phone (dual-
       * identifier auth), so each is optional. Uniqueness is enforced by the
       * partial unique indexes below (`WHERE ... IS NOT NULL`) — the template
       * pattern for optional natural keys (see docs/schema.md).
       */
      email:         text('email'),
      /**
       * Durable "this inbox was proven" marker for flows that need it beyond
       * the session itself (e.g. an emailed invite accepted → true). Plain OTP
       * login doesn't persist it — the minted session is its own proof.
       */
      emailVerified: boolean('email_verified').notNull().default(false),
      /** E.164-ish (+digits) — normalized by lib/auth/identifier normalizePhone. */
      phoneNumber:   text('phone_number'),
      name:          text('name'),
      // UI language for this person ('en' | 'pt-BR' — see lib/i18n/types.ts).
      // Middle link of the authed locale chain: app.locale cookie → persons.locale → DEFAULT_LOCALE.
      locale:        text('locale').notNull().default('en'),
      createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
      updatedAt:     timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (t) => ({
      emailUnique: uniqueIndex('persons_email_unique').on(t.email).where(sql`${t.email} IS NOT NULL`),
      phoneUnique: uniqueIndex('persons_phone_unique').on(t.phoneNumber).where(sql`${t.phoneNumber} IS NOT NULL`),
    })
  )

  export type Person = typeof persons.$inferSelect
  export type NewPerson = typeof persons.$inferInsert
  ```
- [ ] Step: regenerate the baseline — Run: `cd /Users/luca/dev/winter-park/template && rm -rf drizzle && npx drizzle-kit generate --name baseline` → expected: exit 0, `drizzle/0000_baseline.sql` + `drizzle/meta/` created.
- [ ] Step: verification (generated SQL) — all against `/Users/luca/dev/winter-park/template/drizzle/0000_baseline.sql`:
  - `awk '/CREATE TABLE "persons"/,/\);/' drizzle/0000_baseline.sql | grep '"email"'` → expected: `"email" text,` (nullable — NO `NOT NULL`)
  - `grep -c '"email_verified" boolean DEFAULT false NOT NULL' drizzle/0000_baseline.sql` → expected: `1`
  - `grep -c '"phone_number" text' drizzle/0000_baseline.sql` → expected: `1`
  - `grep -c 'CREATE UNIQUE INDEX' drizzle/0000_baseline.sql` → expected: `2` (`persons_email_unique`, `persons_phone_unique`)
  - `grep -c 'IS NOT NULL' drizzle/0000_baseline.sql` → expected: `2` (both partial)
  - No-regression checks: `grep -c 'sessions_token_unique' drizzle/0000_baseline.sql` → `1`; `grep -ci 'on delete cascade' drizzle/0000_baseline.sql` → `1`
- [ ] Step: run `cd /Users/luca/dev/winter-park/template && npx vitest run` → expected: exit 0 (schema-invariants test iterates the new columns; all timestamptz). Then `npx tsc --noEmit` → expected: exit 0 (the verify action no longer reads `person.email` after Task 5.5; `db.insert(persons).values({ email })` stays valid with a nullable column).
- [ ] Step: edit `/Users/luca/dev/winter-park/template/docs/schema.md` — insert a new convention. Anchor: the paragraph starting `**Soft deletes** (opt-in):` (do not use line numbers — phase 1 shifted offsets). Insert immediately BEFORE that paragraph:
  ```markdown
  **Optional natural keys — partial unique indexes**: when a natural key is
  nullable (a person may have an email OR a phone number), don't use a plain
  `.unique()` — declare a partial unique index so the constraint reads as
  intended, stays small, and the "NULL means absent, not duplicate" contract
  is explicit:

  ```typescript
  (t) => ({
    emailUnique: uniqueIndex('persons_email_unique').on(t.email).where(sql`${t.email} IS NOT NULL`),
    phoneUnique: uniqueIndex('persons_phone_unique').on(t.phoneNumber).where(sql`${t.phoneNumber} IS NOT NULL`),
  })
  ```

  The template's `persons` table uses this for `email` + `phone_number`
  (dual-identifier auth: either may be absent, each must be unique when set).

  ```
- [ ] Step: verification — Run: `grep -c 'persons_phone_unique' docs/schema.md` → expected: `1`. Run: `npx tsc --noEmit` → expected: exit 0.
- [ ] Step: commit —
  ```
  git add db/schema/persons.ts drizzle docs/schema.md
  git commit -m "backport(db): persons dual-identifier hardening — nullable email, phone_number, email_verified, partial uniques

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.7: Guards + session-cookie call sites onto the `AUTH_*_COOKIE` constants

**Files:**
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/guards.ts` (75 lines)
- Modify: `/Users/luca/dev/winter-park/template/lib/auth/session.ts` (the `'session_token'` read)
- Modify: `/Users/luca/dev/winter-park/template/app/dashboard/_components/LogoutButton/actions.ts` (phase 3 Task 3.9 rewrote it — string-anchored edits)

**Interfaces:**
- Consumes: `AUTH_IDENTIFIER_COOKIE`, `AUTH_IDENTIFIER_TYPE_COOKIE`, `AUTH_IS_NEW_COOKIE`, `AUTH_SESSION_COOKIE`, `type IdentifierType` (Task 5.3); existing `createTransitionGuard`, entries, `getSession`.
- Produces (Tasks 5.10/5.12 + e2e rely on these):
  - `getAuthIdentifier(): Promise<{ identifier: string; type: IdentifierType } | null>` from `@/app/auth/guards`
  - `canIdentify/canVerify/canRegister(): Promise<string | null>` — same names, now keyed on the identifier cookies
  - `AUTH_RETURN_TO_COOKIE = 'auth_return_to'` (unchanged)
  - Logout clears `session_token` + all three identifier cookies via constants.

**Steps:**

- [ ] Step: rewrite `/Users/luca/dev/winter-park/template/app/auth/guards.ts` with exactly this content (irene `app/auth/guards.ts` verbatim — verified to contain zero irene-isms; all imports resolve identically in template):
  ```typescript
  import { cookies } from 'next/headers'
  import { getSession } from '@/lib/auth/session'
  import { createTransitionGuard } from '@/lib/transition'
  import { entry as identifyEntry }  from '@/app/auth/identify/entry'
  import { entry as verifyEntry }    from '@/app/auth/verify/entry'
  import { entry as registerEntry }  from '@/app/auth/register/entry'
  import { entry as dashboardEntry } from '@/app/dashboard/entry'
  import {
    AUTH_IDENTIFIER_COOKIE,
    AUTH_IDENTIFIER_TYPE_COOKIE,
    AUTH_IS_NEW_COOKIE,
    type IdentifierType,
  } from '@/lib/auth/identifier'

  export const AUTH_RETURN_TO_COOKIE = 'auth_return_to'

  export const transitions = {
    identify: createTransitionGuard('auth_identify', 2000),
    verify:   createTransitionGuard('auth_verify',   2000),
    register: createTransitionGuard('auth_register', 2000),
  }

  /** Read the current auth identifier from cookies, if any */
  export async function getAuthIdentifier(): Promise<{ identifier: string; type: IdentifierType } | null> {
    const cookieStore = await cookies()
    const identifier = cookieStore.get(AUTH_IDENTIFIER_COOKIE)?.value
    const type = cookieStore.get(AUTH_IDENTIFIER_TYPE_COOKIE)?.value as IdentifierType | undefined
    if (!identifier || !type) return null
    return { identifier, type }
  }

  export async function canIdentify(): Promise<string | null> {
    if (await transitions.identify.isActive()) return null

    const cookieStore = await cookies()
    const returnTo = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value

    const session = await getSession()
    if (session) return returnTo ?? dashboardEntry.href()

    const auth = await getAuthIdentifier()
    if (auth) {
      const isNew = cookieStore.get(AUTH_IS_NEW_COOKIE)?.value === '1'
      return isNew ? registerEntry.href() : verifyEntry.href()
    }

    return null
  }

  export async function canVerify(): Promise<string | null> {
    if (await transitions.verify.isActive()) return null

    const cookieStore = await cookies()
    const returnTo = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value

    const session = await getSession()
    if (session) return returnTo ?? dashboardEntry.href()

    const auth = await getAuthIdentifier()
    if (!auth) return identifyEntry.href()

    const isNew = cookieStore.get(AUTH_IS_NEW_COOKIE)?.value === '1'
    if (isNew) return registerEntry.href()

    return null
  }

  export async function canRegister(): Promise<string | null> {
    if (await transitions.register.isActive()) return null

    const cookieStore = await cookies()
    const returnTo = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value

    const session = await getSession()
    if (session) return returnTo ?? dashboardEntry.href()

    const auth = await getAuthIdentifier()
    if (!auth) return identifyEntry.href()

    const isNew = cookieStore.get(AUTH_IS_NEW_COOKIE)?.value === '1'
    if (!isNew) return verifyEntry.href()

    return null
  }
  ```
- [ ] Step: edit `/Users/luca/dev/winter-park/template/lib/auth/session.ts` — two edits:
  1. After the line `import { verifySessionToken, type SessionPayload } from './jwt'` add:
     ```ts
     import { AUTH_SESSION_COOKIE } from './identifier'
     ```
  2. old: `    const token = cookieStore.get('session_token')?.value`
     new: `    const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value`
- [ ] Step: edit `/Users/luca/dev/winter-park/template/app/dashboard/_components/LogoutButton/actions.ts` (string-anchored against phase 3 Task 3.9's landed content) — three edits:
  1. After the line `import { dbE } from '@/lib/effect/db'` add:
     ```ts
     import {
       AUTH_SESSION_COOKIE,
       AUTH_IDENTIFIER_COOKIE,
       AUTH_IDENTIFIER_TYPE_COOKIE,
       AUTH_IS_NEW_COOKIE,
     } from '@/lib/auth/identifier'
     ```
  2. old: `    const token = cookieStore.get('session_token')?.value`
     new: `    const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value`
  3. old:
     ```ts
         cookieStore.set('session_token', '', { ...cookieOpts, maxAge: 0 })
         cookieStore.set('auth_email', '', { ...cookieOpts, maxAge: 0 })
         cookieStore.set('auth_is_new', '', { ...cookieOpts, maxAge: 0 })
     ```
     new:
     ```ts
         cookieStore.set(AUTH_SESSION_COOKIE, '', { ...cookieOpts, maxAge: 0 })
         cookieStore.set(AUTH_IDENTIFIER_COOKIE, '', { ...cookieOpts, maxAge: 0 })
         cookieStore.set(AUTH_IDENTIFIER_TYPE_COOKIE, '', { ...cookieOpts, maxAge: 0 })
         cookieStore.set(AUTH_IS_NEW_COOKIE, '', { ...cookieOpts, maxAge: 0 })
     ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -rn "'auth_email'\|\"auth_email\"" app lib` → expected: matches ONLY in `app/auth/*/actions.ts` and the two auth pages (removed by Tasks 5.9–5.12) — none in guards/session/logout.
- [ ] Step: commit —
  ```
  git add app/auth/guards.ts lib/auth/session.ts app/dashboard/_components/LogoutButton/actions.ts
  git commit -m "backport(auth): guards + session/logout onto AUTH_*_COOKIE identifier constants

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.8: Reshape the `auth.*` message catalogue for the identifier flow (en + pt-BR)

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/lib/i18n/messages.ts` (phase 4 Task 4.5's file — replace the `auth` block in BOTH dictionaries; phase 4 declares `export type Messages = typeof en`, so the type is inferred from `en` and needs no separate edit; `common`/`toast` untouched)

**Interfaces:**
- Consumes: phase 4's exact seeded content (the `auth` blocks quoted below as "old" are verbatim from phase 4 Task 4.5).
- Produces — the `Messages['auth']` shape Tasks 5.9/5.10/5.12 consume:
  ```ts
  auth: {
    identify: { title; subtitle; identifierLabel; identifierPlaceholder; identifierHelp; submit; submitting: string }
    register: { title; subtitle; emailLabel; phoneLabel; nameLabel; namePlaceholder; submit; submitting; success: string }
    verify:   { titleEmail; titlePhone; sentTo; codeLabel; submit; submitting; successTitle; successHint: string;
                resendIn: (seconds: number) => string; resend; sending; sent: string }
  }
  ```
  Key-name decisions vs irene (deliberate, documented here): `identifierPh` → `identifierPlaceholder` / `namePh` → `namePlaceholder` (match phase 4's `*Placeholder` style); irene's per-group `redirecting` and `verify.tryAgain` are DROPPED — components use `common.redirecting` / `common.tryAgain`; phase 4's `verify.success` and `identify.emailLabel/emailPlaceholder` dropped (no consumer after the OtpInput/VerifySuccess swap); phase 4's verify keys `subtitleBefore`/`resendWait`/`resendSending`/`resendSent` are superseded by irene's names `sentTo`/`resendIn`/`sending`/`sent` (which Tasks 5.10/5.12 port against). Nothing in the repo consumes `auth.*` yet (phase 4 seeded it for exactly this rewire), so this reshape breaks no call site.

**Steps:**

- [ ] Step: confirm no type edit is needed — phase 4 declares `export type Messages = typeof en` (there is NO structural `Messages` declaration), so `Messages['auth']` is inferred from the `en` dictionary and reshapes itself when the two dictionary blocks below change. Run: `grep -n "export type Messages" /Users/luca/dev/winter-park/template/lib/i18n/messages.ts` → expected: exactly one match, `export type Messages = typeof en`.
- [ ] Step: in the `en` dictionary, replace the whole `auth:` member — old (phase 4 verbatim):
  ```ts
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
  ```
  new (identifier copy adapted from irene's `en` catalogue; phone examples de-BR'd to a neutral +1 format):
  ```ts
    auth: {
      identify: {
        title:                 'Sign in or create an account',
        subtitle:              'Enter your email or phone number to continue',
        identifierLabel:       'Email or phone',
        identifierPlaceholder: 'you@example.com or +1 (555) 000-0000',
        identifierHelp:        'Use your email or a phone number with country code (e.g. +1 555 000 0000).',
        submit:                'Continue',
        submitting:            'Checking for account…',
      },
      register: {
        title:           'Create your account',
        subtitle:        'Just your name to get started',
        emailLabel:      'Email',
        phoneLabel:      'Phone',
        nameLabel:       'Name',
        namePlaceholder: 'Your name',
        submit:          'Create account',
        submitting:      'Creating account…',
        success:         'Account created! Redirecting…',
      },
      verify: {
        titleEmail:   'Check your email',
        titlePhone:   'Check your phone',
        sentTo:       'We sent a 6-digit code to',
        codeLabel:    'Verification code',
        submit:       'Verify code',
        submitting:   'Verifying…',
        successTitle: 'All set!',
        successHint:  'Taking you to your dashboard…',
        resendIn:     (seconds: number) => `Resend code in ${seconds}s`,
        resend:       'Resend code',
        sending:      'Sending…',
        sent:         'Code sent!',
      },
    },
  ```
- [ ] Step: in the `ptBR` dictionary, replace the whole `auth:` member — old (phase 4 verbatim):
  ```ts
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
  ```
  new (pt-BR phrasing reuses irene's existing translations):
  ```ts
    auth: {
      identify: {
        title:                 'Acesse sua conta',
        subtitle:              'Informe seu e-mail ou telefone para continuar',
        identifierLabel:       'E-mail ou telefone',
        identifierPlaceholder: 'voce@exemplo.com ou +55 11 99999-9999',
        identifierHelp:        'Use seu e-mail ou um telefone com código do país (ex.: +55 11 99999-9999).',
        submit:                'Continuar',
        submitting:            'Verificando conta…',
      },
      register: {
        title:           'Crie sua conta',
        subtitle:        'Só seu nome para começar',
        emailLabel:      'E-mail',
        phoneLabel:      'Telefone',
        nameLabel:       'Nome',
        namePlaceholder: 'Seu nome',
        submit:          'Criar conta',
        submitting:      'Criando conta…',
        success:         'Conta criada! Redirecionando…',
      },
      verify: {
        titleEmail:   'Verifique seu e-mail',
        titlePhone:   'Verifique seu telefone',
        sentTo:       'Enviamos um código de 6 dígitos para',
        codeLabel:    'Código de verificação',
        submit:       'Verificar código',
        submitting:   'Verificando…',
        successTitle: 'Tudo certo!',
        successHint:  'Levando você ao seu painel…',
        resendIn:     (seconds: number) => `Reenviar código em ${seconds}s`,
        resend:       'Reenviar código',
        sending:      'Enviando…',
        sent:         'Código enviado!',
      },
    },
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0 (`Messages` is `typeof en`, and the `const ptBR: Messages` annotation enforces pt-BR shape parity with `en` — a missed key fails here).
- [ ] Step: commit —
  ```
  git add lib/i18n/messages.ts
  git commit -m "backport(i18n): reshape auth message catalogue for the identifier flow (en + pt-BR)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.9: Identify step onto a single `identifier` field

**Files:**
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/identify/_components/LoginForm/actions.ts` (73 lines + Task 5.1 edit)
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/identify/_components/LoginForm/LoginForm.tsx` (87 lines)
- NOT touched (verified no changes needed): `state.ts`/`transition.ts`/`fixtures.ts` (LoginForm state carries no email — already identifier-agnostic), `scene.ts`, `entry.ts`, `contract.ts`, `page.tsx`, `layout.tsx`, `LoginForm.stories.tsx`, `page.stories.tsx`.

**Interfaces:**
- Consumes: `detectIdentifierType`, `normalizePhone`, `AUTH_IDENTIFIER_COOKIE`, `AUTH_IDENTIFIER_TYPE_COOKIE`, `AUTH_IS_NEW_COOKIE` (5.3); `sendTwilioOtp(to, locale)`, `isTwilioEnabled()` (5.4); `persons.phoneNumber` (5.6); `transitions`, `AUTH_RETURN_TO_COOKIE` (5.7); `tracedAction` (phase 3); `getPublicLocale()` (phase 4); `useT()` + `Messages['auth']['identify']` (5.8); existing `createEmailOtp`, `createRateLimit`, `getClientIp`, `useFormValues`, `useRedirectOnSuccess`, `scene`, `route`.
- Produces: `sendLoginOtp(formData: FormData): Promise<{ success: false; error: string } | { success: true; isNew: boolean }>` — same name+signature, now reading `formData.get('identifier')`; the form field contract `input[name="identifier"]` that Task 5.13's e2e helpers fill.

**Steps:**

- [ ] Step: rewrite `app/auth/identify/_components/LoginForm/actions.ts` with exactly this content (port of irene's `sendLoginOtp` — enumerated deltas vs irene source: `person`→`persons` table, `sendTwilioOtp(identifier)`→`sendTwilioOtp(identifier, await getPublicLocale())`, NEW `isTwilioEnabled()` up-front gate, NEW dev OTP console print, Resend `from` fallback `noreply@verify.prolizz.com`→`noreply@example.com`; `tracedAction` wrapper and lowercase canonicalization kept from irene):
  ```typescript
  'use server'

  import { z } from 'zod'
  import { cookies } from 'next/headers'
  import { db } from '@/db/drizzle'
  import { persons } from '@/db/schema'
  import { eq } from 'drizzle-orm'
  import { createEmailOtp } from '@/lib/otp/email-otp'
  import { sendTwilioOtp } from '@/lib/twilio/send-otp'
  import { isTwilioEnabled } from '@/lib/twilio/config'
  import { Resend } from 'resend'
  import { transitions, AUTH_RETURN_TO_COOKIE } from '@/app/auth/guards'
  import { createRateLimit, getClientIp } from '@/lib/rate-limit'
  import {
    detectIdentifierType,
    normalizePhone,
    AUTH_IDENTIFIER_COOKIE,
    AUTH_IDENTIFIER_TYPE_COOKIE,
    AUTH_IS_NEW_COOKIE,
  } from '@/lib/auth/identifier'
  import { getPublicLocale } from '@/lib/i18n/getLocale'
  import { tracedAction } from '@/lib/effect/traced'

  const sendOtpLimit = createRateLimit({ action: 'send_otp', max: 3, windowMs: 15 * 60 * 1000 })

  const resend = new Resend(process.env.RESEND_API_KEY)

  const schema = z.object({
    identifier: z.string().min(1),
    returnTo: z.string().optional(),
  })

  export async function sendLoginOtp(
    formData: FormData
  ): Promise<{ success: false; error: string } | { success: true; isNew: boolean }> {
    return tracedAction('sendLoginOtp', {}, async () => {
    const parsed = schema.safeParse({
      identifier: formData.get('identifier'),
      returnTo: formData.get('returnTo') || undefined,
    })
    if (!parsed.success) return { success: false, error: 'Please enter an email or phone number.' }

    const { returnTo } = parsed.data
    const rawIdentifier = parsed.data.identifier.trim()

    const identifierType = detectIdentifierType(rawIdentifier)
    if (!identifierType) return { success: false, error: 'Please enter a valid email or phone number.' }

    // Phone OTP is feature-flagged on the TWILIO_* env vars — without them the
    // app is email-only and phone identifiers are rejected up front.
    if (identifierType === 'phone' && !isTwilioEnabled()) {
      return { success: false, error: 'Phone sign-in is not available. Please use your email.' }
    }

    // Emails are case-insensitive — lowercase so "User@…" matches the existing
    // "user@…" person instead of creating a duplicate account.
    const identifier = identifierType === 'phone' ? normalizePhone(rawIdentifier) : rawIdentifier.toLowerCase()

    const ip = await getClientIp()
    const limit = await sendOtpLimit.check(identifier, ip)
    if (!limit.ok) return { success: false, error: limit.error }

    const cookieStore = await cookies()
    const cookieOpts = {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge:   60 * 15,
      path:     '/',
    }

    if (returnTo) {
      cookieStore.set(AUTH_RETURN_TO_COOKIE, returnTo, cookieOpts)
    } else {
      cookieStore.delete(AUTH_RETURN_TO_COOKIE)
    }

    // Check if a person exists for the channel they used
    const existing = identifierType === 'email'
      ? await db.select().from(persons).where(eq(persons.email, identifier)).limit(1)
      : await db.select().from(persons).where(eq(persons.phoneNumber, identifier)).limit(1)

    if (existing.length === 0) {
      // New user — skip OTP, go to register
      cookieStore.set(AUTH_IDENTIFIER_COOKIE, identifier, cookieOpts)
      cookieStore.set(AUTH_IDENTIFIER_TYPE_COOKIE, identifierType, cookieOpts)
      cookieStore.set(AUTH_IS_NEW_COOKIE, '1', cookieOpts)
      await transitions.identify.grant()
      return { success: true, isNew: true }
    }

    // Existing user — send the OTP over the matching channel
    if (identifierType === 'email') {
      const { code } = await createEmailOtp(identifier)
      // DEV convenience: print the code to the server console so you can log in
      // locally without waiting on email delivery. Never runs in production.
      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n[auth] DEV login code for ${identifier} -> ${code}\n`)
      }
      const { error } = await resend.emails.send({
        from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
        to:      identifier,
        subject: 'Your login code',
        html:    `<p>Your login code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
      })
      if (error) return { success: false, error: 'Failed to send code. Please try again.' }
    } else {
      // SMS language follows the visitor's resolved locale, never a hardcoded tag.
      const result = await sendTwilioOtp(identifier, await getPublicLocale())
      if (!result.success) return { success: false, error: result.error }
    }

    cookieStore.set(AUTH_IDENTIFIER_COOKIE, identifier, cookieOpts)
    cookieStore.set(AUTH_IDENTIFIER_TYPE_COOKIE, identifierType, cookieOpts)
    await transitions.identify.grant()

    return { success: true, isNew: false }
    })
  }
  ```
- [ ] Step: rewrite `app/auth/identify/_components/LoginForm/LoginForm.tsx` with exactly this content (template layout kept — no AuthShell/Field/Card, those are irene-branded/phase-8; copy onto `useT()`; field `email`→`identifier` with combined autocomplete + help text):
  ```tsx
  'use client'

  import { scene } from './scene'
  import { sendLoginOtp } from './actions'
  import type { State } from './state'
  import { route } from '../../contract'
  import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
  import { useFormValues } from '@/lib/hooks/useFormValues'
  import { useT } from '@/lib/i18n/LocaleProvider'
  import { Input } from '@/components/ui/Input'
  import { Button } from '@/components/ui/Button'
  import { Label } from '@/components/ui/Label'

  export function LoginForm({ initialState, returnTo }: { initialState: State; returnTo?: string }) {
    const [state, send, reset] = scene.useScene(initialState)
    const form = useFormValues()
    const t = useT()
    useRedirectOnSuccess(state, [reset, form.reset])

    const handleSubmit = async (formData: FormData) => {
      form.capture(formData)
      send({ type: 'SUBMIT' })
      const result = await sendLoginOtp(formData)
      if (result.success) send({ type: 'SUCCESS', redirectTo: result.isNew ? route.exits.register() : route.exits.verify() })
      else send({ type: 'ERROR', message: result.error })
    }

    const header = (
      <div key="header" className="text-center">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">{t.auth.identify.title}</h1>
        <p className="text-muted-foreground">{t.auth.identify.subtitle}</p>
      </div>
    )

    switch (state.status) {
      case 'idle':
      case 'submitting':
      case 'error':
        return (
          <div key="login" className="space-y-8">
            {header}
            <form key="form" action={handleSubmit} className="space-y-4">
              {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
              <div className="space-y-2">
                <Label htmlFor="identifier">{t.auth.identify.identifierLabel}</Label>
                <Input
                  key="identifier"
                  id="identifier"
                  name="identifier"
                  type="text"
                  inputMode="email"
                  autoComplete="email tel"
                  aria-describedby="identifier-help"
                  required
                  defaultValue={form.values.identifier}
                  onChange={() => {
                    if (state.status === 'error') send({ type: 'RETRY' })
                  }}
                  placeholder={t.auth.identify.identifierPlaceholder}
                />
                <p id="identifier-help" className="text-xs text-muted-foreground">
                  {t.auth.identify.identifierHelp}
                </p>
              </div>

              {state.status === 'error' && (
                <p data-testid="error-message" className="text-sm text-destructive">{state.message}</p>
              )}

              <Button key="submit" type="submit" disabled={state.status === 'submitting'}>
                {state.status === 'submitting' ? t.auth.identify.submitting : t.auth.identify.submit}
              </Button>
            </form>
          </div>
        )
      case 'success':
        return (
          <div key="login" className="space-y-8">
            {header}
            <form key="form" className="space-y-4 opacity-60" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <Label htmlFor="identifier">{t.auth.identify.identifierLabel}</Label>
                <Input key="identifier" id="identifier" name="identifier" type="text" disabled defaultValue={form.values.identifier} placeholder={t.auth.identify.identifierPlaceholder} />
              </div>

              <p className="text-sm text-muted-foreground">{t.common.redirecting}</p>

              <Button key="submit" type="button" disabled>
                {t.common.redirecting}
              </Button>
            </form>
          </div>
        )
    }
  }
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -c 'auth_email\|formData.get(.email.)' app/auth/identify/_components/LoginForm/actions.ts` → expected: `0`. Run: `npm run build-storybook` → expected: exit 0 (LoginForm stories render with the `useT` default-locale context — `LocaleProvider`'s context default is `DEFAULT_LOCALE`, no decorator needed).
- [ ] Step: commit —
  ```
  git add app/auth/identify/_components/LoginForm/actions.ts app/auth/identify/_components/LoginForm/LoginForm.tsx
  git commit -m "backport(auth): identify step on a single identifier field (email or phone)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.10: Register step onto identifier + guarded redirect (drop `as string`)

**Files:**
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/register/_components/RegisterForm/state.ts` (11 lines)
- Modify: `/Users/luca/dev/winter-park/template/app/auth/register/_components/RegisterForm/transition.ts` (line 10)
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/register/_components/RegisterForm/fixtures.ts` (9 lines)
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/register/_components/RegisterForm/actions.ts` (65 lines + Task 5.1 edit)
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/register/_components/RegisterForm/RegisterForm.tsx` (105 lines)
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/register/page.tsx` (15 lines — redirect hardening)
- NOT touched: `scene.ts`, `entry.ts`, `contract.ts`, `layout.tsx`, `RegisterForm.stories.tsx`, `page.stories.tsx` (stories pass fixture objects through — they follow the new `State` automatically).

**Interfaces:**
- Consumes: Task 5.3 (`IdentifierType`, cookies), 5.4 (`sendTwilioOtp`, `isTwilioEnabled`), 5.6 (`persons.phoneNumber`), 5.7 (`getAuthIdentifier`), 5.8 (`Messages['auth']['register']`), phase 3 (`tracedAction`), phase 4 (`getPublicLocale`, `useT`).
- Produces: `registerAction(formData: FormData): Promise<{ success: false; error: string } | { success: true }>` reading `identifier`/`identifierType`/`name`; `State` for RegisterForm = irene's shape (`identifier: string; identifierType: IdentifierType` on every status). Template keeps its SINGLE optional `name` field — irene's required `name`+`lastName` split is a salon product choice and does NOT port.

**Steps:**

- [ ] Step: rewrite `state.ts` with exactly this content (irene verbatim):
  ```typescript
  import type { IdentifierType } from '@/lib/auth/identifier'

  export type State =
    | { status: 'idle';       identifier: string; identifierType: IdentifierType }
    | { status: 'submitting'; identifier: string; identifierType: IdentifierType }
    | { status: 'error';      identifier: string; identifierType: IdentifierType; message: string }
    | { status: 'success';    identifier: string; identifierType: IdentifierType; redirectTo: string }

  export type Event =
    | { type: 'SUBMIT' }
    | { type: 'ERROR';   message: string }
    | { type: 'SUCCESS'; redirectTo: string }
    | { type: 'RETRY' }
  ```
- [ ] Step: edit `transition.ts` — one edit (spread carries the identifier fields):
  - old (line 10): `      if (event.type === 'SUCCESS') return { status: 'success', email: state.email, redirectTo: event.redirectTo }`
  - new: `      if (event.type === 'SUCCESS') return { ...state, status: 'success', redirectTo: event.redirectTo }`
- [ ] Step: rewrite `fixtures.ts` with exactly this content (irene's incl. the `idlePhone` variant):
  ```typescript
  import type { State } from './state'
  import { route } from '../../contract'

  export const fixtures = {
    idle:       { status: 'idle',       identifier: 'user@example.com', identifierType: 'email' }                                   satisfies State,
    idlePhone:  { status: 'idle',       identifier: '+15550000000',     identifierType: 'phone' }                                   satisfies State,
    submitting: { status: 'submitting', identifier: 'user@example.com', identifierType: 'email' }                                   satisfies State,
    error:      { status: 'error',      identifier: 'user@example.com', identifierType: 'email', message: 'Something went wrong.' } satisfies State,
    success:    { status: 'success',    identifier: 'user@example.com', identifierType: 'email', redirectTo: route.exits.verify() }  satisfies State,
  }
  ```
- [ ] Step: rewrite `actions.ts` with exactly this content (port of irene's `registerAction` — deltas vs irene: `person`→`persons`, single optional `name` (no `lastName`), NEW `isTwilioEnabled()` gate, NEW dev OTP print, `sendTwilioOtp(identifier)`→`(identifier, await getPublicLocale())`, `from` fallback de-branded, BS-121 comment generalized, unused `type IdentifierType` import dropped):
  ```typescript
  'use server'

  import { z } from 'zod'
  import { cookies } from 'next/headers'
  import { db } from '@/db/drizzle'
  import { persons } from '@/db/schema'
  import { eq } from 'drizzle-orm'
  import { createEmailOtp } from '@/lib/otp/email-otp'
  import { sendTwilioOtp } from '@/lib/twilio/send-otp'
  import { isTwilioEnabled } from '@/lib/twilio/config'
  import { Resend } from 'resend'
  import { transitions } from '@/app/auth/guards'
  import { createRateLimit, getClientIp } from '@/lib/rate-limit'
  import {
    AUTH_IDENTIFIER_COOKIE,
    AUTH_IDENTIFIER_TYPE_COOKIE,
    AUTH_IS_NEW_COOKIE,
  } from '@/lib/auth/identifier'
  import { getPublicLocale } from '@/lib/i18n/getLocale'
  import { tracedAction } from '@/lib/effect/traced'

  const registerLimit = createRateLimit({ action: 'register', max: 3, windowMs: 15 * 60 * 1000 })

  const resend = new Resend(process.env.RESEND_API_KEY)

  const schema = z.object({
    identifier:     z.string().min(1),
    identifierType: z.enum(['phone', 'email']),
    name:           z.string().trim().optional(),
  })

  export async function registerAction(
    formData: FormData
  ): Promise<{ success: false; error: string } | { success: true }> {
    return tracedAction('registerAction', {}, async () => {
    const parsed = schema.safeParse({
      identifier:     formData.get('identifier'),
      identifierType: formData.get('identifierType'),
      name:           formData.get('name') || undefined,
    })
    if (!parsed.success) return { success: false, error: 'Invalid input.' }

    const { identifierType, name } = parsed.data
    // Canonicalize email to lowercase so accounts are case-insensitive.
    const identifier = identifierType === 'email' ? parsed.data.identifier.toLowerCase() : parsed.data.identifier

    // Defense-in-depth: the identify step already gates phone, but the cookie
    // round-trip means this action must fail closed too if Twilio is unset.
    if (identifierType === 'phone' && !isTwilioEnabled()) {
      return { success: false, error: 'Phone sign-up is not available. Please use your email.' }
    }

    const ip = await getClientIp()
    const limit = await registerLimit.check(identifier, ip)
    if (!limit.ok) return { success: false, error: limit.error }

    // Check the person doesn't already exist
    const existing = identifierType === 'email'
      ? await db.select().from(persons).where(eq(persons.email, identifier)).limit(1)
      : await db.select().from(persons).where(eq(persons.phoneNumber, identifier)).limit(1)

    if (existing.length > 0) return { success: false, error: 'Account already exists.' }

    // Create the person with the identifier they used. Stamp the locale the
    // visitor ACTUALLY saw during signup (app.locale cookie override, else
    // DEFAULT_LOCALE) — persons.locale has a static default that must not
    // silently override what they experienced.
    await db.insert(persons).values({
      name:   name ?? null,
      locale: await getPublicLocale(),
      ...(identifierType === 'email' ? { email: identifier } : { phoneNumber: identifier }),
    })

    // Send the OTP over the matching channel
    if (identifierType === 'email') {
      const { code } = await createEmailOtp(identifier)
      // DEV convenience: print the code to the server console so you can log in
      // locally without waiting on email delivery. Never runs in production.
      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n[auth] DEV login code for ${identifier} -> ${code}\n`)
      }
      const { error } = await resend.emails.send({
        from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
        to:      identifier,
        subject: 'Your login code',
        html:    `<p>Your login code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
      })
      if (error) return { success: false, error: 'Failed to send code. Please try again.' }
    } else {
      const result = await sendTwilioOtp(identifier, await getPublicLocale())
      if (!result.success) return { success: false, error: result.error }
    }

    const cookieStore = await cookies()
    const cookieOpts = {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge:   60 * 15,
      path:     '/',
    }
    cookieStore.set(AUTH_IDENTIFIER_COOKIE, identifier, cookieOpts)
    cookieStore.set(AUTH_IDENTIFIER_TYPE_COOKIE, identifierType, cookieOpts)
    cookieStore.delete(AUTH_IS_NEW_COOKIE)
    await transitions.register.grant()

    return { success: true }
    })
  }
  ```
- [ ] Step: rewrite `RegisterForm.tsx` with exactly this content (template layout; identifier display switches label by type; copy onto `useT()`):
  ```tsx
  'use client'

  import { scene } from './scene'
  import { registerAction } from './actions'
  import type { State } from './state'
  import { route } from '../../contract'
  import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
  import { useFormValues } from '@/lib/hooks/useFormValues'
  import { useT } from '@/lib/i18n/LocaleProvider'
  import { Input } from '@/components/ui/Input'
  import { Button } from '@/components/ui/Button'
  import { Label } from '@/components/ui/Label'

  export function RegisterForm({ initialState }: { initialState: State }) {
    const [state, send, reset] = scene.useScene(initialState)
    const form = useFormValues()
    const t = useT()
    useRedirectOnSuccess(state, [reset, form.reset])

    const handleSubmit = async (formData: FormData) => {
      form.capture(formData)
      send({ type: 'SUBMIT' })
      const result = await registerAction(formData)
      if (result.success) send({ type: 'SUCCESS', redirectTo: route.exits.verify() })
      else send({ type: 'ERROR', message: result.error })
    }

    const identifierLabel = state.identifierType === 'email' ? t.auth.register.emailLabel : t.auth.register.phoneLabel

    const header = (
      <div key="header" className="text-center">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">{t.auth.register.title}</h1>
        <p className="text-muted-foreground">{t.auth.register.subtitle}</p>
      </div>
    )

    const identifierDisplay = (
      <div className="space-y-2">
        <Label>{identifierLabel}</Label>
        <p key="identifier-display" className="rounded-md border bg-muted px-3 py-2 text-sm tabular-nums text-muted-foreground">
          {state.identifier}
        </p>
      </div>
    )

    switch (state.status) {
      case 'idle':
      case 'submitting':
      case 'error':
        return (
          <div key="register" className="space-y-8">
            {header}
            <form key="form" action={handleSubmit} className="space-y-4">
              <input type="hidden" name="identifier" value={state.identifier} />
              <input type="hidden" name="identifierType" value={state.identifierType} />

              {identifierDisplay}

              <div className="space-y-2">
                <Label htmlFor="name">
                  {t.auth.register.nameLabel} <span className="text-muted-foreground">{t.common.optional}</span>
                </Label>
                <Input
                  key="name"
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  defaultValue={form.values.name}
                  onChange={() => {
                    if (state.status === 'error') send({ type: 'RETRY' })
                  }}
                  placeholder={t.auth.register.namePlaceholder}
                />
              </div>

              {state.status === 'error' && (
                <p data-testid="error-message" className="text-sm text-destructive">{state.message}</p>
              )}

              <Button key="submit" type="submit" disabled={state.status === 'submitting'}>
                {state.status === 'submitting' ? t.auth.register.submitting : t.auth.register.submit}
              </Button>
            </form>
          </div>
        )
      case 'success':
        return (
          <div key="register" className="space-y-8">
            {header}
            <form key="form" className="space-y-4 opacity-60" onSubmit={(e) => e.preventDefault()}>
              {identifierDisplay}

              <div className="space-y-2">
                <Label htmlFor="name">
                  {t.auth.register.nameLabel} <span className="text-muted-foreground">{t.common.optional}</span>
                </Label>
                <Input key="name" id="name" name="name" type="text" disabled defaultValue={form.values.name} placeholder={t.auth.register.namePlaceholder} />
              </div>

              <p className="text-sm text-muted-foreground">{t.auth.register.success}</p>

              <Button key="submit" type="button" disabled>
                {t.common.redirecting}
              </Button>
            </form>
          </div>
        )
    }
  }
  ```
- [ ] Step: rewrite `app/auth/register/page.tsx` with exactly this content (redirect hardening — replaces `cookieStore.get('auth_email')?.value as string`, which smuggled `undefined` through a string type on deep links; irene's page minus the AuthShell wrapper):
  ```tsx
  import { redirect } from 'next/navigation'
  import { RegisterForm } from './_components/RegisterForm/RegisterForm'
  import { getAuthIdentifier } from '@/app/auth/guards'
  import { entry as identifyEntry } from '@/app/auth/identify/entry'

  export default async function RegisterPage() {
    // Typed, guarded read instead of `as string`: if the identifier cookie is
    // missing (deep link, expired flow), bounce to identify rather than
    // rendering with undefined smuggled through a string type. The layout
    // guard usually catches this first — this is the page-level backstop.
    const auth = await getAuthIdentifier()
    if (!auth) redirect(identifyEntry.href())

    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <RegisterForm initialState={{ status: 'idle', identifier: auth.identifier, identifierType: auth.type }} />
        </div>
      </div>
    )
  }
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -rn "as string\|auth_email" app/auth/register/` → expected: 0 matches. Run: `npm run build-storybook` → expected: exit 0 (RegisterForm + register page stories compile against the new fixtures).
- [ ] Step: commit —
  ```
  git add app/auth/register
  git commit -m "backport(auth): register step on identifier + guarded redirect (no more 'as string')

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.11: `OtpInput` component (input-otp)

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/package.json` (add dependency via npm)
- Create: `/Users/luca/dev/winter-park/template/components/ui/OtpInput.tsx` (port of `/Users/luca/dev/winter-park/irene/components/ui/OtpInput.tsx`, 83 lines)

**Interfaces:**
- Consumes: `cn` from `@/lib/utils` (existing); npm `input-otp@^1.4.2` (new); tailwind tokens `border-ring`/`ring-ring`/`bg-card`/`text-foreground`/`border-input`/`border-destructive` (all exist in the template today); `.otp-caret` blink keyframe (phase 2 — degrades to a steady caret bar when absent).
- Produces: `OtpInput({ name: string; id?: string; length?: number; autoFocus?: boolean; disabled?: boolean; defaultValue?: string; hasError?: boolean; onChange?: (value: string) => void })` from `@/components/ui/OtpInput` — one real hidden input named `name`, so `<form>` submission and `page.fill('input[name="code"]')` keep working (Task 5.12 swaps it into VerifyForm with `name="code"`). No Storybook story: irene never had one for this component (stories port only where the source had one).

**Steps:**

- [ ] Step: install dependency — Run: `cd /Users/luca/dev/winter-park/template && npm install input-otp@^1.4.2` → expected: exit 0, `input-otp` in `package.json` dependencies.
- [ ] Step: copy source — `cp /Users/luca/dev/winter-park/irene/components/ui/OtpInput.tsx /Users/luca/dev/winter-park/template/components/ui/OtpInput.tsx`
- [ ] Step: apply generalization edits (the component body already uses only neutral tokens — verified; the irene-isms are in comments):
  1. Doc comment line 12: `active slot shows a terracotta ring + blinking caret. No single-input overlay,` → `active slot shows a focus ring + blinking caret. No single-input overlay,`
  2. In `FakeCaret` (line 79), above the `<div className="otp-caret ...">` line add:
     ```tsx
         {/* .otp-caret (app/globals.css) blinks this bar; without the keyframe it renders steady */}
     ```
  3. No other edits — props, slot rendering, `SlotProps` import, and all class names port verbatim.
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -n 'terracotta\|salon\|irene' components/ui/OtpInput.tsx` → expected: 0 matches.
- [ ] Step: commit —
  ```
  git add package.json package-lock.json components/ui/OtpInput.tsx
  git commit -m "backport(ui): segmented OtpInput on input-otp (hidden real input keeps the name= form contract)

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.12: Verify step onto identifier — OtpInput swap, VerifySuccess scene, resend channel split

**Files:**
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/state.ts` (11 lines)
- Modify: `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/transition.ts` (line 9)
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/fixtures.ts` (9 lines)
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/actions.ts` (111 lines + earlier task edits)
- Modify: `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/useResendOtp.ts` (signature + action call)
- Create: `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/useVerifySuccess.ts` (port of irene's, 13 lines — verbatim)
- Create: `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/VerifySuccess.tsx` (port of irene's, 69 lines — neutral tokens)
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/verify/_components/VerifyForm/VerifyForm.tsx` (131 lines)
- Modify (full rewrite): `/Users/luca/dev/winter-park/template/app/auth/verify/page.tsx` (20 lines — guarded redirect hardening)
- NOT touched: `scene.ts`, `entry.ts`, `contract.ts`, `layout.tsx`, `VerifyForm.stories.tsx`, `page.stories.tsx` (both story files pass fixture objects through).

**Interfaces:**
- Consumes: 5.3 (`IdentifierType`, `AUTH_*_COOKIE`, `AUTH_SESSION_COOKIE`), 5.4 (`verifyTwilioOtp`, `sendTwilioOtp`), 5.5 (`createSessionToken({ userId: number })`), 5.6 (`persons.phoneNumber`), 5.7 (`getAuthIdentifier`, `transitions`, `AUTH_RETURN_TO_COOKIE`), 5.8 (`Messages['auth']['verify']`), 5.11 (`OtpInput`), phase 3 (`tracedAction`), phase 4 (`getPublicLocale`, `useT`); existing `verifyEmailOtp`, `createEmailOtp`, `framer-motion` (`motion`, `useReducedMotion`).
- Produces:
  - `verifyOtpAction(formData: FormData): Promise<{ success: false; error: string } | { success: true }>` — reads `identifier`/`identifierType`/`code`; person MUST pre-exist (register creates it); mints slim JWT + session row; clears all four flow cookies.
  - `resendOtpAction(identifier: string, identifierType: IdentifierType): Promise<{ success: true } | { success: false; error: string }>` — signature change consumed only by `useResendOtp`.
  - `useResendOtp(identifier: string, identifierType: IdentifierType, cooldownSeconds = 30)`.
  - `VerifySuccess({ title: string; hint: string })` + `useVerifySuccess(): { reduce: boolean | null }`.
  - The `input[name="code"]` contract is PRESERVED through the OtpInput swap (e2e `page.fill` untouched).

**Steps:**

- [ ] Step: rewrite `state.ts` with exactly this content (irene verbatim):
  ```typescript
  import type { IdentifierType } from '@/lib/auth/identifier'

  export type State =
    | { status: 'idle';       identifier: string; identifierType: IdentifierType }
    | { status: 'submitting'; identifier: string; identifierType: IdentifierType }
    | { status: 'error';      identifier: string; identifierType: IdentifierType; message: string }
    | { status: 'success';    identifier: string; identifierType: IdentifierType; redirectTo: string }

  export type Event =
    | { type: 'SUBMIT' }
    | { type: 'ERROR';   message: string }
    | { type: 'SUCCESS'; redirectTo: string }
    | { type: 'RETRY' }
  ```
- [ ] Step: edit `transition.ts` — one edit:
  - old (line 9): `      if (event.type === 'SUCCESS') return { status: 'success', email: state.email, redirectTo: event.redirectTo }`
  - new: `      if (event.type === 'SUCCESS') return { ...state, status: 'success', redirectTo: event.redirectTo }`
- [ ] Step: rewrite `fixtures.ts` with exactly this content:
  ```typescript
  import type { State } from './state'
  import { route } from '../../contract'

  export const fixtures = {
    idle:       { status: 'idle',       identifier: 'user@example.com', identifierType: 'email' }                                          satisfies State,
    idlePhone:  { status: 'idle',       identifier: '+15550000000',     identifierType: 'phone' }                                          satisfies State,
    submitting: { status: 'submitting', identifier: 'user@example.com', identifierType: 'email' }                                          satisfies State,
    error:      { status: 'error',      identifier: 'user@example.com', identifierType: 'email', message: 'Invalid or expired code.' }     satisfies State,
    success:    { status: 'success',    identifier: 'user@example.com', identifierType: 'email', redirectTo: route.exits.dashboard() }      satisfies State,
  }
  ```
- [ ] Step: rewrite `actions.ts` with exactly this content (port of irene's verify actions — deltas vs irene: plural tables (`persons`/`users`/`sessions`), template column `token` (NOT irene's `jwtToken`), slim `createSessionToken({ userId: user.id })`, `AUTH_SESSION_COOKIE` constant for the session cookie, NEW runtime zod validation on `resendOtpAction` (server actions are public endpoints — keeps template's safety bar; irene trusted the typed params), NEW dev OTP print in the resend email branch, `sendTwilioOtp` locale param, `from` fallback de-branded):
  ```typescript
  'use server'

  import { z } from 'zod'
  import { cookies, headers } from 'next/headers'
  import { db } from '@/db/drizzle'
  import { persons, users, sessions } from '@/db/schema'
  import { eq } from 'drizzle-orm'
  import { createEmailOtp, verifyEmailOtp } from '@/lib/otp/email-otp'
  import { sendTwilioOtp } from '@/lib/twilio/send-otp'
  import { verifyTwilioOtp } from '@/lib/twilio/verify-otp'
  import { createSessionToken } from '@/lib/auth/jwt'
  import { transitions, AUTH_RETURN_TO_COOKIE } from '@/app/auth/guards'
  import { createRateLimit, getClientIp } from '@/lib/rate-limit'
  import { Resend } from 'resend'
  import {
    AUTH_SESSION_COOKIE,
    AUTH_IDENTIFIER_COOKIE,
    AUTH_IDENTIFIER_TYPE_COOKIE,
    AUTH_IS_NEW_COOKIE,
    type IdentifierType,
  } from '@/lib/auth/identifier'
  import { getPublicLocale } from '@/lib/i18n/getLocale'
  import { tracedAction } from '@/lib/effect/traced'

  const verifyLimit = createRateLimit({ action: 'verify_otp', max: 5, windowMs: 15 * 60 * 1000 })
  const resendLimit = createRateLimit({ action: 'resend_otp', max: 3, windowMs: 15 * 60 * 1000 })

  const resend = new Resend(process.env.RESEND_API_KEY)

  const schema = z.object({
    identifier:     z.string().min(1),
    identifierType: z.enum(['phone', 'email']),
    code:           z.string().min(4).max(10),
  })

  export async function verifyOtpAction(
    formData: FormData
  ): Promise<{ success: false; error: string } | { success: true }> {
    return tracedAction('verifyOtpAction', {}, async () => {
    const parsed = schema.safeParse({
      identifier:     formData.get('identifier'),
      identifierType: formData.get('identifierType'),
      code:           formData.get('code'),
    })
    if (!parsed.success) return { success: false, error: 'Invalid input.' }

    const { identifierType, code } = parsed.data
    // Canonicalize email to lowercase so the OTP + person lookup are case-insensitive.
    const identifier = identifierType === 'email' ? parsed.data.identifier.toLowerCase() : parsed.data.identifier

    const ip = await getClientIp()
    const limit = await verifyLimit.check(identifier, ip)
    if (!limit.ok) return { success: false, error: limit.error }

    // Verify the OTP via the matching channel
    const isValid = identifierType === 'email'
      ? await verifyEmailOtp(identifier, code)
      : await verifyTwilioOtp(identifier, code)

    if (!isValid) return { success: false, error: 'Invalid or expired code. Please try again.' }

    // The person must already exist — registerAction created it for new users.
    const [person] = identifierType === 'email'
      ? await db.select().from(persons).where(eq(persons.email, identifier)).limit(1)
      : await db.select().from(persons).where(eq(persons.phoneNumber, identifier)).limit(1)

    if (!person) return { success: false, error: 'Account not found.' }

    // Find or create the auth role for this person
    let [user] = await db.select().from(users).where(eq(users.personId, person.id)).limit(1)
    if (!user) {
      const [created] = await db.insert(users).values({ personId: person.id }).returning()
      user = created
    }

    const token = await createSessionToken({ userId: user.id })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const headersList = await headers()
    await db.insert(sessions).values({
      userId:    user.id,
      token,
      expiresAt,
      userAgent: headersList.get('user-agent') ?? undefined,
      ipAddress: headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? undefined,
    })

    const cookieStore = await cookies()
    cookieStore.set(AUTH_SESSION_COOKIE, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 30,
      path:     '/',
    })
    cookieStore.set(AUTH_IDENTIFIER_COOKIE, '', { path: '/', maxAge: 0 })
    cookieStore.set(AUTH_IDENTIFIER_TYPE_COOKIE, '', { path: '/', maxAge: 0 })
    cookieStore.set(AUTH_IS_NEW_COOKIE, '', { path: '/', maxAge: 0 })
    cookieStore.set(AUTH_RETURN_TO_COOKIE, '', { path: '/', maxAge: 0 })
    await transitions.verify.grant()

    return { success: true }
    })
  }

  const resendSchema = z.object({
    identifier:     z.string().min(1),
    identifierType: z.enum(['phone', 'email']),
  })

  export async function resendOtpAction(
    identifier: string,
    identifierType: IdentifierType,
  ): Promise<{ success: true } | { success: false; error: string }> {
    return tracedAction('resendOtpAction', {}, async () => {
    // Server actions are public endpoints — runtime-validate even typed params.
    const parsed = resendSchema.safeParse({ identifier, identifierType })
    if (!parsed.success) return { success: false, error: 'Invalid input.' }

    const target = parsed.data.identifierType === 'email'
      ? parsed.data.identifier.toLowerCase()
      : parsed.data.identifier

    const ip = await getClientIp()
    const limit = await resendLimit.check(target, ip)
    if (!limit.ok) return { success: false, error: limit.error }

    if (parsed.data.identifierType === 'email') {
      const { code } = await createEmailOtp(target)
      // DEV convenience: print the code to the server console so you can log in
      // locally without waiting on email delivery. Never runs in production.
      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n[auth] DEV login code for ${target} -> ${code}\n`)
      }
      const { error } = await resend.emails.send({
        from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com',
        to:      target,
        subject: 'Your login code',
        html:    `<p>Your login code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
      })
      if (error) return { success: false, error: 'Failed to send code. Please try again.' }
    } else {
      const result = await sendTwilioOtp(target, await getPublicLocale())
      if (!result.success) return { success: false, error: result.error }
    }

    return { success: true }
    })
  }
  ```
- [ ] Step: edit `useResendOtp.ts` — three edits (signature onto identifier; the 5.2 leak fix is already in place and stays):
  1. After the line `import { resendOtpAction } from './actions'` add:
     ```ts
     import type { IdentifierType } from '@/lib/auth/identifier'
     ```
  2. old: `export function useResendOtp(email: string, cooldownSeconds = 30) {`
     new: `export function useResendOtp(identifier: string, identifierType: IdentifierType, cooldownSeconds = 30) {`
  3. old: `    const result = await resendOtpAction(email)`
     new: `    const result = await resendOtpAction(identifier, identifierType)`
     and old dependency array: `  }, [email, cooldownSeconds])`
     new: `  }, [identifier, identifierType, cooldownSeconds])`
- [ ] Step: Create `useVerifySuccess.ts` with exactly this content (irene verbatim — hooks extracted per the template invariant "hooks live only in custom hook files"):
  ```typescript
  'use client'

  import { useReducedMotion } from 'framer-motion'

  /**
   * Reads the user's reduced-motion preference for the auth-success scene.
   * Extracted from `VerifySuccess` so no React hooks live in the component body.
   */
  export function useVerifySuccess() {
    const reduce = useReducedMotion()
    return { reduce }
  }
  ```
- [ ] Step: Create `VerifySuccess.tsx` with exactly this content (port of irene's — enumerated token edits: `bg-terracotta/30`→`bg-primary/30`, `bg-terracotta text-terracotta-foreground`→`bg-primary text-primary-foreground`, dot `bg-terracotta`→`bg-primary`; doc comment "terracotta disc"→"primary disc"; `primary` exists in the template today AND survives phase 2, so this task carries no ordering dependency on phase 2):
  ```tsx
  'use client'

  import { motion } from 'framer-motion'
  import { useVerifySuccess } from './useVerifySuccess'

  /**
   * Auth-success scene: a spring-scaled primary disc with a drawn-in
   * checkmark, a success burst ring, success copy and a subtle redirecting
   * affordance. Shown for the scene's success hold before the redirect fires.
   * Reduced-motion aware — every entrance collapses to a static render.
   */
  export function VerifySuccess({ title, hint }: { title: string; hint: string }) {
    const { reduce } = useVerifySuccess()

    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* burst ring */}
          {!reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary/30"
              initial={{ scale: 0.6, opacity: 0.6 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          )}

          {/* disc */}
          <motion.div
            className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            <svg
              viewBox="0 0 52 52"
              className="h-12 w-12"
              fill="none"
              stroke="currentColor"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                d="M14 27 L23 36 L39 18"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.18, duration: 0.4, ease: 'easeOut' }}
              />
            </svg>
          </motion.div>
        </div>

        <motion.div
          className="space-y-1"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.3 }}
        >
          <p className="text-xl font-semibold text-foreground">{title}</p>
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {/* .otp-caret (globals.css) blinks the dot; degrades to steady without it */}
            <span className="otp-caret inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            {hint}
          </p>
        </motion.div>
      </div>
    )
  }
  ```
- [ ] Step: rewrite `VerifyForm.tsx` with exactly this content (template layout — no AuthShell/Card/Field; OtpInput swapped in with the `name="code"` contract; success case = VerifySuccess replacing the disabled-form placeholder; copy onto `useT()`):
  ```tsx
  'use client'

  import { scene } from './scene'
  import { verifyOtpAction } from './actions'
  import { useResendOtp } from './useResendOtp'
  import type { State } from './state'
  import { route } from '../../contract'
  import { useRedirectOnSuccess } from '@/lib/hooks/useRedirectOnSuccess'
  import { useFormValues } from '@/lib/hooks/useFormValues'
  import { useT } from '@/lib/i18n/LocaleProvider'
  import { OtpInput } from '@/components/ui/OtpInput'
  import { Button } from '@/components/ui/Button'
  import { Label } from '@/components/ui/Label'
  import { VerifySuccess } from './VerifySuccess'

  export function VerifyForm({ initialState, returnTo }: { initialState: State; returnTo?: string }) {
    const [state, send, reset] = scene.useScene(initialState)
    const form = useFormValues()
    const t = useT()
    const resendOtp = useResendOtp(initialState.identifier, initialState.identifierType)
    useRedirectOnSuccess(state, [reset, form.reset], 2000)

    const title = state.identifierType === 'email' ? t.auth.verify.titleEmail : t.auth.verify.titlePhone

    const handleSubmit = async (formData: FormData) => {
      form.capture(formData)
      send({ type: 'SUBMIT' })
      const result = await verifyOtpAction(formData)
      if (result.success) send({ type: 'SUCCESS', redirectTo: returnTo ?? route.exits.dashboard() })
      else send({ type: 'ERROR', message: result.error })
    }

    const header = (
      <div key="header" className="text-center">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">
          {t.auth.verify.sentTo} <strong className="tabular-nums">{state.identifier}</strong>
        </p>
      </div>
    )

    switch (state.status) {
      case 'idle':
      case 'submitting':
      case 'error':
        return (
          <div key="verify" className="space-y-8">
            {header}
            <form key="form" action={handleSubmit} className="space-y-4">
              <input type="hidden" name="identifier" value={state.identifier} />
              <input type="hidden" name="identifierType" value={state.identifierType} />

              <div className="space-y-2">
                <Label htmlFor="code">{t.auth.verify.codeLabel}</Label>
                {/* Segmented input-otp field: one real hidden <input name="code">
                    drives six styled slots — numeric-only, OS one-time-code
                    autofill, paste fills every box. The form contract (and
                    e2e page.fill('input[name="code"]')) is unchanged. */}
                <OtpInput
                  id="code"
                  name="code"
                  autoFocus
                  defaultValue={form.values.code}
                  hasError={state.status === 'error'}
                  onChange={() => {
                    if (state.status === 'error') send({ type: 'RETRY' })
                  }}
                />
              </div>

              {state.status === 'error' && (
                <p data-testid="error-message" className="text-sm text-destructive">{state.message}</p>
              )}

              <Button key="submit" type="submit" disabled={state.status === 'submitting'}>
                {state.status === 'submitting' ? t.auth.verify.submitting : t.auth.verify.submit}
              </Button>
            </form>

            <div key="resend" className="text-center text-sm">
              {resendOtp.status === 'waiting' && (
                <p className="text-muted-foreground">{t.auth.verify.resendIn(resendOtp.secondsLeft)}</p>
              )}
              {resendOtp.status === 'ready' && (
                <button type="button" onClick={resendOtp.resend} className="text-primary underline-offset-4 hover:underline">
                  {t.auth.verify.resend}
                </button>
              )}
              {resendOtp.status === 'sending' && (
                <p className="text-muted-foreground">{t.auth.verify.sending}</p>
              )}
              {resendOtp.status === 'sent' && (
                <p className="text-muted-foreground">{t.auth.verify.sent}</p>
              )}
              {resendOtp.status === 'error' && (
                <div className="space-y-1">
                  <p className="text-destructive">{resendOtp.error}</p>
                  <button type="button" onClick={resendOtp.resend} className="text-primary underline-offset-4 hover:underline">
                    {t.common.tryAgain}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      case 'success':
        return (
          <div key="verify" className="space-y-8">
            {header}
            <VerifySuccess title={t.auth.verify.successTitle} hint={t.auth.verify.successHint} />
          </div>
        )
    }
  }
  ```
- [ ] Step: rewrite `app/auth/verify/page.tsx` with exactly this content (irene's page-level hardening minus the AuthShell wrapper — the guarded redirect replaces `cookieStore.get('auth_email')?.value as string`):
  ```tsx
  import { redirect } from 'next/navigation'
  import { cookies } from 'next/headers'
  import { VerifyForm } from './_components/VerifyForm/VerifyForm'
  import type { State } from './_components/VerifyForm/state'
  import { getAuthIdentifier, AUTH_RETURN_TO_COOKIE, transitions } from '@/app/auth/guards'
  import { entry as identifyEntry } from '@/app/auth/identify/entry'

  export default async function VerifyPage() {
    const auth = await getAuthIdentifier()
    // On success the verify action sets the session AND clears the identifier
    // cookie, then triggers a re-render of this route — at which point `auth`
    // is null. Without this guard the page would bounce to /identify (and
    // then, now logged-in, to the dashboard) BEFORE the client VerifySuccess
    // animation can paint. So, like the auth LAYOUT, respect the verify
    // transition guard: while it's active, stay on this route so the client
    // success scene plays out and drives its own delayed redirect.
    if (!auth && !(await transitions.verify.isActive())) redirect(identifyEntry.href())

    const cookieStore = await cookies()
    const returnTo = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value

    // During the success transition `auth` is null (cookie cleared) but the
    // client VerifyForm is already in its `success` state and is preserved
    // across this re-render — these idle fallbacks are never actually shown.
    const initialState: State = auth
      ? { status: 'idle', identifier: auth.identifier, identifierType: auth.type }
      : { status: 'idle', identifier: '', identifierType: 'email' }

    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <VerifyForm initialState={initialState} returnTo={returnTo} />
        </div>
      </div>
    )
  }
  ```
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0. Run: `grep -rn "auth_email\|as string" app/auth/` → expected: 0 matches (last consumers removed). Run: `npm run build-storybook` → expected: exit 0 (VerifyForm Idle/Submitting/Error/Success stories now render OtpInput + VerifySuccess). Run: `npx vitest run` → expected: exit 0.
- [ ] Step: commit —
  ```
  git add app/auth/verify
  git commit -m "backport(auth): verify step on identifier — OtpInput swap, VerifySuccess scene, resend channel split

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.13: E2E suite onto the identifier flow

**Files:**
- Modify: `/Users/luca/dev/winter-park/template/e2e/helpers/auth.ts` (lines 13, 19)
- Modify: `/Users/luca/dev/winter-park/template/e2e/helpers/cookies.ts` (lines 3–13)
- Modify: `/Users/luca/dev/winter-park/template/e2e/auth/guards.spec.ts` (lines 3, 20, 53, 57, 82)
- Modify: `/Users/luca/dev/winter-park/template/e2e/auth/full-flow.spec.ts` (line 51)
- Modify: `/Users/luca/dev/winter-park/template/e2e/auth/resend-otp.spec.ts` (line 20)
- NOT touched (verified against the irene diff): `e2e/auth/verify.spec.ts` (fills `input[name="code"]` — contract preserved by OtpInput; drives identify/register via helpers), `e2e/helpers/test-api.ts`, `e2e/setup/global-setup.ts` + `global-teardown.ts` (template's plural-table SQL is already correct — irene's singular-table SQL must NOT port), `playwright.config.ts`, `app/api/test/otp/route.ts` (email-channel OTP planting still matches the specs, which register with emails).

**Interfaces:**
- Consumes: the `input[name="identifier"]` field (5.9), single-`name` register form (5.10), `input[name="code"]` via OtpInput (5.12), cookie names `auth_identifier`/`auth_identifier_type`/`auth_is_new` (5.3/5.7).
- Produces: `completeIdentifyStep(page: Page, identifier: string)`; `setAuthIdentifierCookie(context: BrowserContext, identifier: string, identifierType?: 'phone' | 'email', isNew?: boolean)`; `completeRegisterStep(page, name = 'Test User')` (unchanged — template keeps one name field). Phase 12's QA harness builds on these helpers.

**Steps:**

- [ ] Step: edit `e2e/helpers/auth.ts` — two edits (template's explanatory comments stay):
  1. old (line 13): `export async function completeIdentifyStep(page: Page, email: string) {`
     new: `export async function completeIdentifyStep(page: Page, identifier: string) {`
  2. old (line 19): `  await page.fill('input[name="email"]', email)`
     new: `  await page.fill('input[name="identifier"]', identifier)`
  (No `completeRegisterStep` changes — the template register form keeps a single optional `name` field; irene's extra `lastName` fill must NOT port.)
- [ ] Step: edit `e2e/helpers/cookies.ts` — replace the `setAuthEmailCookie` function (lines 3–13) with:
  ```typescript
  export async function setAuthIdentifierCookie(
    context: BrowserContext,
    identifier: string,
    identifierType: 'phone' | 'email' = 'email',
    isNew = false
  ) {
    const base = { domain: 'localhost', path: '/' }
    await context.addCookies([
      { name: 'auth_identifier', value: identifier, ...base },
      { name: 'auth_identifier_type', value: identifierType, ...base },
      ...(isNew ? [{ name: 'auth_is_new', value: '1', ...base }] : []),
    ])
  }
  ```
  (`setReturnToCookie` and `setSessionCookie` are untouched.)
- [ ] Step: edit `e2e/auth/guards.spec.ts` — five edits:
  1. old (line 3): `import { setAuthEmailCookie, setSessionCookie } from '../helpers/cookies'`
     new: `import { setAuthIdentifierCookie, setSessionCookie } from '../helpers/cookies'`
  2. old (line 20): `  await page.fill('input[name="email"]', email)`
     new: `  await page.fill('input[name="identifier"]', email)`
  3. old (line 53): `test('/auth/register with existing auth_email (not new) → redirect to /auth/verify', async ({`
     new: `test('/auth/register with existing auth_identifier (not new) → redirect to /auth/verify', async ({`
  4. old (line 57): `  await setAuthEmailCookie(context, existingEmail, false)`
     new: `  await setAuthIdentifierCookie(context, existingEmail, 'email', false)`
  5. old (line 82): `  await setAuthEmailCookie(context, email, true)`
     new: `  await setAuthIdentifierCookie(context, email, 'email', true)`
- [ ] Step: edit `e2e/auth/full-flow.spec.ts` — one edit:
  - old (line 51): `    await page.fill('input[name="email"]', email)`
  - new: `    await page.fill('input[name="identifier"]', email)`
- [ ] Step: edit `e2e/auth/resend-otp.spec.ts` — one edit:
  - old (line 20): `    await page.fill('input[name="email"]', email)`
  - new: `    await page.fill('input[name="identifier"]', email)`
- [ ] Step: verification — Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0 (tsconfig includes `e2e/**`). Run: `npx playwright test --list` → expected: exit 0, all auth specs listed (collection compiles; no server needed). Run: `grep -rn 'name="email"\|setAuthEmailCookie' e2e/` → expected: 0 matches. Text assertions in `resend-otp.spec.ts` (`Resend code in \d+s`, `Resend code`, `Sending…`, `Code sent!`) and `verify.spec.ts` (`Invalid or expired code`) were preserved verbatim by Tasks 5.8/5.12's English copy — no spec copy edits needed.
- [ ] Step: live run — IF a scratch `DATABASE_URL` is configured (`.env.local` or env): Run: `npx playwright test` → expected: exit 0, all 4 auth spec files green (guards, full-flow incl. returnTo, resend, verify). If NO scratch DB is configured, defer the live run to phase 13's gate — the `--list` collection check above is this task's floor.
- [ ] Step: commit —
  ```
  git add e2e/helpers/auth.ts e2e/helpers/cookies.ts e2e/auth/guards.spec.ts e2e/auth/full-flow.spec.ts e2e/auth/resend-otp.spec.ts
  git commit -m "backport(e2e): auth specs onto the identifier flow

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5.14: Phase verification sweep

**Files:**
- None expected (fix-forward only if a check fails).

**Interfaces:**
- Consumes: everything this phase landed.
- Produces: the phase exit evidence.

**Steps:**

- [ ] Step: Run: `cd /Users/luca/dev/winter-park/template && npx tsc --noEmit` → expected: exit 0.
- [ ] Step: Run: `npx vitest run` → expected: exit 0 (schema invariants, identifier tests, twilio config tests, plus phase 3/4 suites).
- [ ] Step: Run: `npx eslint .` → expected: exit 0 (no unused imports left by the rewrites).
- [ ] Step: Run: `npm run build` → expected: exit 0 (migration runner line first — with no `DATABASE_URL` it warns and continues; then the Next build compiles all rewritten server actions).
- [ ] Step: Run: `npm run build-storybook` → expected: exit 0.
- [ ] Step: Run: `npx playwright test --list` → expected: exit 0.
- [ ] Step: irene-ism / dead-reference sweep — all of these must print `0` or nothing:
  - `grep -rn "auth_email\|auth_is_new'" app lib --include='*.ts' --include='*.tsx' | grep -v 'lib/auth/identifier.ts'` → expected: 0 matches (the string `auth_is_new` exists ONLY as the constant's value in `lib/auth/identifier.ts`)
  - `grep -rn "salon\|irene\|terracotta" lib/auth lib/twilio app/auth components/ui/OtpInput.tsx` → expected: 0 matches
  - `grep -rn "Locale: 'pt-BR'" lib/twilio` → expected: 0 matches
  - `grep -rn "verify.prolizz.com" app lib` → expected: 0 matches
  - `grep -rn "email:  string" lib/auth/jwt.ts` → expected: 0 matches (slim payload)
- [ ] Step: browser spot-check (only if a dev DB is configured): `npm run dev`, then walk identify → (register) → verify with a fresh email; confirm the dev OTP prints in the server console, the segmented OtpInput fills on paste, VerifySuccess plays its ~2s scene, and the dashboard loads authed. Kill the dev server after. If no DB: defer to phase 13's browser pass.
- [ ] Step: commit — only needed if a check above forced a fix:
  ```
  git add -A
  git commit -m "chore(auth): phase 5 verification sweep fixes

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

## Phase exit criteria

- `npx tsc --noEmit`, `npx vitest run`, `npx eslint .`, `npm run build`, `npm run build-storybook`, `npx playwright test --list` → all exit 0.
- `git log --oneline` shows the 13 task commits (+ optional sweep commit) on `backport/irene-2026-07`.
- Contract handed to later phases: `AUTH_SESSION_COOKIE`/`AUTH_*_COOKIE` + `IdentifierType` from `lib/auth/identifier.ts`; `SessionPayload = { userId: number }`; `persons.email` nullable + `persons.emailVerified` + `persons.phoneNumber` + partial uniques (phase 6 invite flow writes `emailVerified`, phase 6 converts `audit_log.workspaceId` to a real FK in ITS baseline regen); `completeIdentifyStep`/`setAuthIdentifierCookie` e2e helpers (phase 12 harness); `sendTwilioOtp(to, locale)` env-gated channel.
- Explicitly NOT done here (owned elsewhere): `requireAdmin`/`AdminGuardError` + the `requireAdminE`/`requireWorkspaceRoleE` stub bodies (phase 6 Tasks 6.3/6.4, despite phase 3's stub comment naming phase 5); `.otp-caret` keyframes (phase 2); sessions-table changes (none — pinned no-regression).
