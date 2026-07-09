// Quick proof that the saved storageState enters ALREADY authenticated (no OTP).
// Opens a session-guarded route, confirms it did not bounce to /auth, screenshots.
//
// Usage:  node smoke.mjs    (run auth-setup.mjs first)
// Env:    BASE_URL        (default http://localhost:3000)
//         E2E_VERIFY_PATH (default /dashboard)

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const VERIFY_PATH = process.env.E2E_VERIFY_PATH || '/dashboard'
const AUTH_FILE = path.resolve(REPO_ROOT, '.auth/app.json')
const SHOT = path.resolve(REPO_ROOT, 'tmp/verification/smoke.png')

if (!existsSync(AUTH_FILE)) {
  console.error(`State not found at ${AUTH_FILE}. Run: node scripts/playwright/auth-setup.mjs`)
  process.exit(1)
}

const browser = await chromium.launch()
const context = await browser.newContext({ storageState: AUTH_FILE })
const page = await context.newPage()

await page.goto(`${BASE_URL}${VERIFY_PATH}`, { waitUntil: 'domcontentloaded' })
const url = page.url()
const title = await page.title()

mkdirSync(path.dirname(SHOT), { recursive: true })
await page.screenshot({ path: SHOT, fullPage: true })
await browser.close()

const ok = !new URL(url).pathname.startsWith('/auth')
console.log(`URL:        ${url}`)
console.log(`Title:      ${title}`)
console.log(`Screenshot: ${SHOT}`)
console.log(ok ? 'OK — authenticated via saved state.' : 'FAIL — bounced to /auth; state invalid/expired.')
process.exit(ok ? 0 : 1)
