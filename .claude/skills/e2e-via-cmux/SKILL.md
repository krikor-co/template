---
name: e2e-via-cmux
description: Manually test the running Next.js app end-to-end through a cmux browser pane and the Postgres DB. Use when the user asks to "run the app", "test the app", "verify a feature", "spawn a tab", or open a browser to drive flows. Captures hard-won lessons about React-controlled inputs, Next 16 streaming SSR, HMR wedges, and DB-truth verification.
---

You are running this project's Next.js dev server and driving its UI via a cmux browser pane to verify behavior end-to-end. The DB is the source of truth; the UI is what you click.

## Before you start

1. Confirm a cmux browser surface exists or spawn one:
   ```bash
   cmux new-pane --type browser --direction right --workspace workspace:<id> --url http://localhost:3000
   ```
   Capture the returned `surface:NN` — every subsequent call uses `--surface surface:NN`.

2. Start the dev server and capture its logs:
   ```bash
   npm run dev   # run_in_background: true
   ```
   Wait for `Ready in` in the output before navigating. Use `until grep -q "Ready in" <logfile>; do sleep 1; done`.

3. Inject an auth session — don't drive OTP through the UI:
   - Easiest: `node scripts/playwright/auth-setup.mjs` (mints the JWT, INSERTs the `sessions` row, saves `.auth/app.json` — defaults to `owner@demo.invalid` from `scripts/seed-demo.mjs`), then extract the cookie value:
     `TOKEN=$(node -e 'const s=require("./.auth/app.json");console.log(s.cookies.find(c=>c.name==="session_token").value)')`
   - Manual alternative: mint a JWT mirroring `lib/auth/jwt.ts` (slim payload `{ userId }`, `AUTH_SECRET`) and INSERT a matching `sessions` row (`user_id`, `token`, `expires_at`).
   - Set the `session_token` cookie:
     ```bash
     cmux browser --surface surface:NN cookies set \
       --name session_token --value "$TOKEN" \
       --url http://localhost:3000 --path /
     ```

## Driving the UI

### Buttons

Plain `button.click()` via `cmux ... eval` works for **most** buttons. When the click is blocked by React event ordering, fall back to an explicit synthetic-event sequence:

```js
const c = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Continue")
;["pointerdown","mousedown","pointerup","mouseup","click"].forEach(t => {
  c.dispatchEvent(new MouseEvent(t, {bubbles:true, cancelable:true, view:window, button:0}))
})
```

`cmux browser ... click <selector>` sometimes raises `js_error: A JavaScript exception occurred`. When that happens, use eval-based click instead.

### Controlled inputs (CRITICAL)

`cmux browser fill` and `cmux browser type` set the DOM `value` but **don't trigger React's synthetic onChange**. For any `<input value={state} onChange={…}>`, this means React state never updates and the next button stays disabled.

The fix is the React-aware setter trick:

```js
const inp = document.querySelector("#amt-1")
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
setter.call(inp, "30")
inp.dispatchEvent(new Event("input", {bubbles: true}))
```

Same trick for `<select>` (use `HTMLSelectElement.prototype` and dispatch `"change"`).

Uncontrolled inputs (`defaultValue={…}` only) accept `cmux fill` directly — but inspect the JSX before assuming.

### Checkboxes & labels

`.click()` on either the input or the wrapping `<label>` works fine and triggers React state. Don't use the React setter trick for these.

## Reading state

- `cmux browser url` — current URL (use to verify redirects)
- `cmux browser eval 'document.querySelector("section h2")?.textContent'` — heading
- `cmux browser eval '[...document.querySelectorAll("input[type=number]")].map(i => ({id:i.id, val:i.value}))'`
- `cmux browser eval 'document.querySelector("section > div")?.textContent'` — small summary blocks

For large pages, `cmux browser get text body` returns hydration-stream noise (mostly RSC payload). Prefer scoped `eval` queries.

`cmux browser get title` and `get url` are short and useful.

## DB-truth verification

**The UI is a hypothesis; the DB is the truth.** After every mutation flow, query Postgres and verify the row(s) match what you expect:

```bash
node scripts/qa/sql.mjs "SELECT id, email, name FROM persons ORDER BY id DESC LIMIT 5"
```

Pattern:

1. **Pre-state**: snapshot relevant rows / counts
2. **Drive UI**: navigate, fill, click, submit
3. **Post-state**: re-query, diff
4. **Inspect joins**: don't just check the parent row — verify the child rows too (e.g. a signup should create `persons` + `users` + a `sessions` row).

