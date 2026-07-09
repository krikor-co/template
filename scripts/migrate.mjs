// Forward-only, idempotent migration runner — runs on deploy (wired into the
// build command before `next build`). Applies any `drizzle/*.sql` file not yet
// recorded in the `_migrations` table, in filename order, each in its own
// transaction. Safe to re-run (already-applied files are skipped).
//
// Reads drizzle-kit's output dir (`./drizzle`, see drizzle.config.ts). The
// `meta/` subdir is ignored (only `*.sql` files are collected) and drizzle's
// `--> statement-breakpoint` lines start with `--`, i.e. SQL comments, so each
// file runs as one multi-statement query. `npm run db:deploy` keeps the
// drizzle-kit migrate path for manual use; this runner is the deploy path:
// dependency-light (pg only), forward-only, with its own `_migrations`
// bookkeeping so fresh and existing databases behave identically at build time.
//
// DATABASE_URL comes from the Vercel build env in prod; from .env.local locally.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'drizzle')

// Local convenience: hydrate DATABASE_URL from .env.local / .env if not already
// in the environment (Vercel sets it directly, so this is a no-op there).
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
if (!DATABASE_URL) {
  console.warn('[migrate] DATABASE_URL not set — skipping migrations (build continues).')
  process.exit(0)
}
if (!existsSync(MIGRATIONS_DIR)) {
  console.log('[migrate] no drizzle/ directory — nothing to run.')
  process.exit(0)
}

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 })

try {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  )
  const applied = new Set((await pool.query('SELECT name FROM _migrations')).rows.map((r) => r.name))

  // Drift guard: a database with pre-existing tables but no _migrations records
  // was never baselined by this runner (an older drizzle-kit schema, or a DB
  // shared with another app). Applying our baseline over it would silently
  // no-op every `CREATE TABLE IF NOT EXISTS` and then fail cryptically on the
  // first new column/index (Postgres 42703). Fail loudly and actionably
  // instead. Set MIGRATE_ALLOW_DRIFT=1 to bypass when you know the schema
  // already matches the baseline.
  if (applied.size === 0 && files.length > 0 && !process.env.MIGRATE_ALLOW_DRIFT) {
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = current_schema() AND table_name <> '_migrations'",
    )
    if (rows[0].n > 0) {
      throw new Error(
        `[migrate] refusing to run: target database has ${rows[0].n} pre-existing table(s) but no _migrations records — it was not baselined by this runner. ` +
          'This usually means DATABASE_URL points at an old-schema or shared database. Fix one of: ' +
          '(a) point DATABASE_URL at a fresh database; ' +
          '(b) reset this one — DROP SCHEMA public CASCADE; CREATE SCHEMA public; — then redeploy; ' +
          `(c) if the schema already matches the baseline, mark it applied: INSERT INTO _migrations (name) VALUES ('${files[0]}'); ` +
          'or set MIGRATE_ALLOW_DRIFT=1 to bypass this check.',
      )
    }
  }

  let ran = 0
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql) // simple protocol (no params) → multi-statement OK
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`[migrate] applied ${file}`)
      ran++
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`[migrate] FAILED ${file}: ${err.message}`)
      throw err
    } finally {
      client.release()
    }
  }
  console.log(`[migrate] done — ${ran} new, ${files.length} total.`)
} finally {
  await pool.end()
}
