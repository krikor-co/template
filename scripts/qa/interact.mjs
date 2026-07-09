// Interaction probe: for each form route, navigate (authed), screenshot "before",
// click the primary submit/continue button WITHOUT filling anything, then capture
// what happens — validation errors (good) vs crash / silent empty-submit / unexpected
// navigation (bad). This exercises the validation path generically.
//
// Usage: node scripts/qa/interact.mjs [--no-auth] [--outdir D] <path>...
// Output: JSON array on stdout; before/after screenshots in outdir.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const AUTH_FILE = path.resolve(REPO_ROOT, '.auth/app.json')

const argv = process.argv.slice(2)
let outdir = 'tmp/qa/interact'
let noAuth = false
const targets = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--outdir') outdir = argv[++i]
  else if (a === '--no-auth') noAuth = true
  else targets.push(a)
}
const OUTDIR = path.resolve(REPO_ROOT, outdir)
mkdirSync(OUTDIR, { recursive: true })
const slugOf = (u) => (u.replace(/[?#].*$/, '').replace(/^\/|\/$/g, '').replace(/[^a-zA-Z0-9]+/g, '-') || 'root')

const browser = await chromium.launch()
const context = await browser.newContext(noAuth ? {} : { storageState: AUTH_FILE })
const results = []

// label patterns for the primary action button — English-first, with pt-BR
// alternates (extend for your app's locales)
const SUBMIT_RX = /^(continue|save|create|add|next|submit|send|confirm|register|finish|verify|continuar|salvar|criar|adicionar|avançar|próximo|confirmar|cadastrar|registrar|enviar|concluir)\b/i

for (const t of targets) {
  const url = t.startsWith('http') ? t : `${BASE_URL}${t}`
  const consoleErrors = []
  const pageErrors = []
  const page = await context.newPage()
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)))

  let navError = null
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(1300) // let scene minStay (~1000ms) elapse
  } catch (e) { navError = String(e.message).slice(0, 200) }

  await page.screenshot({ path: path.join(OUTDIR, `${slugOf(t)}-before.png`), fullPage: true }).catch(() => {})
  const urlBefore = page.url()

  // find the submit button: prefer [type=submit], else a button whose text matches SUBMIT_RX
  const picked = await page.evaluate((rxSrc) => {
    const rx = new RegExp(rxSrc, 'i')
    const btns = [...document.querySelectorAll('button, [role="button"], input[type="submit"]')]
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled }
    let el = btns.find((b) => (b.getAttribute('type') === 'submit') && vis(b))
    if (!el) el = btns.find((b) => rx.test((b.textContent || b.value || '').trim()) && vis(b))
    if (!el) return null
    el.setAttribute('data-qa-submit', '1')
    return { text: (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40), disabled: !!el.disabled }
  }, SUBMIT_RX.source)

  let clicked = false
  let clickError = null
  if (picked) {
    try {
      await page.click('[data-qa-submit="1"]', { timeout: 4000 })
      clicked = true
      await page.waitForTimeout(1500)
    } catch (e) { clickError = String(e.message).slice(0, 150) }
  }

  const after = await page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    const errEls = [...document.querySelectorAll('[role="alert"], [aria-invalid="true"], [class*="text-danger"], [class*="text-red"], [class*="error"]')]
    const errorTexts = [...new Set(errEls.map(txt).filter((s) => s && s.length < 120))].slice(0, 12)
    return {
      ariaInvalid: document.querySelectorAll('[aria-invalid="true"]').length,
      errorTexts,
      bodyTextHead: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    }
  })

  await page.screenshot({ path: path.join(OUTDIR, `${slugOf(t)}-after.png`), fullPage: true }).catch(() => {})
  const urlAfter = page.url()
  await page.close()

  results.push({
    requested: t,
    navError,
    submitButton: picked ? picked.text : null,
    submitWasDisabled: picked ? picked.disabled : null,
    clicked,
    clickError,
    urlChangedOnSubmit: urlBefore !== urlAfter,
    urlBefore: urlBefore.replace(BASE_URL, ''),
    urlAfter: urlAfter.replace(BASE_URL, ''),
    ariaInvalid: after.ariaInvalid,
    errorTexts: after.errorTexts,
    consoleErrors,
    pageErrors,
    afterBodyHead: after.bodyTextHead,
  })
}

await browser.close()
console.log(JSON.stringify(results, null, 2))
