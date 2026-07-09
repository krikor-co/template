// Demo seed — a SKELETON. Seeds the auth + tenancy substrate (persons, users,
// workspaces, workspace_members) with sentinel-scoped demo rows that an app
// extends with its own domain tables.
//
// SAFE TO RE-RUN. Every demo person's email ends with "@demo.invalid"; the
// script always deletes ALL demo data (scoped to those persons + the demo
// workspace slug, in reverse-FK order) before seeding fresh. Real rows are
// never touched.
//
// Extending for your app: add domain-table INSERTs in main() after the
// workspace block, and matching DELETEs in clean() ABOVE the tables they
// reference (children first). Guard every optional table with tableExists()
// so the skeleton keeps working across schema drift.
//
// Connection: DATABASE_URL, hydrated from .env.local then .env (matching
// scripts/migrate.mjs). Uses `pg` (matching scripts/qa/sql.mjs + drizzle).
//
// Usage:  node scripts/seed-demo.mjs   (or: npm run seed:demo)

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

// ── env hydration: repo-root .env.local then .env, never overriding ────────
for (const file of ['.env.local', '.env']) {
  const p = path.join(REPO_ROOT, file)
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (!m || line.trim().startsWith('#')) continue
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL not set (checked env, .env.local, .env)')

// Sentinel scoping: cleanup touches ONLY rows reachable from persons whose
// email ends with DEMO_DOMAIN (plus the demo workspace slug as a belt-and-
// braces anchor). ".invalid" is an IETF-reserved TLD — it can never collide
// with a real address.
const DEMO_DOMAIN = '@demo.invalid'
const DEMO_WORKSPACE_SLUG = 'demo-workspace'

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 })
async function q(text, params) { return (await pool.query(text, params)).rows }
async function one(text, params) { return (await pool.query(text, params)).rows[0] }

// ── information_schema probes: survive schema drift across apps ────────────
async function tableExists(t) {
  return !!(await one(`SELECT 1 FROM information_schema.tables WHERE table_name = $1`, [t]))
}
async function columnExists(t, c) {
  return !!(await one(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [t, c]
  ))
}

// ── clean: delete all demo data in reverse-FK order ─────────────────────────
async function clean() {
  const demoUsers = await q(
    `SELECT u.id FROM users u JOIN persons p ON p.id = u.person_id WHERE p.email LIKE $1`,
    [`%${DEMO_DOMAIN}`]
  )
  const userIds = demoUsers.map((r) => r.id)
  const inUsers = userIds.length ? userIds : [-1]

  let wsIds = []
  if (await tableExists('workspaces')) {
    const rows = await q(
      `SELECT DISTINCT w.id FROM workspaces w
       WHERE w.slug = $1
          OR w.id IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = ANY($2))`,
      [DEMO_WORKSPACE_SLUG, inUsers]
    )
    wsIds = rows.map((r) => r.id)
  }
  const inWs = wsIds.length ? wsIds : [-1]

  // Children first. Every optional table is probe-guarded so the script runs
  // against any migration state. ADD YOUR APP'S DOMAIN-TABLE DELETES HERE,
  // above the tables they reference.
  if (await tableExists('workspace_pulse')) {
    await q(`DELETE FROM workspace_pulse WHERE workspace_id = ANY($1)`, [inWs])
  }
  if (await tableExists('trace_span')) {
    await q(`DELETE FROM trace_span WHERE workspace_id = ANY($1) OR user_id = ANY($2)`, [inWs, inUsers])
  }
  if (await tableExists('ai_call_log')) {
    await q(`DELETE FROM ai_call_log WHERE workspace_id = ANY($1)`, [inWs])
  }
  if (await tableExists('audit_log')) {
    await q(`DELETE FROM audit_log WHERE workspace_id = ANY($1) OR user_id = ANY($2)`, [inWs, inUsers])
  }
  if (await tableExists('invites')) {
    await q(`DELETE FROM invites WHERE workspace_id = ANY($1) OR invited_by_user_id = ANY($2)`, [inWs, inUsers])
  }
  if (await tableExists('feature_flag')) {
    await q(`DELETE FROM feature_flag WHERE scope = 'workspace' AND scope_id = ANY($1)`, [inWs])
    await q(`DELETE FROM feature_flag WHERE scope = 'user' AND scope_id = ANY($1)`, [inUsers])
  }
  if (await tableExists('workspace_members')) {
    await q(`DELETE FROM workspace_members WHERE workspace_id = ANY($1) OR user_id = ANY($2)`, [inWs, inUsers])
  }
  if (await tableExists('workspaces')) {
    await q(`DELETE FROM workspaces WHERE id = ANY($1)`, [inWs])
  }
  // sessions.user_id is ON DELETE CASCADE — the explicit DELETE keeps the
  // intent visible and covers schemas where the cascade was dropped.
  await q(`DELETE FROM sessions WHERE user_id = ANY($1)`, [inUsers])
  await q(`DELETE FROM users WHERE id = ANY($1)`, [inUsers])
  await q(`DELETE FROM persons WHERE email LIKE $1`, [`%${DEMO_DOMAIN}`])

  return { users: userIds.length, workspaces: wsIds.length }
}

