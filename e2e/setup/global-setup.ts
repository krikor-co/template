import pg from 'pg'

export default async function globalSetup() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set in .env.test')
  if (process.env.PLAYWRIGHT_TEST !== '1') throw new Error('PLAYWRIGHT_TEST must be "1" in .env.test')

  const pool = new pg.Pool({ connectionString })
  try {
    await cleanupTestData(pool)
  } finally {
    await pool.end()
  }
}

async function cleanupTestData(pool: pg.Pool) {
  await pool.query(
    `DELETE FROM sessions
     WHERE user_id IN (
       SELECT u.id FROM users u
       JOIN persons p ON p.id = u.person_id
       WHERE p.email LIKE $1
     )`,
    ['%@test.invalid']
  )
  await pool.query(
    `DELETE FROM users
     WHERE person_id IN (SELECT id FROM persons WHERE email LIKE $1)`,
    ['%@test.invalid']
  )
  await pool.query(`DELETE FROM otp_codes WHERE email LIKE $1`, ['%@test.invalid'])
  await pool.query(`DELETE FROM persons WHERE email LIKE $1`, ['%@test.invalid'])
}
