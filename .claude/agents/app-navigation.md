# App Navigation Map

Living reference for the browser-verification agents (`browser-verifier-mcp`, `browser-verifier`) and QA reviewers. Documents routes, key selectors, and verification patterns. **Update this file whenever you discover something new about how a route renders or behaves** — the next run starts from your notes. This skeleton ships with the template; it grows with the app.

## Environment

- **Dev server:** `http://localhost:3000` (`npm run dev` — Turbopack)
- **Seed users** (from `node scripts/seed-demo.mjs`, all sentinel-scoped to `@demo.invalid`):
  - `owner@demo.invalid` — workspace role `owner` in the demo workspace
  - `member@demo.invalid` — workspace role `member`
  - `admin@demo.invalid` — platform role `admin` (no workspace membership)
- **Demo workspace:** slug `demo-workspace` (id printed by the seed run)

## Auth injection

Most routes are behind auth. Guarded layouts check a `session_token` cookie (JWT, HS256, 30d, signed with `AUTH_SECRET`) **plus** a matching `sessions` row whose `token` equals the cookie — `lib/auth/session.ts` checks both. **Inject auth; never drive the OTP flow from a verification agent** — it's slow and fragile.

### Recipe (one path for Playwright MCP and cmux)

```bash
# 1) Mint a session + storageState (defaults to owner@demo.invalid; override
#    with E2E_USER_EMAIL=<seed email> or E2E_USER_ID=<id>)
node scripts/playwright/auth-setup.mjs

# Playwright MCP: done — the server boots with .auth/app.json (see .mcp.json).
# If you re-mint while the MCP is already connected, reconnect it (/mcp) so it
# re-reads the state at boot.

# cmux: extract the cookie from the saved state and set it on the surface
TOKEN=$(node -e 'const s=require("./.auth/app.json");console.log(s.cookies.find(c=>c.name==="session_token").value)')
cmux browser --surface surface:N cookies set \
  --name session_token --value "$TOKEN" \
  --url http://localhost:3000 --path /

# 2) Navigate
cmux browser --surface surface:N navigate 'http://localhost:3000/dashboard'
```

The sessions row schema (verify against `db/schema/sessions.ts` if columns drift): `userId`, `token` (unique), `expiresAt`, `forceDeactivation` (defaults false), timestamps (default now).

## Routes

> Seed list from the template scaffold. As the app grows, add one row per route with the page name and the key content/selectors an agent needs to verify it.

### Public / unauthenticated

| Route | Page | Key Content |
|-------|------|--------------|
| `/` | Landing | Template landing page. |
| `/auth/identify` | Identifier entry | Form with identifier input + submit; entry to the OTP flow. |
| `/auth/verify` | OTP verify | Code input; reached from identify. |
| `/auth/register` | Registration | Profile fields for first-time users. |
| `/invite/[token]` | Invite accept | Public with a valid token; provisions membership + signs in. |
| `/docs` · `/docs/<slug>` | Docs site | Rendered from `docs/*.md` (session-gated in production builds). |

### Authenticated

| Route | Page | Key Content |
|-------|------|--------------|
| `/dashboard` | Dashboard | Session-guarded home; bounces to `/auth/identify` logged out. Default `E2E_VERIFY_PATH`. |
| `/onboarding` | Onboarding | Landing for users with 0 workspace memberships. |
| `/workspace/[workspaceId]` | Workspace home | Membership-guarded (owner/member) tenant surface. |

## Design-system signatures

> Placeholder. When the app settles on visual primitives (cards, badges, amount/status components), document their DOM signatures here with one cheap `eval` assertion each, so verifier/`qa-ux` agents can check visual consistency without screenshots. Example shape:
>
> - `<Card>` surface — `section.rounded.border` with `bg-card` → `eval`: `document.querySelectorAll('section.rounded.border').length`

## Controlled-input fill trick

`fill`/`type` (cmux or Playwright) only set the DOM `value` — they do NOT trigger React's `onChange` for controlled `<input value={state} …>` patterns, so React state never updates and the submit button stays disabled. Use the React-aware setter:

```js
const inp = document.querySelector('#some-input')
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
setter.call(inp, 'Test value')
inp.dispatchEvent(new Event('input', { bubbles: true }))
```

Same trick on `<select>` with `HTMLSelectElement.prototype` and `dispatchEvent(new Event('change', { bubbles: true }))`.

Uncontrolled inputs (`defaultValue={…}` only — the template's preferred form pattern, see `docs/forms.md`) accept plain `fill` directly. Inspect the JSX first if unsure.

## Common pitfalls

- **Streaming SSR wedge** — after multiple HMR cycles, a page can hang on `app/loading.tsx`. Symptom: `eval 'document.querySelectorAll("button").length'` → `0` with the loading overlay still in the DOM. Recovery: hard reload (`eval 'location.reload(true)'`); if it persists, ask the dispatching agent to restart the dev server.
- **`use cache` + `cookies()`** — if the console shows `Route X used cookies() inside "use cache"`, surface it to the dispatching agent: it's an app bug (dynamic data read inside a cache scope), not a harness problem.

## Self-update instruction

When you learn something durable about a route (a selector, a quirk, a state that needs seeding, a bug that keeps biting), **edit this file in the same run** — add or update the route row / pitfall. Keep entries terse and factual. Agent-specific memory goes to `.claude/agent-memory/<agent>/` instead.