// ── low-level creators ───────────────────────────────────────────────────────
async function makePerson({ name, email }) {
  const cols = ['name', 'email']
  const vals = [name, email]
  // email_verified lands with the dual-identifier auth phase; probe so the
  // skeleton also runs against pared-down schemas.
  if (await columnExists('persons', 'email_verified')) {
    cols.push('email_verified')
    vals.push(true)
  }
  const ph = vals.map((_, i) => `$${i + 1}`).join(',')
  const r = await one(`INSERT INTO persons (${cols.join(',')}) VALUES (${ph}) RETURNING id`, vals)
  return r.id
}
async function makeUser(personId, role = 'user') {
  const r = await one(`INSERT INTO users (person_id, role) VALUES ($1, $2) RETURNING id`, [personId, role])
  return r.id
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const cleaned = await clean()
  console.log(`> cleaned demo rows (${cleaned.users} users, ${cleaned.workspaces} workspaces)`)

  const ownerPid = await makePerson({ name: 'Demo Owner', email: `owner${DEMO_DOMAIN}` })
  const memberPid = await makePerson({ name: 'Demo Member', email: `member${DEMO_DOMAIN}` })
  const adminPid = await makePerson({ name: 'Demo Admin', email: `admin${DEMO_DOMAIN}` })

  const ownerUid = await makeUser(ownerPid, 'user')
  const memberUid = await makeUser(memberPid, 'user')
  const adminUid = await makeUser(adminPid, 'admin') // platform admin — no workspace membership

  let wsId = null
  if (await tableExists('workspaces')) {
    const ws = await one(
      `INSERT INTO workspaces (name, slug) VALUES ($1, $2) RETURNING id`,
      ['Demo Workspace', DEMO_WORKSPACE_SLUG]
    )
    wsId = ws.id
    await q(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'owner'), ($1, $3, 'member')`,
      [wsId, ownerUid, memberUid]
    )
  }

  console.log('> seeded:')
  console.log(`   owner${DEMO_DOMAIN}  -> userId=${ownerUid} (workspace role: owner)`)
  console.log(`   member${DEMO_DOMAIN} -> userId=${memberUid} (workspace role: member)`)
  console.log(`   admin${DEMO_DOMAIN}  -> userId=${adminUid} (platform role: admin)`)
  if (wsId !== null) console.log(`   workspace '${DEMO_WORKSPACE_SLUG}' -> workspaceId=${wsId}`)
  console.log('> done — safe to re-run.')
}

main()
  .catch((err) => {
    console.error('seed-demo FAILED:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
