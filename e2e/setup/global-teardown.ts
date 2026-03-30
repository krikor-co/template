import pg from 'pg'

export default async function globalTeardown() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return

  const pool = new pg.Pool({ connectionString })
  try {
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
  } finally {
    await pool.end()
  }
}
