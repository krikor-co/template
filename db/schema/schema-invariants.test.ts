import { describe, expect, it } from 'vitest'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as schema from '@/db/schema'
import { users } from '@/db/schema'

/**
 * Schema-wide invariants (see docs/schema.md):
 * - every timestamp column is timestamptz ({ withTimezone: true }) — naive
 *   `timestamp` silently drops the timezone and breaks across server-TZ changes
 * - users.personId is unique (1:1 person↔user; OTP login resolves person→user)
 *
 * Iterates every table exported from db/schema/index.ts, so new tables are
 * covered automatically.
 */
const tables = Object.values(schema).filter(
  (value) => value instanceof PgTable,
) as PgTable[]

describe('schema invariants', () => {
  it('exports at least the five substrate tables', () => {
    expect(tables.length).toBeGreaterThanOrEqual(5)
  })

  it('every timestamp column is timestamptz', () => {
    const offenders: string[] = []
    for (const table of tables) {
      const { columns, name } = getTableConfig(table)
      for (const column of columns) {
        const sqlType = column.getSQLType()
        if (sqlType.startsWith('timestamp') && !sqlType.includes('with time zone')) {
          offenders.push(`${name}.${column.name}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('users.personId carries a unique constraint (1:1 person↔user)', () => {
    const { uniqueConstraints } = getTableConfig(users)
    const hasPersonIdUnique = uniqueConstraints.some(
      (constraint) =>
        constraint.columns.length === 1 && constraint.columns[0]?.name === 'person_id',
    )
    expect(hasPersonIdUnique).toBe(true)
  })
})
