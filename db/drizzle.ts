import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

/**
 * `statement_timeout: 30000` (ms) ensures Postgres KILLS the running query
 * after 30s — paired with the 30s action-boundary timeout (lib/effect/
 * run-action.ts). Without it, an application-level timeout cancels the
 * awaiting code but the pg query keeps running, holding a pool slot. 3-4
 * long timed-out queries can exhaust the default 10-slot pool while the app
 * reports "everything fine, just slow."
 */
const pool = new pg.Pool({
  connectionString:  process.env.DATABASE_URL!,
  statement_timeout: 30_000,
})

export const db = drizzle({ client: pool, schema })
