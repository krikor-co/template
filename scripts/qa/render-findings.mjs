// Regenerate markdown views from the findings ledger (.claude/qa/findings.jsonl):
//   - .claude/qa/findings/INDEX.md     (compact table + counts)
//   - .claude/qa/findings/FINDINGS.md  (full detail, grouped by severity)
//
// Usage:  node scripts/qa/render-findings.mjs

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const LEDGER = path.join(REPO_ROOT, '.claude/qa/findings.jsonl')
const INDEX = path.join(REPO_ROOT, '.claude/qa/findings/INDEX.md')
const FULL = path.join(REPO_ROOT, '.claude/qa/findings/FINDINGS.md')

const all = existsSync(LEDGER)
  ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : []

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, idea: 4 }
const pad = (n) => String(n).padStart(4, '0')
const by = (k) => (a, b) => (SEV_ORDER[a[k]] ?? 9) - (SEV_ORDER[b[k]] ?? 9)

const counts = { critical: 0, high: 0, medium: 0, low: 0, idea: 0 }
const status = { open: 0, fixed: 0, wontfix: 0 }
for (const f of all) {
  if (counts[f.severity] !== undefined) counts[f.severity]++
  if (status[f.status] !== undefined) status[f.status]++
}

// INDEX.md
const sorted = [...all].sort(by('severity'))
let idx = '# Findings Index\n\n'
idx += `Source of truth: \`.claude/qa/findings.jsonl\`. Full detail: \`FINDINGS.md\`. Regenerate: \`node scripts/qa/render-findings.mjs\`.\n\n`
idx += '| ID | Sev | Lens | Status | Trivial | Route | Title |\n|----|-----|------|--------|---------|-------|-------|\n'
for (const f of sorted) {
  idx += `| ${pad(f.id)} | ${f.severity} | ${f.lens} | ${f.status} | ${f.trivial ? 'yes' : ''} | \`${f.route}\` | ${f.title.replace(/\|/g, '\\|')} |\n`
}
idx += `\n## Counts\n- critical: ${counts.critical} · high: ${counts.high} · medium: ${counts.medium} · low: ${counts.low} · idea: ${counts.idea}\n`
idx += `- open: ${status.open} · fixed: ${status.fixed} · wontfix: ${status.wontfix} · **total: ${all.length}**\n`
writeFileSync(INDEX, idx)

// FINDINGS.md
let full = '# Findings — full detail\n\nGrouped by severity. Generated from `findings.jsonl`.\n'
for (const sev of ['critical', 'high', 'medium', 'low', 'idea']) {
  const group = all.filter((f) => f.severity === sev).sort((a, b) => a.id - b.id)
  if (!group.length) continue
  full += `\n## ${sev.toUpperCase()} (${group.length})\n`
  for (const f of group) {
    full += `\n### #${pad(f.id)} — ${f.title}\n`
    full += `- **lens:** ${f.lens} · **status:** ${f.status} · **trivial:** ${f.trivial} · **confidence:** ${f.confidence}\n`
    full += `- **route:** \`${f.route}\` · **state:** ${f.state}\n`
    if (f.file) full += `- **file:** \`${f.file}${f.line ? ':' + f.line : ''}\`\n`
    if (f.screenshot) full += `- **screenshot:** \`${f.screenshot}\`\n`
    if (f.evidence) full += `- **evidence:** ${f.evidence}\n`
    if (f.repro) full += `- **repro:** ${f.repro}\n`
    if (f.suggested_fix) full += `- **fix:** ${f.suggested_fix}\n`
  }
}
writeFileSync(FULL, full)

console.log(`rendered ${all.length} findings -> INDEX.md + FINDINGS.md`)
console.log(`critical=${counts.critical} high=${counts.high} medium=${counts.medium} low=${counts.low} idea=${counts.idea}`)
