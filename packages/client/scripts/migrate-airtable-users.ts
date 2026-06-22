/**
 * One-time migration: copies users from Airtable → Better Auth PostgreSQL tables.
 * Preserves existing bcrypt hashes so passwords continue to work without resets.
 *
 * Usage (from repo root):
 *   bun run packages/client/scripts/migrate-airtable-users.ts
 *
 * Requires env vars in packages/client/.env.local:
 *   DATABASE_URL, AIRTABLE_PERSONAL_ACCESS_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_USERS_TABLE
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { Pool } from 'pg'
import Airtable from 'airtable'

config({ path: resolve(__dirname, '../.env.local') })

const AIRTABLE_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN!
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!
const USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users'
const DATABASE_URL = process.env.DATABASE_URL!

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !DATABASE_URL) {
  console.error('Missing required env vars: AIRTABLE_PERSONAL_ACCESS_TOKEN, AIRTABLE_BASE_ID, DATABASE_URL')
  process.exit(1)
}

const airtable = new Airtable({ apiKey: AIRTABLE_TOKEN })
const base = airtable.base(AIRTABLE_BASE_ID)
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('.render.com')
    ? { rejectUnauthorized: false }
    : false,
})

async function fetchAirtableUsers() {
  const users: Array<{
    id: string
    email: string
    name: string
    passwordHash: string
    role: string
    isActive: boolean
  }> = []

  await base(USERS_TABLE)
    .select({ view: 'Grid view' })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        const email = record.fields['Email'] as string
        const passwordHash = record.fields['PasswordHash'] as string
        if (!email || !passwordHash) continue

        users.push({
          id: record.id,
          email,
          name: (record.fields['Name'] as string) || email,
          passwordHash,
          role: (record.fields['Role'] as string) || 'user',
          isActive: record.fields['IsActive'] !== false,
        })
      }
      fetchNextPage()
    })

  return users
}

async function migrateUsers() {
  const client = await pool.connect()

  try {
    const airtableUsers = await fetchAirtableUsers()
    console.log(`Found ${airtableUsers.length} users in Airtable`)

    let inserted = 0
    let skipped = 0

    for (const user of airtableUsers) {
      await client.query('BEGIN')
      try {
        // Check if user already exists
        const existing = await client.query('SELECT id FROM "user" WHERE email = $1', [user.email.toLowerCase()])
        if (existing.rows.length > 0) {
          console.log(`  Skipping ${user.email} (already exists)`)
          await client.query('ROLLBACK')
          skipped++
          continue
        }

        const now = new Date().toISOString()

        // Insert into user table
        await client.query(
          `INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [user.id, user.name, user.email.toLowerCase(), true, user.role, now, now]
        )

        // Insert into account table (credential provider stores the password hash here)
        await client.query(
          `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            `${user.id}_credential`,
            user.email.toLowerCase(),
            'credential',
            user.id,
            user.passwordHash,
            now,
            now,
          ]
        )

        await client.query('COMMIT')
        console.log(`  Migrated ${user.email} (role: ${user.role})`)
        inserted++
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`  Failed to migrate ${user.email}:`, err)
      }
    }

    console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`)
  } finally {
    client.release()
    await pool.end()
  }
}

migrateUsers().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
