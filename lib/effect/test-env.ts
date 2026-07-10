/**
 * Vitest-only env stubs. Modules under test transitively import
 * `lib/auth/jwt.ts` (throws at import time when AUTH_SECRET is unset) and
 * `db/drizzle.ts` (asserts DATABASE_URL). Unit tests import this module
 * FIRST — ESM evaluates imports in declaration order — so those imports
 * don't explode. No DB connection is ever opened (pg pools connect lazily).
 * Never import this from app code.
 */
process.env.AUTH_SECRET ??= 'unit-test-secret'
process.env.DATABASE_URL ??= 'postgres://unit:test@localhost:5432/unit_test_placeholder'

export {}
