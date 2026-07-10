// Contrast auditor — loads routes (authenticated) and flags text whose WCAG
// contrast vs its effective background is below AA. Pinpoints unreadable text.
// Usage: node scripts/qa/contrast.mjs /dashboard /docs ...
import { chromium } from 'playwright'
import path from 'node:path'

const routes = process.argv.slice(2).filter((a) => a.startsWith('/'))
const base = process.env.BASE_URL || 'http://localhost:3000'
const storage = path.resolve('.auth/app.json')

const AUDIT = () => {
  const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
  const parse = (s) => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { rgb: [p[0], p[1], p[2]], a: p[3] === undefined ? 1 : p[3] } }
  const over = (fg, bg) => fg.map((c, i) => Math.round(c * 1 + bg[i] * 0)) // fg opaque assumed; simple
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); const hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05) }
  const effBg = (el) => {
    let n = el
    while (n) {
      const cs = getComputedStyle(n)
      const p = parse(cs.backgroundColor)
      if (p && p.a > 0.5) return p.rgb
      n = n.parentElement
    }
    return [255, 255, 255]
  }
  const out = []
  const els = document.querySelectorAll('body *')
  for (const el of els) {
    // only elements with their own direct visible text
    const direct = Array.from(el.childNodes).filter((c) => c.nodeType === 3 && c.textContent.trim()).map((c) => c.textContent.trim()).join(' ')
    if (!direct) continue
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') continue
    const fg = parse(cs.color); if (!fg) continue
    // approximate fg over bg if translucent
    const bg = effBg(el)
    const fgRgb = fg.a < 1 ? fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a)) : fg.rgb
    const cr = ratio(fgRgb, bg)
    const px = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight) >= 600
    const large = px >= 24 || (px >= 18.66 && bold)
    const need = large ? 3.0 : 4.5
    if (cr < need) {
      out.push({ text: direct.slice(0, 40), ratio: +cr.toFixed(2), need, px: +px.toFixed(0), color: cs.color, bg: `rgb(${bg.join(',')})`, cls: el.className?.toString?.().slice(0, 80) })
    }
  }
  // de-dup by text+cls
  const seen = new Set(); const uniq = []
  for (const o of out) { const k = o.text + o.cls; if (!seen.has(k)) { seen.add(k); uniq.push(o) } }
  return uniq.sort((a, b) => a.ratio - b.ratio)
}

const b = await chromium.launch()
const c = await b.newContext(routes[0]?.startsWith('/auth') ? {} : { storageState: storage })
const p = await c.newPage()
for (const route of routes) {
  await p.goto(base + route, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await p.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await p.waitForTimeout(1200)
  const fails = await p.evaluate(AUDIT)
  console.log(`\n=== ${route} — ${fails.length} fails ===`)
  for (const f of fails.slice(0, 15)) console.log(`  ${f.ratio} (need ${f.need}) ${f.px}px  "${f.text}"  fg:${f.color} bg:${f.bg}\n      .${f.cls}`)
}
await b.close()
