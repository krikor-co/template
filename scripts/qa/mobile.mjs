// Mobile responsiveness auditor — loads routes at iPhone width (390×844),
// flags horizontal overflow (the #1 mobile bug) + lists the widest offending
// elements, and writes a screenshot per route. Authenticated via .auth/app.json.
// Usage: node scripts/qa/mobile.mjs --outdir tmp/qa/mob <routes...>
import { chromium } from 'playwright'
import path from 'node:path'

const args = process.argv.slice(2)
const outIdx = args.indexOf('--outdir')
const outdir = outIdx >= 0 ? args[outIdx + 1] : 'tmp/qa/mob'
const routes = args.filter((a) => a.startsWith('/'))
const base = process.env.BASE_URL || 'http://localhost:3000'
const W = Number(process.env.MOBILE_W || 390)
const H = Number(process.env.MOBILE_H || 844)

const OVERFLOW = (vw) => {
  const out = []
  const docW = document.documentElement.scrollWidth
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    // element extends past the right edge of the viewport by > 1px
    if (r.right > vw + 1 && r.width > 8 && r.height > 4) {
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed') continue
      out.push({
        tag: el.tagName.toLowerCase(),
        w: Math.round(r.width),
        right: Math.round(r.right),
        text: (el.textContent || '').trim().slice(0, 35),
        cls: (el.className?.toString?.() || '').slice(0, 70),
      })
    }
  }
  // keep the widest few, de-duped by class
  const seen = new Set(); const uniq = []
  for (const o of out.sort((a, b) => b.right - a.right)) {
    const k = o.cls + o.tag
    if (!seen.has(k)) { seen.add(k); uniq.push(o) }
  }
  return { docW, overflow: docW > vw + 1, widest: uniq.slice(0, 8) }
}

const b = await chromium.launch()
const c = await b.newContext({
  storageState: routes[0]?.startsWith('/auth') ? undefined : path.resolve('.auth/app.json'),
  viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
})
const p = await c.newPage()
for (const route of routes) {
  await p.goto(base + route, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await p.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await p.waitForTimeout(1000)
  const res = await p.evaluate(OVERFLOW, W)
  const name = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'
  await p.screenshot({ path: `${outdir}/${name}.png`, fullPage: true }).catch(() => {})
  const flag = res.overflow ? `⚠ OVERFLOW docW=${res.docW} (vw=${W})` : 'ok'
  console.log(`${flag}  ${route}`)
  if (res.overflow) for (const e of res.widest) console.log(`    <${e.tag} w=${e.w} right=${e.right}> "${e.text}"  .${e.cls}`)
}
await b.close()
