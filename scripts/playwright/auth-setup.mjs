// Mint a session ONCE -> save an authenticated Playwright storageState.
// The Playwright MCP server then boots with that state and the agent's browser
// starts already logged in, with no OTP flow to drive on every verification.
//
// App auth = a JWT cookie (`session_token`, HS256, 30d, signed with AUTH_SECRET)
// PLUS a matching row in the `sessions` table. The layout guard
// (lib/auth/session.ts) requires both: a valid JWT and a non-deactivated,
// unexpired sessions row whose `token` equals the cookie. So we mint the JWT,
// INSERT the row, then bake the cookie into a storageState file — no UI login.
//
// Usage:  node auth-setup.mjs
// Env (loaded from repo-root .env.local then .env if not already set):
//   AUTH_SECRET     (required — same secret the dev server uses to verify the JWT)
//   DATABASE_URL    (required — MUST be the database the target server reads)
//   BASE_URL        (default http://localhost:3000)
//   E2E_USER_ID     (numeric user id; wins over E2E_USER_EMAIL when set)
//   E2E_USER_EMAIL  (default owner@demo.invalid — seeded by scripts/seed-demo.mjs)
//   E2E_VERIFY_PATH (default /dashboard — any session-guarded route)

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { chromium } from 'playwright'
import { SignJWT } from 'jose'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

// --- minimal env loader: repo-root .env.local then .env, never overriding ---
for (const file of ['.env.local', '.env']) {
  const p = path.join(REPO_ROOT, file)
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (!m || line.trim().startsWith('#')) continue
    const key = m[1]
    const val = m[2].trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = val
  }
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const AUTH_SECRET = process.env.AUTH_SECRET
const DATABASE_URL = process.env.DATABASE_URL
const USER_EMAIL = process.env.E2E_USER_EMAIL || 'owner@demo.invalid'

// Cookie name = AUTH_SESSION_COOKIE in lib/auth/identifier.ts. Keep in sync.
const COOKIE_NAME = 'session_token'
const AUTH_FILE = path.resolve(REPO_ROOT, '.auth/app.json')
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// Guard-verify path: a route whose layout requires a session. Navigating it
// proves the minted state is ACCEPTED before we save the storageState.
const VERIFY_PATH = process.env.E2E_VERIFY_PATH || '/dashboard'

if (!AUTH_SECRET) throw new Error('AUTH_SECRET is not set (checked env, .env.local, .env)')
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set (checked env, .env.local, .env)')

// Mirror lib/auth/jwt.ts::createSessionToken exactly (slim payload: numeric userId).
async function createSessionToken(userId) {
  const secret = new TextEncoder().encode(AUTH_SECRET)
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

async function main() {
  mkdirSync(path.dirname(AUTH_FILE), { recursive: true })

  const pool = new pg.Pool({ connectionString: DATABASE_URL })
  let userId
  let token
  try {
    if (process.env.E2E_USER_ID) {
      userId = Number(process.env.E2E_USER_ID)
    } else {
      const r = await pool.query(
        `SELECT u.id FROM users u JOIN persons p ON p.id = u.person_id WHERE p.email = $1`,
        [USER_EMAIL]
      )
      if (!r.rows.length) {
        throw new Error(
          `No user found for ${USER_EMAIL}. Run: node scripts/seed-demo.mjs (or pass E2E_USER_ID).`
        )
      }
      userId = r.rows[0].id
    }

    console.log(`> Minting session for userId=${userId}`)
    token = await createSessionToken(userId)
    const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS)
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    )
  } finally {
    await pool.end()
  }
  console.log('> Session row inserted')

  // Bake the cookie into a storageState by setting it on a real context, then
  // navigating once to prove the guard accepts it before we save.
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const { hostname } = new URL(BASE_URL)
  await context.addCookies([
    {
      name:     COOKIE_NAME,
      value:    token,
      domain:   hostname,
      path:     '/',
      httpOnly: true,
      secure:   false,
      sameSite: 'Lax',
      expires:  Math.floor((Date.now() + THIRTY_DAYS_MS) / 1000),
    },
  ])

  const page = await context.newPage()
  const target = `${BASE_URL}${VERIFY_PATH}`
  console.log(`> Verifying the session lands authenticated at ${target}`)
  await page.goto(target, { waitUntil: 'domcontentloaded' })

  if (new URL(page.url()).pathname.startsWith('/auth')) {
    await browser.close()
    throw new Error(
      `Redirected to ${page.url()} — guard rejected the session. ` +
        `Check that userId=${userId} exists and DATABASE_URL matches the target server's DB.`
    )
  }

  await context.storageState({ path: AUTH_FILE })
  await browser.close()
  console.log(`> OK — authenticated state saved to ${AUTH_FILE}`)
}

main().catch((err) => {
  console.error('auth-setup FAILED:', err.message)
  process.exit(1)
})
