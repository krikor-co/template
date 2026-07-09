// QA "eyes" — visit one or more routes with the authenticated storageState and
// emit a structured observation per route (+ a full-page screenshot). Reuses one
// browser context across all URLs. This is the scripted equivalent of driving the
// Playwright MCP, but deterministic and dependency-free for unattended runs.
//
// Usage:
//   node scripts/qa/visit.mjs <path-or-url> [<path-or-url> ...]
//   node scripts/qa/visit.mjs --dark /dashboard                 # toggle dark mode
//   node scripts/qa/visit.mjs --no-auth /auth/identify          # fresh context (logged out)
//   node scripts/qa/visit.mjs --outdir tmp/qa/run1 <paths...>   # screenshot dir
//
// Env: BASE_URL (default http://localhost:3000)
// Output: a JSON array on stdout, one object per route. Screenshots -> outdir/<slug>.png

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const AUTH_FILE = path.resolve(REPO_ROOT, '.auth/app.json')

const argv = process.argv.slice(2)
let outdir = 'tmp/qa/_visits'
let dark = false
let noAuth = false
let width = 1440   // desktop by default so lg: bento renders (override with --width)
const targets = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--outdir') outdir = argv[++i]
  else if (a === '--dark') dark = true
  else if (a === '--no-auth') noAuth = true
  else if (a === '--width') width = Number(argv[++i])
  else targets.push(a)
}
if (!targets.length) {
  console.error('Usage: node scripts/qa/visit.mjs [--outdir D] [--dark] [--no-auth] <path-or-url>...')
  process.exit(1)
}
const OUTDIR = path.resolve(REPO_ROOT, outdir)
mkdirSync(OUTDIR, { recursive: true })

const slugOf = (u) => {
  const p = u.replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '')
  return (p.replace(/^\/|\/$/g, '').replace(/[^a-zA-Z0-9]+/g, '-') || 'root') + (dark ? '-dark' : '')
}
const toUrl = (t) => (t.startsWith('http') ? t : `${BASE_URL}${t.startsWith('/') ? '' : '/'}${t}`)

if (!noAuth && !existsSync(AUTH_FILE)) {
  console.error(`Auth state missing at ${AUTH_FILE}. Run: node scripts/playwright/auth-setup.mjs`)
  process.exit(1)
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width, height: 900 },
  ...(noAuth ? {} : { storageState: AUTH_FILE }),
})
const results = []

for (const t of targets) {
  const url = toUrl(t)
  const slug = slugOf(t)
  const shot = path.join(OUTDIR, `${slug}.png`)
  const consoleErrors = []
  const consoleWarnings = []
  const pageErrors = []
  const failedRequests = []

  const page = await context.newPage()
  // Force dark BOTH ways: persist next-themes' key BEFORE load (the
  // ThemeProvider storageKey is `app.theme.mode` — lib/theme/ThemeProvider.tsx),
  // then add the `dark` class after load — otherwise the provider's mount
  // effect re-resolves `system` (→ light in headless Chrome) and reverts a
  // class-only toggle.
  if (dark) await page.addInitScript(() => {
    localStorage.setItem('app.theme.mode', 'dark')
  })
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300))
    else if (m.type() === 'warning') consoleWarnings.push(m.text().slice(0, 200))
  })
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 300)))
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push({ status: r.status(), url: r.url().slice(0, 200) })
  })

  let httpStatus = null
  let navError = null
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    httpStatus = resp ? resp.status() : null
    if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
    // settle: network idle (best-effort) then a beat for streamed Suspense content
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(1200)
  } catch (e) {
    navError = String(e.message).slice(0, 200)
  }

  let observation = {}
  try {
    observation = await page.evaluate(() => {
      const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
      const heads = [...document.querySelectorAll('h1,h2,h3')].map((h) => txt(h)).filter(Boolean).slice(0, 20)
      const buttons = [...document.querySelectorAll('button')].map((b) => txt(b)).filter(Boolean).slice(0, 25)
      const links = [...document.querySelectorAll('a[href]')].length
      const inputs = [...document.querySelectorAll('input,select,textarea')].map(
        (i) => i.getAttribute('name') || i.getAttribute('id') || i.type
      ).filter(Boolean).slice(0, 25)
      const skeleton = !!document.querySelector('[class*="animate-pulse"],[class*="skeleton"],[aria-busy="true"]')
      const tables = document.querySelectorAll('table tbody tr').length
      return {
        title: document.title,
        h: heads,
        buttons,
        linkCount: links,
        inputs,
        sectionCount: document.querySelectorAll('section').length,
        tableRowCount: tables,
        looksLikeSkeleton: skeleton,
        bodyText: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600),
      }
    })
  } catch (e) {
    observation = { evalError: String(e.message).slice(0, 200) }
  }

  await page.screenshot({ path: shot, fullPage: true }).catch(() => {})
  const finalUrl = page.url()
  await page.close()

  results.push({
    requested: t,
    finalUrl,
    httpStatus,
    bouncedToAuth: new URL(finalUrl).pathname.startsWith('/auth') && !t.includes('/auth'),
    navError,
    screenshot: path.relative(REPO_ROOT, shot),
    consoleErrors,
    consoleWarnings: consoleWarnings.slice(0, 8),
    pageErrors,
    failedRequests: failedRequests.slice(0, 12),
    ...observation,
  })
}

await browser.close()
console.log(JSON.stringify(results, null, 2))
