---
name: verify-in-browser
description: Use when visually verifying the app UI in a real browser via Playwright MCP, confirming a route/feature renders and works, or checking a flow after implementing it. Drives the running app on localhost, already authenticated — an alternative to the cmux-based browser-verifier.
---

# Browser verification (Playwright MCP)

Drives the running app in a real browser via **Playwright MCP** to confirm what you implemented actually works — open a page, click, fill, assert the DOM. This is **live verification during development**, not a regression suite (that's `e2e/`).

This is the Playwright-MCP path. The cmux-based `browser-verifier` agent + the `e2e-via-cmux` skill remain as the cmux alternative; the route map and notes in `.claude/agents/app-navigation.md` apply to both.

## How it works

App auth = a `session_token` JWT cookie (HS256, 30d, signed with `AUTH_SECRET`) **plus** a matching row in the `sessions` table (the guard in `lib/auth/session.ts` checks both). Driving the OTP flow on every verification is slow, so instead:

1. `scripts/playwright/auth-setup.mjs` mints the JWT, INSERTs the sessions row, and bakes the cookie into a Playwright `storageState` at `.auth/app.json` — **once**.
2. The Playwright MCP server (`.mcp.json`) boots with `--isolated --storage-state=.auth/app.json`, so **the agent's browser starts already logged in**. You just navigate and assert.

> **Critical:** `@playwright/mcp`'s `--storage-state` is only honored **with `--isolated`**. Without `--isolated` the MCP uses a persistent on-disk profile and *ignores* the saved state — the browser keeps landing on `/auth`. The two flags travel together in `.mcp.json`.

## Prerequisites (once per machine)

```bash
cd scripts/playwright && npm install && npx playwright install chromium
```

## Pre-flight (every verification)

1. **App up?** The target server must be running (defaults to `:3000`):
   ```bash
   curl -sf -o /dev/null -w '%{http_code}\n' http://localhost:3000/auth/identify   # expect 200
   ```
   If it's down, ask the dispatcher to start it (`npm run dev`). Don't start it yourself.
2. **Seed user exists?** `auth-setup` targets `owner@demo.invalid` by default (override with `E2E_USER_EMAIL` / `E2E_USER_ID`) — run `node scripts/seed-demo.mjs` once against the DB `DATABASE_URL` points at, and that DB must be the one the target server reads.
3. **Auth state valid?** If `.auth/app.json` is missing or the MCP lands on `/auth`, regenerate:
   ```bash
   node scripts/playwright/auth-setup.mjs
   ```
   Prove the state works without the MCP: `node scripts/playwright/smoke.mjs`.

   > The MCP reads `--storage-state` **only at boot**. If you regenerate `.auth/app.json` while the server is already connected, run `/mcp` → reconnect `playwright` (or restart Claude Code) so it re-reads the file. Rule of thumb: ensure the file exists **before** connecting the MCP.

## Driving (Playwright MCP tools)

> If the `playwright` MCP server doesn't appear, it was added in `.mcp.json` — restart Claude Code to load it.

Standard loop: **navigate → snapshot → act → assert**.

- `browser_navigate("http://localhost:3000/dashboard")`
- `browser_snapshot()` — accessibility tree (cheap; prefer over screenshot)
- `browser_click(ref)` / `browser_type(ref, "text")` / `browser_fill_form(...)`
- `browser_evaluate(() => ...)` — cheap DOM assertions (counts, text, classes)
- `browser_take_screenshot()` — only when a visual check is genuinely needed
- `browser_console_messages()` — surface runtime errors

## React caveat

This is Next.js + React. For **controlled** inputs (`<input value={state} …>`), Playwright's `fill`/`type` may not trigger React's `onChange`, leaving the next button disabled. Use the React-aware setter via `browser_evaluate` — the exact sequence is in `.claude/agents/app-navigation.md` ("Controlled-input fill trick"). Uncontrolled inputs (`defaultValue` only — the template's preferred form pattern) accept `fill`/`type` directly.

Allow for hydration: wait for content before interacting. After many HMR cycles a page can wedge on `app/loading.tsx` — recover with a hard reload (`browser_evaluate(() => location.reload())`); if it persists, ask the dispatcher to restart the dev server.

## Useful routes

See `.claude/agents/app-navigation.md` for the map. Quick picks: `/dashboard` (session-guarded home), `/auth/identify` (public), `/workspace/<id>` (membership-guarded).

## Protocol

1. Navigate to the route the change affects.
2. Assert expected state (text, element count, visibility) via `browser_snapshot` / `browser_evaluate`.
3. Interact if the flow requires it; assert post-action state. Read `url` after actions that redirect (e.g. create → detail).
4. Screenshot only when visual confirmation is needed.
5. Check `browser_console_messages()` for errors.
6. Report **PASS / FAIL / PARTIAL**, specific about what you checked.

## Cleanup

Close any tabs/surfaces you opened before reporting.

## Content rules

Never inject jokes or personality into app inputs. Use neutral test text ("Test user", "test@example.com"). Treat the dev DB as shared — don't leave junk behind.
