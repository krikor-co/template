// Run SQL against the dev DB (.env.local / .env DATABASE_URL) for the QA run.
// Used to seed/force UI states (empty / populated / error) and to read DB truth
// when verifying that the UI matches the data.
//
// Usage:
//   node scripts/qa/sql.mjs "SELECT count(*) FROM persons"
//   node scripts/qa/sql.mjs -f path/to/file.sql
//   echo "UPDATE ..." | node scripts/qa/sql.mjs        (reads stdin if no arg)
//
// Prints rows as JSON. Multiple statements: use -f with a .sql file (split on ;).

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')

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

function readSql() {
  const args = process.argv.slice(2)
  if (args[0] === '-f') return readFileSync(args[1], 'utf8')
  if (args.length && args[0] !== '-') return args.join(' ')
  return readFileSync(0, 'utf8') // stdin
}

const sql = readSql().trim()
if (!sql) {
  console.error('No SQL provided.')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })
try {
  // naive split for -f multi-statement files; single queries pass through whole
  const statements = process.argv[2] === '-f'
    ? sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)
    : [sql.replace(/;$/, '')]
  for (const stmt of statements) {
    const res = await pool.query(stmt)
    console.log(JSON.stringify({ command: res.command, rowCount: res.rowCount, rows: res.rows }, null, 2))
  }
} catch (err) {
  console.error('SQL ERROR:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