Foreign-key + NOT NULL columns will surface schema drift the type-checker can't see (see "Schema drift" below).

## Next.js 16 + Turbopack gotchas

These will eat hours if you don't recognize them.

### `cookies()` is forbidden inside `'use cache'`

Any cached function that ends up calling `getSession()`/`cookies()` throws at runtime:

> Route X used `cookies()` inside "use cache". Accessing Dynamic data sources inside a cache scope is not supported.

Fix: do auth/session checks **outside** the cached scope; the cached function takes whatever dynamic data it needs as a parameter.

### `cookies().set()` is forbidden in layouts

Layouts can read cookies but not write them. Use search-param round-trips (e.g. `returnTo` as `?returnTo=...`) or move the write to a Route Handler / Server Action.

### `'use server'` + `'use cache'` on the same function

Combining them silently misbehaves — the loader fires but returns stale/empty results. Split concerns: keep `'use cache'` on a plain server function in `query.ts`; have the action in `actions.ts` (`'use server'`) call that query and never declare its own `'use cache'`.

### `export type { X }` from a `'use server'` file breaks at runtime

Server-action files can only export async functions. Re-exporting a type errors with `X is not defined` when the file is loaded by a client component. Fix: import the type directly from its source module.

### HMR `useEffect` deps array length change

Editing a `useEffect`'s deps array length while HMR is hot triggers:

> The final argument passed to useEffect changed size between renders.

The effect silently stops firing until a hard reload. Prefer adding a single `// eslint-disable-next-line react-hooks/exhaustive-deps` and keeping the array stable across edits, or cmd+R.

### Streaming-SSR / Suspense wedge

After multiple HMR cycles + restarts, the page can stay stuck on the global `app/loading.tsx` overlay because the `<div hidden id="S:0">` swap never fires. Symptoms:

- `cmux browser eval 'document.querySelectorAll("button").length'` → `0`
- `<div class="fixed inset-0 ...">` overlay still in DOM
- Server log shows GETs but no POSTs to client-driven server actions

Recovery, in order:

1. `cmux browser eval 'location.reload(true)'`
2. `cmux browser navigate about:blank` then re-navigate to the URL
3. Restart the dev server: `pkill -f "next dev"; npm run dev`
4. Clear the dev cache and restart: `rm -rf .next; pkill -f "next dev"; npm run dev` (ask the user before destroying caches)

When in doubt, do (3) early. The cost is 30s; the cost of debugging a wedged HMR is much higher.

## Schema drift

Drizzle does not validate that schema files match the actual DB columns. Symptoms:

- `tsc --noEmit` passes but a query fails at runtime with `column "X" does not exist`
- Or insertions fail with `null value in column "Y" violates not-null constraint`

Always cross-check before trusting a schema file:

```bash
psql $DATABASE_URL -c "\d table_name"
```

Reconcile **toward the DB** — modify the Drizzle schema, not the table — unless the user wants a migration.

## Cache invalidation propagation

`invalidate(Tag.X(...))` busts server-rendered Type-2 sections on next render. It does **not** auto-refresh client-side data already loaded into a `useState` in a Type-6 section. After a mutation that updates client-cached data, either:

- Reload the page to force the loader to re-run, or
- The loader hook needs to re-run on a deps change (e.g. when a search-param updates).

When testing, navigate away and back to verify cross-page invalidation.

## When cmux genuinely can't drive a flow

If a multi-step flow keeps failing through cmux despite the React-setter trick — common with deeply controlled state machines — fall back to:

1. **Direct action invocation**: import the server action in a one-shot Bun script and call it.
2. **DB seed**: insert the desired state via SQL, navigate to the page that reads it.
3. **Honest report**: tell the user the manual-test harness can't cover this path and recommend a Playwright e2e test (the project's `e2e/` suite already has session-cookie helpers — see `e2e/helpers/cookies.ts`).

Don't pretend a partially-tested path works. List exactly what you verified and what you didn't.

## Output format for the user

End each round with a tight summary:

- **What changed** — files touched, in 1-line bullets.
- **What you verified** — page name, action, DB row that confirms it.
- **What you couldn't verify and why** — testing-harness limitation, not silent skip.
- **Bugs found and fixed during testing** — call them out separately from the requested change.
- **Bugs found and not fixed** — flag clearly with the file/line and a one-paragraph reproduction.

Trust but verify everything. The user reads the diff anyway.
